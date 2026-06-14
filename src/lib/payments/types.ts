/*
 * Payments port. Nothing outside this folder imports Stripe or Paddle. The
 * provider is chosen by env via the factory in ./index. Entitlement granting
 * is driven by the normalized webhook event, never by the success redirect.
 */

export type PaymentProviderName = "stripe" | "paddle";

export interface CheckoutLineItem {
  productId: string;
  title: string;
  priceCents: number;
  quantity: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  currency: string;
  lineItems: CheckoutLineItem[];
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  providerSessionId: string;
  redirectUrl: string;
}

export type NormalizedWebhookType =
  | "payment.succeeded"
  | "payment.failed"
  | "refund.succeeded"
  | "unhandled";

export interface NormalizedWebhookEvent {
  type: NormalizedWebhookType;
  /** Stable id used as the idempotency key for entitlement granting. */
  providerPaymentId?: string;
  providerSessionId?: string;
  /**
   * Our own Order id, carried back from checkout metadata. Lets the pipeline
   * find the order without trusting the success redirect or a session lookup.
   */
  orderId?: string;
  amountCents?: number;
  currency?: string;
  /** Raw provider event type, kept for logging/diagnostics. */
  rawType: string;
}

export type WebhookErrorReason = "unconfigured" | "invalid_signature";

/*
 * Thrown by verifyAndParseWebhook so the route can respond precisely:
 * `unconfigured` (no webhook secret yet) -> 503, `invalid_signature` -> 400.
 * Anything else bubbles up as a 500 so the provider retries.
 */
export class WebhookError extends Error {
  constructor(
    readonly reason: WebhookErrorReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "WebhookError";
  }
}

export interface RefundResult {
  ok: boolean;
  refundId?: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /**
   * Whether this provider has the credentials it needs to take payment. Lets
   * call sites degrade gracefully (no orphan PENDING orders) before the keys
   * are provisioned, instead of throwing mid-checkout.
   */
  isConfigured(): boolean;

  createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult>;

  /** Verify signature against the raw body, then normalize the event. */
  verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<NormalizedWebhookEvent>;

  refund(
    providerPaymentId: string,
    amountCents?: number,
  ): Promise<RefundResult>;
}
