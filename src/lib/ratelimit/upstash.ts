import "server-only";
import type { RateLimiter, RateLimitOptions, RateLimitResult } from "./types";

/*
 * Fixed-window rate limiter backed by Upstash Redis over its REST API. We hit
 * the REST endpoint with `fetch` rather than pulling in @upstash/redis, matching
 * the SDK-free adapter pattern used for Resend and the Voyage embedder.
 *
 * One atomic pipeline does the whole window accounting:
 *   INCR key                  -> running count for this window
 *   EXPIRE key window NX      -> arm the TTL only on the first hit (NX), so the
 *                                window starts when the first request lands and
 *                                isn't pushed forward by later hits
 *   PTTL key                  -> ms remaining, surfaced as resetSeconds
 *
 * Fail-open: a rate-limit backend is a protective layer, not an authorization
 * gate. If Upstash is unreachable we log and allow the request rather than
 * breaking downloads on an unrelated outage.
 */
export class UpstashRateLimiter implements RateLimiter {
  readonly name = "upstash";

  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
  ) {}

  async limit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    try {
      const res = await fetch(`${this.restUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, opts.windowSeconds, "NX"],
          ["PTTL", redisKey],
        ]),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Upstash responded ${res.status}`);
      }
      const data = (await res.json()) as { result?: number; error?: string }[];
      const count = Number(data[0]?.result ?? 0);
      const pttlMs = Number(data[2]?.result ?? 0);
      const resetSeconds =
        pttlMs > 0 ? Math.ceil(pttlMs / 1000) : opts.windowSeconds;

      return {
        success: count <= opts.limit,
        limit: opts.limit,
        remaining: Math.max(0, opts.limit - count),
        resetSeconds,
      };
    } catch (e) {
      console.error("[ratelimit] Upstash error, failing open:", e);
      return {
        success: true,
        limit: opts.limit,
        remaining: opts.limit,
        resetSeconds: 0,
      };
    }
  }
}
