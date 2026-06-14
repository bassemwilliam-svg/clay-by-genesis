import "server-only";
import type { MembershipTier } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { inclusionFloorsCoveredBy, tiersThatCover } from "./tiers";

/*
 * Membership → Entitlement reconciliation.
 *
 * Keeping Entitlement as the single source of truth for ownership means a
 * tier-included product must materialize as an actual Entitlement row (so the
 * library, course player, downloads, and checkout dedupe all "just work"). We
 * tag those rows `source = MEMBERSHIP` and only ever touch MEMBERSHIP rows here,
 * so a buyer's PURCHASE/BUNDLE/GRANT ownership is never granted, revoked, or
 * overwritten by membership changes.
 *
 * Bundles fan out. A BUNDLE has no asset of its own; its value is its members.
 * So when a tier includes a bundle, subscribers must receive the bundle's
 * member products too, exactly as a *purchase* of that bundle fans out (see
 * payments/fulfillment). A product is therefore membership-covered if it is
 * included directly OR it is a member of an included (published) bundle. As with
 * the purchase fan-out, a member is granted regardless of its own draft/archived
 * status; the bundle being published + included is the gate.
 *
 * The unique [userId, productId] constraint means a user has at most one row
 * per product. We therefore:
 *   - createMany(skipDuplicates) to grant — skipping anyone who already owns it
 *     via another source (their existing row stands; no duplicate, no clobber);
 *   - un-revoke previously-revoked MEMBERSHIP rows that are covered again;
 *   - soft-revoke (revokedAt = now) MEMBERSHIP rows no longer covered.
 *
 * Both directions run on the events that change coverage: a user's tier
 * changing, a product's inclusion floor / publish state changing, and a bundle's
 * membership changing.
 */

/**
 * Tiers whose subscribers should hold a MEMBERSHIP entitlement for this product,
 * accounting for both direct inclusion and inclusion via any published bundle
 * the product belongs to. Empty = not membership-covered by any tier.
 */
async function tiersThatCoverProduct(
  productId: string,
): Promise<MembershipTier[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      includedInTier: true,
      memberOfBundle: {
        select: { bundle: { select: { status: true, includedInTier: true } } },
      },
    },
  });
  if (!product) return [];

  // Inclusion floors that reach this product, via any covering path.
  const floors: MembershipTier[] = [];
  if (product.status === "PUBLISHED" && product.includedInTier !== null) {
    floors.push(product.includedInTier);
  }
  for (const { bundle } of product.memberOfBundle) {
    if (bundle.status === "PUBLISHED" && bundle.includedInTier !== null) {
      floors.push(bundle.includedInTier);
    }
  }
  if (floors.length === 0) return [];

  const covered = new Set<MembershipTier>();
  for (const floor of floors) {
    for (const tier of tiersThatCover(floor)) covered.add(tier);
  }
  return [...covered];
}

/** Grant/un-revoke/revoke MEMBERSHIP rows for one product across all users. */
async function reconcileProductForTiers(
  productId: string,
  covered: MembershipTier[],
): Promise<void> {
  if (covered.length === 0) {
    // No tier covers it: drop every MEMBERSHIP grant for this product.
    await prisma.entitlement.updateMany({
      where: { productId, source: "MEMBERSHIP", revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }

  const subscribers = await prisma.user.findMany({
    where: { membershipTier: { in: covered } },
    select: { id: true },
  });
  const subscriberIds = subscribers.map((u) => u.id);

  if (subscriberIds.length > 0) {
    await prisma.entitlement.createMany({
      data: subscriberIds.map((userId) => ({
        userId,
        productId,
        source: "MEMBERSHIP" as const,
      })),
      skipDuplicates: true,
    });
    await prisma.entitlement.updateMany({
      where: {
        productId,
        source: "MEMBERSHIP",
        userId: { in: subscriberIds },
        revokedAt: { not: null },
      },
      data: { revokedAt: null },
    });
  }

  // Revoke MEMBERSHIP grants from users whose tier no longer qualifies.
  await prisma.entitlement.updateMany({
    where: {
      productId,
      source: "MEMBERSHIP",
      revokedAt: null,
      ...(subscriberIds.length > 0 ? { userId: { notIn: subscriberIds } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

/** Reconcile one subscriber's MEMBERSHIP entitlements after a tier change. */
export async function syncUserMembershipEntitlements(
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { membershipTier: true },
  });
  if (!user) return;

  // Published products the tier includes directly (drafts/archived never
  // granted), plus the members of any included bundle (fanned out like a buy).
  const floors = inclusionFloorsCoveredBy(user.membershipTier);
  const directlyCovered = await prisma.product.findMany({
    where: { status: "PUBLISHED", includedInTier: { in: floors } },
    select: { id: true, type: true, bundleItems: { select: { memberId: true } } },
  });

  const coveredIds = new Set<string>();
  for (const p of directlyCovered) {
    coveredIds.add(p.id);
    if (p.type === "BUNDLE") {
      for (const { memberId } of p.bundleItems) coveredIds.add(memberId);
    }
  }
  const ids = [...coveredIds];

  if (ids.length > 0) {
    await prisma.entitlement.createMany({
      data: ids.map((productId) => ({
        userId,
        productId,
        source: "MEMBERSHIP" as const,
      })),
      skipDuplicates: true,
    });
    await prisma.entitlement.updateMany({
      where: {
        userId,
        source: "MEMBERSHIP",
        productId: { in: ids },
        revokedAt: { not: null },
      },
      data: { revokedAt: null },
    });
  }

  // Revoke any active MEMBERSHIP rows the tier no longer covers.
  await prisma.entitlement.updateMany({
    where: {
      userId,
      source: "MEMBERSHIP",
      revokedAt: null,
      ...(ids.length > 0 ? { productId: { notIn: ids } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * Reconcile every subscriber's access to one product after it changes. If the
 * product is a bundle, its members' coverage hinges on it, so each member is
 * reconciled too (recomputing that member's full set of covering tiers).
 */
export async function syncProductMembershipEntitlements(
  productId: string,
): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { type: true, bundleItems: { select: { memberId: true } } },
  });
  if (!product) return;

  await reconcileProductForTiers(
    productId,
    await tiersThatCoverProduct(productId),
  );

  if (product.type === "BUNDLE") {
    for (const { memberId } of product.bundleItems) {
      await reconcileProductForTiers(
        memberId,
        await tiersThatCoverProduct(memberId),
      );
    }
  }
}
