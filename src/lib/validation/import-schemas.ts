import { z } from "zod";
import { cuid } from "@/lib/validation/common";

/*
 * Boundary schemas for the S3 import/export console. The admin browses or
 * pastes object keys, registers them by reference, and exports catalog data or
 * copies files to another bucket. These validate the JSON envelopes for those
 * admin-only API routes.
 */

const semver = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Must be semantic version major.minor.patch")
  .default("1.0.0");

const storageKey = z.string().min(1).max(1024);

// Only file-backed product types can hold imported objects.
const importableType = z.enum([
  "GAME_ASSET",
  "ENVIRONMENT_KIT",
  "PROCEDURAL_TOOL",
]);

export const listObjectsInput = z.object({
  prefix: z.string().max(1024).optional(),
  continuationToken: z.string().optional(),
  // "" lists every object flat; "/" walks one "folder" level at a time.
  delimiter: z.string().max(1).optional(),
});
export type ListObjectsInput = z.infer<typeof listObjectsInput>;

export const attachObjectInput = z.object({
  productId: cuid,
  key: storageKey,
  semver,
  fileName: z.string().min(1).max(255).optional(),
  changelog: z.string().max(2000).optional(),
  makeCurrent: z.boolean().default(true),
});
export type AttachObjectInput = z.infer<typeof attachObjectInput>;

export const bulkImportInput = z.object({
  type: importableType,
  keys: z.array(storageKey).min(1).max(500),
});
export type BulkImportInput = z.infer<typeof bulkImportInput>;

export const signedDownloadInput = z.object({
  versionId: cuid,
});
export type SignedDownloadInput = z.infer<typeof signedDownloadInput>;

export const copyToBucketInput = z.object({
  versionIds: z.array(cuid).min(1).max(500),
  destBucket: z.string().min(1).max(255),
  destPrefix: z.string().max(1024).optional(),
});
export type CopyToBucketInput = z.infer<typeof copyToBucketInput>;
