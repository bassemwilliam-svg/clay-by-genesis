import type { MembershipTier } from "@prisma/client";

/*
 * Membership tiers — the single place the Free/Pro/Studio rules live.
 *
 * Pure, dependency-free, and safe to import from both client and server. Tier
 * coverage and member pricing are *derived* from an ordered rank, so STUDIO
 * automatically includes everything PRO does without enumerating products.
 *
 * Real billing is wired through the payments abstraction later (Stage 8-ish);
 * until then a subscriber's tier is set by a dev-gated action and the
 * membership-included catalog is materialized as MEMBERSHIP-source entitlements.
 */

/** Higher rank = more inclusive. STUDIO ⊇ PRO ⊇ FREE. */
export const TIER_RANK: Record<MembershipTier, number> = {
  FREE: 0,
  PRO: 1,
  STUDIO: 2,
};

/** Percent off à la carte prices for members at each tier. */
export const MEMBER_DISCOUNT_PCT: Record<MembershipTier, number> = {
  FREE: 0,
  PRO: 15,
  STUDIO: 30,
};

export const TIER_LABEL: Record<MembershipTier, string> = {
  FREE: "Free",
  PRO: "Pro",
  STUDIO: "Studio",
};

export const ALL_TIERS: MembershipTier[] = ["FREE", "PRO", "STUDIO"];

/**
 * Does a subscriber at `userTier` get a product (whose inclusion floor is
 * `includedInTier`) for free? A product included at PRO is also free for STUDIO.
 * `includedInTier === null` means à la carte only — never covered.
 */
export function tierCoversProduct(
  userTier: MembershipTier,
  includedInTier: MembershipTier | null,
): boolean {
  if (includedInTier === null) return false;
  return TIER_RANK[userTier] >= TIER_RANK[includedInTier];
}

/**
 * Price a buyer at `userTier` pays for a product with the given list/discount
 * price. Member discount stacks on top of any product-level sale (applied to
 * the already-effective price), then rounds to whole cents. Returns 0 when the
 * tier includes the product outright.
 */
export function memberPriceCents(
  userTier: MembershipTier,
  effectiveCents: number,
  includedInTier: MembershipTier | null,
): number {
  if (tierCoversProduct(userTier, includedInTier)) return 0;
  const pct = MEMBER_DISCOUNT_PCT[userTier];
  if (pct === 0) return effectiveCents;
  return Math.round(effectiveCents * (1 - pct / 100));
}

/** Tiers whose subscribers get a product included at `floor` for free. */
export function tiersThatCover(floor: MembershipTier): MembershipTier[] {
  return ALL_TIERS.filter((t) => TIER_RANK[t] >= TIER_RANK[floor]);
}

/** Inclusion floors a subscriber at `userTier` qualifies for, free of charge. */
export function inclusionFloorsCoveredBy(
  userTier: MembershipTier,
): MembershipTier[] {
  return ALL_TIERS.filter((t) => TIER_RANK[t] <= TIER_RANK[userTier]);
}
