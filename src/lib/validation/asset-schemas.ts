import { z } from "zod";
import { cuid } from "@/lib/validation/common";

/*
 * Asset-upload boundary schemas. The browser drives a resumable multipart
 * upload directly to object storage, so the server never sees the bytes, it
 * only brokers presigned URLs (presign) and records the result (complete).
 * These schemas validate the small JSON envelopes that cross that boundary.
 */

const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+$/,
    "Must be semantic version major.minor.patch (e.g. 1.0.0)",
  );

// 5 GiB is S3/R2's hard per-part ceiling; 10k parts is the multipart max. We
// don't enforce the lower bound (5 MiB) here because the final part may be
// smaller, the storage layer validates on complete.
const MAX_PARTS = 10_000;

export const presignInput = z.object({
  productId: cuid,
  semver,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).default("application/octet-stream"),
  fileSizeBytes: z.coerce.number().int().positive(),
  partCount: z.coerce.number().int().min(1).max(MAX_PARTS),
  changelog: z.string().max(2000).optional(),
});
export type PresignInput = z.infer<typeof presignInput>;

export const completeInput = z.object({
  versionId: cuid,
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(MAX_PARTS),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  makeCurrent: z.boolean().default(true),
});
export type CompleteInput = z.infer<typeof completeInput>;

export const abortInput = z.object({
  versionId: cuid,
  key: z.string().min(1),
  uploadId: z.string().min(1),
});
export type AbortInput = z.infer<typeof abortInput>;
