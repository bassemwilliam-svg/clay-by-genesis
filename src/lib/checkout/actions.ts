"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth-guards";
import { getPaymentProvider } from "@/lib/payments";
import { readCartIds } from "@/lib/cart/cookie";
import { effectivePriceCents } from "@/lib/cart/queries";
import { memberPriceCents, tierCoversProduct } from "@/lib/membership/tiers";
import { getBaseUrl } from "@/lib/url";
import type { PaymentProviderName } from "@prisma/client";
import type { CheckoutState } from "./types";
import type { CheckoutLineItem } from "@/lib/payments";

/*
 * Starts a checkout: validates the cart against the live catalog + the buyer's
 * existing entitlements, creates a PENDING Order (the durable record the
 * webhook will later mark PAID), opens a provider session, and redirects to it.
 *
 * Entitlement granting is webhook-driven (Stage 8), so this never grants
 * ownership or clears the cart, a cancelled checkout returns to an intact
 * cart. We only create the order once the provider is configured, to avoid
 * orphan PENDING rows while payments are still code-first.
 */
export async function startCheckout(
  _prev: CheckoutState,
  _formData: FormData,
): Promise<CheckoutState> {
  const user = await requireUser();
  const provider = getPaymentProvider();

  if (!provider.isConfigured()) {
    return {
      error:
        "Checkout isn't configured yet, payments are coming soon. Your cart is saved.",
    };
  }

  const ids = await readCartIds();
  if (ids.length === 0) {
    return { error: "Your cart is empty." };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      priceCents: true,
      discountCents: true,
      currency: true,
      includedInTier: true,
    },
  });

  // Drop anything the buyer already owns (a digital good is bought once) and
  // anything their membership tier includes outright (covered → free, not a
  // line item). Membership-covered products normally already carry a
  // MEMBERSHIP entitlement, but this guards the edge case either way.
  const owned = await prisma.entitlement.findMany({
    where: { userId: user.id, productId: { in: ids }, revokedAt: null },
    select: { productId: true },
  });
  const ownedIds = new Set(owned.map((e) => e.productId));
  const tier = user.membershipTier;
  const purchasable = products.filter(
    (p) => !ownedIds.has(p.id) && !tierCoversProduct(tier, p.includedInTier),
  );

  if (purchasable.length === 0) {
    return { error: "You already own everything in your cart." };
  }

  const currency = purchasable[0].currency;
  if (purchasable.some((p) => p.currency !== currency)) {
    return {
      error: "Your cart mixes currencies, please check out one currency at a time.",
    };
  }

  const lineItems: CheckoutLineItem[] = purchasable.map((p) => ({
    productId: p.id,
    title: p.title,
    priceCents: memberPriceCents(
      tier,
      effectivePriceCents(p.priceCents, p.discountCents),
      p.includedInTier,
    ),
    quantity: 1,
  }));
  const subtotalCents = lineItems.reduce((s, li) => s + li.priceCents, 0);

  const providerName: PaymentProviderName =
    provider.name === "paddle" ? "PADDLE" : "STRIPE";

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PENDING",
      provider: providerName,
      currency,
      subtotalCents,
      totalCents: subtotalCents,
      items: {
        create: lineItems.map((li) => ({
          productId: li.productId,
          titleSnapshot: li.title,
          priceCents: li.priceCents,
          quantity: li.quantity,
        })),
      },
    },
    select: { id: true },
  });

  const baseUrl = await getBaseUrl();
  const session = await provider.createCheckoutSession({
    orderId: order.id,
    currency,
    lineItems,
    customerEmail: user.email ?? undefined,
    successUrl: `${baseUrl}/checkout/success?order=${order.id}`,
    cancelUrl: `${baseUrl}/cart`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { providerSessionId: session.providerSessionId },
  });

  redirect(session.redirectUrl);
}
