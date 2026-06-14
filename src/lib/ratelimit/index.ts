import "server-only";
import { env } from "@/lib/env";
import type { RateLimiter } from "./types";
import { UpstashRateLimiter } from "./upstash";

export type { RateLimiter, RateLimitOptions, RateLimitResult } from "./types";

// `null` = resolved-but-unconfigured (cached); `undefined` = not yet resolved.
let instance: RateLimiter | null | undefined;

/**
 * Returns the configured rate limiter, or null when Upstash isn't provisioned.
 * Callers treat null as "no limiting" so the app runs locally without Redis,
 * the same graceful-degrade shape as getMailer()/getEmbedder().
 */
export function getRateLimiter(): RateLimiter | null {
  if (instance === undefined) {
    instance =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new UpstashRateLimiter(
            env.UPSTASH_REDIS_REST_URL,
            env.UPSTASH_REDIS_REST_TOKEN,
          )
        : null;
  }
  return instance;
}
