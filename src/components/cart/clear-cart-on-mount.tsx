"use client";

import { useEffect, useRef } from "react";
import { clearCart } from "@/lib/cart/actions";
import { CART_CHANGED_EVENT } from "@/lib/cart/shared";

/*
 * Clears the cart once after a confirmed checkout success. Rendered on the
 * success page; the ref guard keeps Strict Mode's double-invoke from firing
 * the action twice.
 */
export function ClearCartOnMount() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void clearCart().then(() => {
      window.dispatchEvent(
        new CustomEvent(CART_CHANGED_EVENT, { detail: { count: 0 } }),
      );
    });
  }, []);

  return null;
}
