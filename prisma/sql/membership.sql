-- Genesis Forge — membership (Free / Pro / Studio) schema additions.
--
-- Applied to the drifted dev DB without a destructive reset (the dev data +
-- active preview session must survive). Mirrors the Prisma model changes:
--   - new enum MembershipTier { FREE PRO STUDIO }
--   - EntitlementSource gains MEMBERSHIP
--   - User.membershipTier  (default FREE)
--   - Product.includedInTier (nullable)
--   - index Product(status, includedInTier)
--
-- Idempotent: safe to re-run.
--
--   npx prisma db execute --file prisma/sql/membership.sql --schema prisma/schema.prisma

-- New enum type (no CREATE TYPE IF NOT EXISTS in Postgres, so guard it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipTier') THEN
    CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'PRO', 'STUDIO');
  END IF;
END
$$;

-- Add the MEMBERSHIP source to the existing entitlement enum.
ALTER TYPE "EntitlementSource" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';

-- Subscriber tier on the user.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "membershipTier" "MembershipTier" NOT NULL DEFAULT 'FREE';

-- Lowest tier that includes the product for free (null = à la carte only).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "includedInTier" "MembershipTier";

-- Filter/admin index.
CREATE INDEX IF NOT EXISTS "Product_status_includedInTier_idx"
  ON "Product" ("status", "includedInTier");
