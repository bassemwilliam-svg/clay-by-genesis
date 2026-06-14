import Link from "next/link";
import type { MembershipTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { setMembershipTier } from "@/lib/membership/actions";
import { TIER_LABEL, TIER_RANK } from "@/lib/membership/tiers";

/*
 * Per-tier call to action on the pricing page. Server component: it renders the
 * right control for the viewer's state. Signed-out viewers go to login; signed-
 * in viewers get a form posting to the (dev-gated) subscribe action, with the
 * label reflecting upgrade / downgrade / current-plan.
 */
export function PricingCta({
  tier,
  currentTier,
  defaultCta,
  featured,
}: {
  tier: MembershipTier;
  currentTier: MembershipTier | null;
  defaultCta: string;
  featured?: boolean;
}) {
  const variant = featured ? "default" : "outline";

  if (!currentTier) {
    return (
      <Button asChild className="mt-8" variant={variant}>
        <Link href="/login">{defaultCta}</Link>
      </Button>
    );
  }

  if (currentTier === tier) {
    return (
      <Button disabled className="mt-8" variant="outline">
        Current plan
      </Button>
    );
  }

  const isUpgrade = TIER_RANK[tier] > TIER_RANK[currentTier];
  const label =
    tier === "FREE"
      ? "Switch to Free"
      : isUpgrade
        ? `Get ${TIER_LABEL[tier]}`
        : `Switch to ${TIER_LABEL[tier]}`;

  return (
    <form action={setMembershipTier} className="mt-8">
      <input type="hidden" name="tier" value={tier} />
      <Button type="submit" className="w-full" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
