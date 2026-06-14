"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  CART_CHANGED_EVENT,
  readCartCountFromDocument,
} from "@/lib/cart/shared";

/*
 * Header cart link with a live count. Reads the (non-httpOnly) cart cookie
 * client-side via useSyncExternalStore and re-renders on the cart-changed
 * event, so the storefront layout stays static (no per-request cookie read,
 * ISR preserved) while the badge still reflects add/remove instantly.
 */
function subscribe(callback: () => void) {
  window.addEventListener(CART_CHANGED_EVENT, callback);
  return () => window.removeEventListener(CART_CHANGED_EVENT, callback);
}

export function CartNavLink() {
  const count = useSyncExternalStore(
    subscribe,
    readCartCountFromDocument,
    () => 0,
  );

  return (
    <Link href="/cart" className="hover:text-foreground">
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
