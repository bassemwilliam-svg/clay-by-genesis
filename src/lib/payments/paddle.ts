import { env } from "@/lib/env";
import type {
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  NormalizedWebhookEvent,
  RefundResult,
} from "./types";

/*
 * Paddle adapter, added later for merchant-of-record / global tax handling.
 * Stub now so switching providers is a one-line factory change (Stage 12).
 */
export class PaddleProvider implements PaymentProvider {
  readonly name = "paddle" as const;

  isConfigured(): boolean {
    return Boolean(env.PADDLE_API_KEY);
  }

  async createCheckoutSession(
    _input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    throw new Error("PaddleProvider.createCheckoutSession not implemented");
  }

  async verifyAndParseWebhook(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<NormalizedWebhookEvent> {
    throw new Error("PaddleProvider.verifyAndParseWebhook not implemented");
  }

  async refund(
    _providerPaymentId: string,
    _amountCents?: number,
  ): Promise<RefundResult> {
    throw new Error("PaddleProvider.refund not implemented");
  }
}
