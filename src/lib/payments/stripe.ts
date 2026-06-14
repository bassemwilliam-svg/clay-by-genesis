import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import {
  WebhookError,
  type PaymentProvider,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type NormalizedWebhookEvent,
  type RefundResult,
} from "./types";

/*
 * Stripe adapter, default provider. createCheckoutSession (Stage 7) plus
 * signature-verified webhook parsing and refunds (Stage 8). The SDK client is
 * created lazily so the app boots without a key, and `isConfigured()` lets call
 * sites degrade gracefully before keys exist.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  private client: Stripe | undefined;

  isConfigured(): boolean {
    return Boolean(env.STRIPE_SECRET_KEY);
  }

  private stripe(): Stripe {
    if (!this.client) {
      const key = env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
      }
      this.client = new Stripe(key);
    }
    return this.client;
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const session = await this.stripe().checkout.sessions.create({
      mode: "payment",
      line_items: input.lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: li.priceCents,
          product_data: { name: li.title },
        },
      })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orderId,
      customer_email: input.customerEmail,
      // Carried back on the webhook so entitlement granting can find the order
      // without trusting the success redirect.
      metadata: { orderId: input.orderId },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return { providerSessionId: session.id, redirectUrl: session.url };
  }

  /*
   * Verify the Stripe signature against the raw body, then collapse Stripe's
   * many event types onto our small normalized set. We only act on a handful;
   * everything else maps to "unhandled" so the route can 200-and-ignore it.
   */
  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<NormalizedWebhookEvent> {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new WebhookError("unconfigured");

    const signature = headers["stripe-signature"] ?? headers["Stripe-Signature"];
    if (!signature) throw new WebhookError("invalid_signature", "Missing stripe-signature header");

    let event: Stripe.Event;
    try {
      // Async variant works regardless of runtime (uses WebCrypto under the hood).
      event = await this.stripe().webhooks.constructEventAsync(
        rawBody,
        signature,
        secret,
      );
    } catch (e) {
      throw new WebhookError(
        "invalid_signature",
        e instanceof Error ? e.message : "Signature verification failed",
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only a paid session grants ownership (a $0 order is also "paid").
        if (session.payment_status !== "unpaid") {
          return {
            type: "payment.succeeded",
            providerSessionId: session.id,
            providerPaymentId: stripeId(session.payment_intent) ?? session.id,
            orderId: session.metadata?.orderId ?? session.client_reference_id ?? undefined,
            amountCents: session.amount_total ?? undefined,
            currency: session.currency?.toUpperCase(),
            rawType: event.type,
          };
        }
        return { type: "unhandled", rawType: event.type };
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: "payment.failed",
          providerSessionId: session.id,
          providerPaymentId: stripeId(session.payment_intent) ?? undefined,
          orderId: session.metadata?.orderId ?? session.client_reference_id ?? undefined,
          rawType: event.type,
        };
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        return {
          type: "payment.failed",
          providerPaymentId: pi.id,
          orderId: pi.metadata?.orderId ?? undefined,
          rawType: event.type,
        };
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        return {
          type: "refund.succeeded",
          providerPaymentId: stripeId(charge.payment_intent) ?? undefined,
          amountCents: charge.amount_refunded,
          currency: charge.currency?.toUpperCase(),
          rawType: event.type,
        };
      }

      default:
        return { type: "unhandled", rawType: event.type };
    }
  }

  async refund(
    providerPaymentId: string,
    amountCents?: number,
  ): Promise<RefundResult> {
    const refund = await this.stripe().refunds.create({
      payment_intent: providerPaymentId,
      ...(amountCents !== undefined ? { amount: amountCents } : {}),
    });
    return { ok: refund.status === "succeeded" || refund.status === "pending", refundId: refund.id };
  }
}

/** Stripe expandable fields arrive as a string id or an expanded object. */
function stripeId(
  value: string | { id: string } | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}
