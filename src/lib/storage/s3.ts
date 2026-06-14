import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { S3CompatibleStorage } from "./s3-base";

/*
 * Native AWS S3 adapter — the studio already keeps its assets here, so making
 * S3 the storage backend lets the admin register objects by reference (instant,
 * no re-upload) and stream downloads straight from the existing bucket.
 *
 * S3_ENDPOINT is optional: leave it unset for real AWS, or point it at an
 * S3-compatible service (MinIO, Wasabi, etc.). Returns an unconfigured provider
 * when env vars are absent so the rest of the app keeps working.
 */
export function createS3Storage(): S3CompatibleStorage {
  const bucket = env.S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return new S3CompatibleStorage({ name: "s3", client: null, bucket: null });
  }

  const client = new S3Client({
    region: env.S3_REGION ?? "us-east-1",
    endpoint: env.S3_ENDPOINT ?? undefined,
    // Path-style addressing is friendlier to custom endpoints / buckets with
    // dots; harmless for plain AWS.
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: { accessKeyId, secretAccessKey },
  });

  return new S3CompatibleStorage({ name: "s3", client, bucket });
}
