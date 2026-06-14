import { env } from "@/lib/env";
import type { StorageProvider } from "./types";
import { createR2Storage } from "./r2";
import { createS3Storage } from "./s3";

export type {
  StorageProvider,
  StorageObject,
  StorageObjectStat,
  ListObjectsResult,
} from "./types";

let instance: StorageProvider | undefined;

/**
 * Factory: the rest of the app calls this, never a concrete provider. The
 * backend is chosen by STORAGE_PROVIDER ("r2" | "s3"); both share one
 * S3-protocol implementation. Add GCS etc. here without touching call sites.
 */
export function getStorageProvider(): StorageProvider {
  if (!instance) {
    instance = env.STORAGE_PROVIDER === "s3" ? createS3Storage() : createR2Storage();
  }
  return instance;
}
