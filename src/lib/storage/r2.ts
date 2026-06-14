import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { S3CompatibleStorage } from "./s3-base";

/*
 * Cloudflare R2 adapter. R2 is S3-compatible, so it just constructs an S3
 * client pointed at the R2 endpoint (region "auto") and hands it to the shared
 * S3CompatibleStorage implementation. Returns an unconfigured provider (rather
 * than throwing) when the R2 env vars are absent, so the app still boots.
 */
export function createR2Storage(): S3CompatibleStorage {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return new S3CompatibleStorage({ name: "r2", client: null, bucket: null });
  }

  const client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return new S3CompatibleStorage({ name: "r2", client, bucket });
}
