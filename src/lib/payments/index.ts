import { env } from "@/lib/env";
import type { PaymentProvider } from "./types";
import { StripeProvider } from "./stripe";
import { PaddleProvider } from "./paddle";

export type {
  PaymentProvider,
  NormalizedWebhookEvent,
  CreateCheckoutInput,
  CheckoutLineItem,
} from "./types";

let instance: PaymentProvider | undefined;

/** Factory: provider chosen by PAYMENTS_PROVIDER env. Call sites stay vendor-agnostic. */
export function getPaymentProvider(): PaymentProvider {
  if (!instance) {
    instance =
      env.PAYMENTS_PROVIDER === "paddle"
        ? new PaddleProvider()
        : new StripeProvider();
  }
  return instance;
}
