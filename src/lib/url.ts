import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/*
 * Absolute base URL for building provider return URLs (Stripe success/cancel).
 * Prefers the configured public site URL; falls back to the request's own
 * host/proto headers so it works in local dev and preview deploys.
 */
export async function getBaseUrl(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) {
    return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
