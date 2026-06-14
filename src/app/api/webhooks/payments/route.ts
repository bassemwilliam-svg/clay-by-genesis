import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { WebhookError } from "@/lib/payments/types";
import {
  fulfillPaidOrder,
  revokeRefundedOrder,
  markOrderFailed,
} from "@/lib/payments/fulfillment";

/*
 * Payment webhook. The provider POSTs here on payment/refund events; this is the
 * ONLY place ownership is granted (never the success redirect). Flow:
 *   raw body -> signature verify -> normalize -> idempotent fulfillment.
 *
 * Needs the Node runtime (Prisma) and the untouched raw body for signature
 * verification, so it never caches and reads req.text() directly.
 *
 * Status semantics for the provider's retry logic:
 *   200 = handled (incl. idempotent no-ops and ignored event types) -> stop.
 *   400 = bad/unsigned payload -> stop (retrying won't help).
 *   503 = webhook secret not provisioned yet -> provider may retry later.
 *   500 = unexpected error mid-fulfillment -> provider SHOULD retry.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const provider = getPaymentProvider();

  let event;
  try {
    event = await provider.verifyAndParseWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookError) {
      if (e.reason === "unconfigured") {
        return NextResponse.json(
          { error: "webhook_unconfigured" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
    console.error("[webhooks/payments] verify failed", e);
    return NextResponse.json({ error: "verify_failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment.succeeded": {
        const result = await fulfillPaidOrder({
          orderId: event.orderId,
          providerSessionId: event.providerSessionId,
          providerPaymentId: event.providerPaymentId,
        });
        if (result.status === "order_not_found") {
          // Nothing to grant against. Don't make the provider retry forever.
          console.warn("[webhooks/payments] no matching order", {
            rawType: event.rawType,
            providerSessionId: event.providerSessionId,
            orderId: event.orderId,
          });
          return NextResponse.json({ received: true, matched: false });
        }
        return NextResponse.json({ received: true, ...result });
      }

      case "refund.succeeded": {
        if (!event.providerPaymentId) {
          return NextResponse.json({ received: true, matched: false });
        }
        const result = await revokeRefundedOrder(event.providerPaymentId);
        return NextResponse.json({ received: true, ...result });
      }

      case "payment.failed": {
        await markOrderFailed({
          orderId: event.orderId,
          providerSessionId: event.providerSessionId,
          providerPaymentId: event.providerPaymentId,
        });
        return NextResponse.json({ received: true });
      }

      default:
        // Unhandled event type: acknowledge so the provider stops resending.
        return NextResponse.json({ received: true, ignored: event.rawType });
    }
  } catch (e) {
    // Unexpected failure mid-pipeline: 500 so the provider retries the delivery.
    console.error("[webhooks/payments] processing failed", e);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
