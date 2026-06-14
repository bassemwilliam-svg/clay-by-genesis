import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, parseCartValue, serializeCart } from "./shared";

/*
 * Server-side cart cookie access. Reading works in Server Components; writing
 * (set/delete) only works inside a Server Action or Route Handler, Next sends
 * the Set-Cookie header on that response. See cart/actions.ts for the writers.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function readCartIds(): Promise<string[]> {
  const store = await cookies();
  return parseCartValue(store.get(CART_COOKIE)?.value);
}

export async function writeCartIds(ids: string[]): Promise<void> {
  const store = await cookies();
  const value = serializeCart(ids);
  if (!value) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, value, {
    httpOnly: false, // header badge reads it client-side; holds only public ids
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}
