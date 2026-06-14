import { z } from "zod";

/*
 * Single configuration boundary. Nothing else in the app reads process.env
 * directly, they import `env` or call `requireEnv`. This keeps vendor
 * coupling at the edge and lets us tighten/relax requirements per milestone.
 *
 * Integration vars are `.optional()` for now (services not yet provisioned).
 * As each stage wires its provider, promote that var to required here.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Core
  DATABASE_URL: z.url().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.url().optional(),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),

  // Storage backend selector. Both adapters speak S3; "r2" targets Cloudflare
  // R2, "s3" targets native AWS S3 (where the studio already keeps its assets).
  STORAGE_PROVIDER: z.enum(["r2", "s3"]).default("r2"),

  // Storage (Cloudflare R2, S3-compatible), Stage 3
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.url().optional(),

  // Storage (AWS S3 — the studio's existing asset bucket). S3_ENDPOINT is
  // optional so the same adapter also serves S3-compatible vendors (MinIO etc).
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.url().optional(),
  // Default destination for "copy files back to S3" exports (overridable in UI).
  S3_EXPORT_BUCKET: z.string().optional(),

  // Payments, Stage 7/8
  PAYMENTS_PROVIDER: z.enum(["stripe", "paddle"]).default("stripe"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),

  // AI concierge, Stage 6
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),

  // Email: Resend, Stage 8. EMAIL_FROM must be a Resend-verified sender; until
  // a key + domain are provisioned, receipts no-op (logged, never sent).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Rate limiting: Upstash Redis, Stage 9
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Course video: YouTube Data API, Stage 10
  YOUTUBE_DATA_API_KEY: z.string().optional(),
});

function parseEnv() {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  if (process.env.SKIP_ENV_VALIDATION !== "1") {
    console.warn("[env] Validation issues:", z.treeifyError(parsed.error));
  }
  // Fall back to defaults so dev/build can boot before services are wired.
  return schema.parse({ NODE_ENV: process.env.NODE_ENV });
}

export const env = parseEnv();

/** Assert a runtime-required var is present, with a clear error at the boundary. */
export function requireEnv<K extends keyof typeof env>(
  key: K,
): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
