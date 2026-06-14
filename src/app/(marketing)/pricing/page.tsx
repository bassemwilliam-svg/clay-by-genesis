import type { Metadata } from "next";
import type { MembershipTier } from "@prisma/client";
import { auth } from "@/lib/auth";
import { PricingCta } from "@/components/marketing/pricing-cta";

export const metadata: Metadata = {
  title: "Membership · Clay",
  description:
    "Free, Pro, and Studio plans. Buy à la carte or subscribe for free assets, free courses, member pricing, and unlimited Atlas.",
};

// Reads the signed-in viewer's tier to tailor each CTA.
export const dynamic = "force-dynamic";

type Tier = {
  id: string;
  tier: MembershipTier;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  cta: string;
  featured?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "free",
    tier: "FREE",
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Browse the full catalog and buy what you need, one asset at a time.",
    cta: "Create a free account",
    features: [
      "Full catalog access",
      "Buy any asset or course à la carte",
      "Try Atlas with a few project briefs a day",
      "Secure, versioned downloads of what you own",
    ],
  },
  {
    id: "pro",
    tier: "PRO",
    name: "Pro",
    price: "$19",
    cadence: "per month",
    tagline: "For working creators who pull from the catalog every week.",
    cta: "Get Pro",
    featured: true,
    features: [
      "Everything in Free",
      "Unlimited Atlas, the project guide",
      "A rotating set of free assets every month",
      "Selected courses included at no extra cost",
      "15% member pricing on every purchase",
    ],
  },
  {
    id: "studio",
    tier: "STUDIO",
    name: "Studio",
    price: "$49",
    cadence: "per month",
    tagline: "For teams shipping more than one project at a time.",
    cta: "Get Studio",
    features: [
      "Everything in Pro",
      "The full member asset library, free to download",
      "Every course included",
      "30% member pricing on every purchase",
      "Priority Atlas and early access to new kits",
    ],
  },
];

export default async function PricingPage() {
  const session = await auth();
  const currentTier = session?.user?.membershipTier ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10">
      <div className="max-w-2xl">
        <span className="mono-label">Membership</span>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Own a few assets, or the whole workflow.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Buy à la carte whenever you like. Or subscribe and get a curated set
          of assets and courses for free, member pricing on everything else, and
          unlimited time with Atlas.
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`flex flex-col bg-background p-8 ${
              tier.featured ? "ring-1 ring-inset ring-primary/50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="mono-label">{tier.name}</span>
              {tier.featured ? (
                <span className="mono-label border border-primary/50 px-2 py-0.5 text-primary">
                  Most popular
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {tier.cadence}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{tier.tagline}</p>

            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <PricingCta
              tier={tier.tier}
              currentTier={currentTier}
              defaultCta={tier.cta}
              featured={tier.featured}
            />
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Free assets and courses for members are curated by the Clay team and
        refresh over time. Member pricing applies automatically at checkout.
        Membership billing is rolling out, create an account to get started.
      </p>

      {/* What membership unlocks, in plain terms. */}
      <section className="mt-16 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
        {[
          {
            code: "M-01",
            title: "Free assets and courses",
            body: "Members get a curated, rotating set of assets and selected courses at no extra cost, picked by the studio.",
          },
          {
            code: "M-02",
            title: "Member pricing",
            body: "Pro and Studio members get a standing discount on everything else in the catalog, applied at checkout.",
          },
          {
            code: "M-03",
            title: "Atlas, unlocked",
            body: "Describe a project and Atlas maps it to a buildable shortlist from the catalog, unlimited on paid plans.",
          },
        ].map((b) => (
          <div key={b.code} className="bg-background p-6">
            <span className="mono-label text-primary/70">{b.code}</span>
            <h3 className="mt-3 font-medium">{b.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
