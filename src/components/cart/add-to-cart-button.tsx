"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/lib/cart/actions";
import { CART_CHANGED_EVENT } from "@/lib/cart/shared";

/*
 * Adds a product to the cart cookie via the server action, then broadcasts the
 * new count so the nav badge updates without a refetch. Adding is idempotent
 * server-side, so an accidental double-click is harmless.
 */
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  const onClick = () => {
    startTransition(async () => {
      const { count } = await addToCart(productId);
      setAdded(true);
      window.dispatchEvent(
        new CustomEvent(CART_CHANGED_EVENT, { detail: { count } }),
      );
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || added}
      className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
    >
      {added ? "Added to cart" : pending ? "Adding…" : "Add to cart"}
    </button>
  );
}
