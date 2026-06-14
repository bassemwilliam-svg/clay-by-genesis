"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { syncUserMembershipEntitlements } from "./entitlements";
import { ALL_TIERS } from "./tiers";

/*
 * Dev-only self-serve subscription. Sets the signed-in user's tier and
 * reconciles their MEMBERSHIP-source entitlements so the included catalog
 * appears in their library immediately.
 *
 * Hard-gated to non-production: in a deployed build, tier changes must come
 * from the payment provider (an entitlement of a paid plan), never from a free
 * button. The DB session strategy reads membershipTier fresh on each auth()
 * call, so no session re-mint is needed for the new tier to take effect.
 */
export async function setMembershipTier(formData: FormData): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Self-serve subscription is disabled in production; tiers are granted by the payment provider.",
    );
  }

  const user = await requireUser();
  const raw = formData.get("tier");
  const tier = ALL_TIERS.find((t) => t === raw);
  if (!tier) {
    throw new Error("Invalid membership tier.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { membershipTier: tier },
  });
  await syncUserMembershipEntitlements(user.id);

  revalidatePath("/pricing");
  revalidatePath("/account/library");
  revalidatePath("/cart");
}
