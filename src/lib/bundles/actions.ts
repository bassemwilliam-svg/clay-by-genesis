"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth-guards";
import { syncProductMembershipEntitlements } from "@/lib/membership/entitlements";

/*
 * Bundle membership write boundary. A bundle is a Product(type=BUNDLE); its
 * members are the products a buyer receives when they purchase it. Entitlements
 * fan out to each member in the payment webhook (see payments/fulfillment), so
 * this module only edits the BundleItem join rows; ownership is materialized
 * later, at payment time.
 *
 * Invariant enforced here: members are never themselves bundles. That keeps the
 * graph exactly one level deep, which means no cycles and no recursive fan-out
 * to reason about downstream.
 *
 * Like the product actions, `addBundleMember` returns a `useActionState` shape so
 * the admin UI can render the validation message inline; removal is a plain form
 * action (it can't meaningfully fail for the editor).
 */

export type BundleActionState = { ok: boolean; error?: string };

const memberIdSchema = z.string().min(1, "Pick a product to add.");

export async function addBundleMember(
  bundleId: string,
  _prev: BundleActionState,
  formData: FormData,
): Promise<BundleActionState> {
  await requireRole("EDITOR");

  const parsed = memberIdSchema.safeParse(formData.get("memberId"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  }
  const memberId = parsed.data;

  if (memberId === bundleId) {
    return { ok: false, error: "A bundle can't contain itself." };
  }

  const [bundle, member] = await Promise.all([
    prisma.product.findUnique({
      where: { id: bundleId },
      select: { type: true, slug: true },
    }),
    prisma.product.findUnique({
      where: { id: memberId },
      select: { type: true },
    }),
  ]);

  if (!bundle || bundle.type !== "BUNDLE") {
    return { ok: false, error: "This product isn't a bundle." };
  }
  if (!member) {
    return { ok: false, error: "That product no longer exists." };
  }
  if (member.type === "BUNDLE") {
    return { ok: false, error: "Bundles can't be nested inside other bundles." };
  }

  // The composite primary key makes re-adding an existing member a no-op rather
  // than a unique-constraint error.
  await prisma.bundleItem.upsert({
    where: { bundleId_memberId: { bundleId, memberId } },
    create: { bundleId, memberId },
    update: {},
  });

  // If the bundle is membership-included, this member is now covered for those
  // subscribers; reconcile so their MEMBERSHIP entitlements reflect it.
  await syncProductMembershipEntitlements(memberId);

  revalidatePath(`/admin/products/${bundleId}/edit`);
  revalidatePath(`/products/${bundle.slug}`);
  return { ok: true };
}

export async function removeBundleMember(
  bundleId: string,
  memberId: string,
): Promise<void> {
  await requireRole("EDITOR");

  const bundle = await prisma.product.findUnique({
    where: { id: bundleId },
    select: { slug: true },
  });

  // deleteMany (not delete) so a stale click on an already-removed row is a
  // harmless no-op instead of a "record not found" throw.
  await prisma.bundleItem.deleteMany({ where: { bundleId, memberId } });

  // The member may have lost its only membership-coverage path; reconcile so any
  // now-uncovered MEMBERSHIP grants are revoked (unless covered another way).
  await syncProductMembershipEntitlements(memberId);

  revalidatePath(`/admin/products/${bundleId}/edit`);
  if (bundle) revalidatePath(`/products/${bundle.slug}`);
}
