/*
 * Rate-limit port (hexagonal). Callers depend on this interface only, never on
 * a concrete backend. Pure module (no server-only) so the types can be shared;
 * the Upstash adapter and the factory carry the server-only marker.
 */

export interface RateLimitOptions {
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in seconds (fixed window). */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** False once the caller has exceeded the limit for the current window. */
  success: boolean;
  limit: number;
  /** Requests still allowed in the current window (never negative). */
  remaining: number;
  /** Seconds until the window resets (when the count is forgiven). */
  resetSeconds: number;
}

export interface RateLimiter {
  readonly name: string;
  /** Count one hit against `key` and report whether it is within the limit. */
  limit(key: string, opts: RateLimitOptions): Promise<RateLimitResult>;
}
