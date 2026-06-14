/*
 * Cart cookie contract, shared by the server (read/write) and the client (the
 * header badge + add-to-cart button). Kept free of "server-only" so client
 * components can import the constants and parse `document.cookie` directly.
 *
 * The cart holds only published product ids, no quantities (a digital good is
 * owned once) and no secrets, so the cookie is intentionally NOT httpOnly:
 * the header badge reads it client-side, which lets the storefront layout stay
 * statically rendered (no per-request cookie read) and keep ISR.
 *
 * Ids are cuids (alphanumeric), so a "."-separated list needs no escaping and
 * avoids JSON percent-encoding round-trips through the cookie jar.
 */

export const CART_COOKIE = "gf_cart";
export const CART_MAX_ITEMS = 50;
export const CART_CHANGED_EVENT = "gf-cart-changed";

export function parseCartValue(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const ids = raw
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(ids)).slice(0, CART_MAX_ITEMS);
}

export function serializeCart(ids: string[]): string {
  return Array.from(new Set(ids)).slice(0, CART_MAX_ITEMS).join(".");
}

function readCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CART_COOKIE}=`));
  return hit?.slice(CART_COOKIE.length + 1);
}

/** Client-only: current cart ids from document.cookie. */
export function readCartIdsFromDocument(): string[] {
  return parseCartValue(readCookie());
}

/** Client-only: current cart item count from document.cookie. */
export function readCartCountFromDocument(): number {
  return readCartIdsFromDocument().length;
}
