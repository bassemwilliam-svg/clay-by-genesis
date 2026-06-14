"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/*
 * Review write boundary + the one personalized read the storefront needs.
 *
 * Reviews are gated to *verified owners*: a user may only review a product they
 * hold a live Entitlement for (revokedAt = null), regardless of how they came to
 * own it (purchase, bundle, grant, or membership). The Review's unique
 * [userId, productId] means one review per buyer per product, so writes are an
 * upsert: a second submission edits the first rather than erroring.
 *
 * `loadMyReview` is read-only but lives here (a "use server" module) so the
 * client island can call it on mount to learn whether to show the form. Keeping
 * it out of the page render keeps the product page statically renderable (ISR).
 */

export type ReviewActionState = {
  ok: boolean;
  error?: string;
  // Present on success: the saved review, or null after a delete.
  review?: { rating: number; body: string | null } | null;
};

export type MyReviewState = {
  authed: boolean;
  canReview: boolean;
  review: { rating: number; body: string | null } | null;
};

/** A live entitlement (any source) is what makes a buyer a "verified owner". */
async function ownsProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const entitlement = await prisma.entitlement.findFirst({
    where: { userId, productId, revokedAt: null },
    select: { id: true },
  });
  return entitlement !== null;
}

async function revalidateProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (product) revalidatePath(`/products/${product.slug}`);
}

/** Personalized review state for the current viewer (used by the client island). */
export async function loadMyReview(productId: string): Promise<MyReviewState> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { authed: false, canReview: false, review: null };

  const [canReview, existing] = await Promise.all([
    ownsProduct(user.id, productId),
    prisma.review.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
      select: { rating: true, body: true },
    }),
  ]);

  return { authed: true, canReview, review: existing };
}

const reviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, "Pick a rating from 1 to 5 stars.")
    .max(5, "Pick a rating from 1 to 5 stars."),
  body: z
    .string()
    .trim()
    .max(2000, "Keep your review under 2000 characters.")
    .optional(),
});

export async function submitReview(
  productId: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { ok: false, error: "Sign in to leave a review." };

  if (!(await ownsProduct(user.id, productId))) {
    return {
      ok: false,
      error: "Only verified owners can review this product.",
    };
  }

  const rawBody = formData.get("body");
  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating"),
    body: typeof rawBody === "string" ? rawBody : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That review wasn't valid.",
    };
  }

  const body =
    parsed.data.body && parsed.data.body.length > 0 ? parsed.data.body : null;

  const saved = await prisma.review.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { userId: user.id, productId, rating: parsed.data.rating, body },
    update: { rating: parsed.data.rating, body },
    select: { rating: true, body: true },
  });

  await revalidateProduct(productId);
  return { ok: true, review: saved };
}

export async function deleteReview(
  productId: string,
): Promise<ReviewActionState> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { ok: false, error: "Sign in first." };

  // deleteMany keeps a stale click harmless (no "record not found" throw).
  await prisma.review.deleteMany({ where: { userId: user.id, productId } });

  await revalidateProduct(productId);
  return { ok: true, review: null };
}
