import "server-only";
import type { MembershipTier } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { memberPriceCents } from "@/lib/membership/tiers";
import { readCartIds } from "./cookie";

/*
 * Resolves the cart cookie's product ids into display-ready line items. Only
 * PUBLISHED products survive, so a product that's since been unpublished/deleted
 * silently drops out of the cart (self-healing). Cart insertion order is
 * preserved. The effective price applies an active discount, and membership is
 * layered on top: covered products cost 0 (included with the plan), everything
 * else gets the member discount for the viewer's tier.
 */

export type CartLine = {
  id: string;
  slug: string;
  title: string;
  type: string;
  currency: string;
  priceCents: number;
  discountCents: number | null;
  effectivePriceCents: number;
  // Membership lens: the lowest tier that includes this product (or null), and
  // what the current viewer actually pays given their tier (0 if included).
  includedInTier: MembershipTier | null;
  memberPriceCents: number;
  thumbUrl: string | null;
};

export type CartSummary = {
  items: CartLine[];
  count: number;
  subtotalCents: number;
  // Membership-aware totals for the viewer.
  memberTier: MembershipTier;
  memberSubtotalCents: number;
  currency: string;
};

export function effectivePriceCents(
  priceCents: number,
  discountCents: number | null,
): number {
  return discountCents != null && discountCents < priceCents
    ? discountCents
    : priceCents;
}

export async function getCart(): Promise<CartSummary> {
  const ids = await readCartIds();
  const session = await auth();
  const memberTier: MembershipTier = session?.user?.membershipTier ?? "FREE";

  if (ids.length === 0) {
    return {
      items: [],
      count: 0,
      subtotalCents: 0,
      memberTier,
      memberSubtotalCents: 0,
      currency: "USD",
    };
  }

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      priceCents: true,
      discountCents: true,
      currency: true,
      includedInTier: true,
      media: {
        where: { kind: "THUMBNAIL" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const items: CartLine[] = ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const eff = effectivePriceCents(r.priceCents, r.discountCents);
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        type: r.type,
        currency: r.currency,
        priceCents: r.priceCents,
        discountCents: r.discountCents,
        effectivePriceCents: eff,
        includedInTier: r.includedInTier,
        memberPriceCents: memberPriceCents(memberTier, eff, r.includedInTier),
        thumbUrl: r.media[0]?.url ?? null,
      };
    });

  const subtotalCents = items.reduce((s, i) => s + i.effectivePriceCents, 0);
  const memberSubtotalCents = items.reduce(
    (s, i) => s + i.memberPriceCents,
    0,
  );
  return {
    items,
    count: items.length,
    subtotalCents,
    memberTier,
    memberSubtotalCents,
    currency: items[0]?.currency ?? "USD",
  };
}
