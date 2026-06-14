"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { readCartIds, writeCartIds } from "./cookie";
import { CART_MAX_ITEMS } from "./shared";

/*
 * Cart mutations. The cart is a cookie of product ids (no quantities, a
 * digital good is owned once). These run as Server Actions so Next can emit
 * the Set-Cookie header on the response. Each returns the new count so the
 * client badge can update without a refetch.
 */

const productId = z.string().min(1).max(64);

export type CartActionResult = { count: number };

export async function addToCart(id: string): Promise<CartActionResult> {
  const parsed = productId.safeParse(id);
  if (!parsed.success) {
    return { count: (await readCartIds()).length };
  }

  const ids = await readCartIds();
  if (!ids.includes(parsed.data) && ids.length < CART_MAX_ITEMS) {
    ids.push(parsed.data);
    await writeCartIds(ids);
  }

  revalidatePath("/cart");
  return { count: ids.length };
}

export async function removeFromCart(id: string): Promise<CartActionResult> {
  const parsed = productId.safeParse(id);
  const ids = await readCartIds();
  if (!parsed.success) return { count: ids.length };

  const next = ids.filter((existing) => existing !== parsed.data);
  await writeCartIds(next);

  revalidatePath("/cart");
  return { count: next.length };
}

export async function clearCart(): Promise<CartActionResult> {
  await writeCartIds([]);
  revalidatePath("/cart");
  return { count: 0 };
}
