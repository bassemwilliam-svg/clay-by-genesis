/*
 * Storage port (hexagonal architecture). Domain/services depend on this
 * interface only, never on @aws-sdk or any concrete vendor. Swapping R2 for
 * S3/GCS means writing a new adapter and changing the factory, nothing else.
 */

export interface PresignedUpload {
  uploadId: string;
  key: string;
  /** Presigned PUT URL per part, indexed by part number (1-based). */
  partUrls: { partNumber: number; url: string }[];
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** A single object listed from the bucket (import browse). */
export interface StorageObject {
  key: string;
  sizeBytes: number;
  lastModified: string | null;
  etag: string | null;
}

/** One page of a bucket listing: objects + "folders" (common prefixes). */
export interface ListObjectsResult {
  objects: StorageObject[];
  /** Sub-"folders" when a delimiter is used, for tree-style navigation. */
  prefixes: string[];
  /** Opaque cursor for the next page; absent when the listing is exhausted. */
  nextToken?: string;
}

/** Metadata for one existing object, or null when it does not exist. */
export interface StorageObjectStat {
  sizeBytes: number;
  contentType: string | null;
  etag: string | null;
}

export interface StorageProvider {
  readonly name: string;

  /** Whether credentials/bucket are present; lets callers degrade gracefully. */
  isConfigured(): boolean;

  /** Begin a resumable multipart upload; returns presigned PUT URLs per part. */
  createMultipartUpload(input: {
    key: string;
    contentType: string;
    partCount: number;
  }): Promise<PresignedUpload>;

  /** Finalize a multipart upload once all parts are uploaded. */
  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: CompletedPart[];
  }): Promise<void>;

  /** Abort an incomplete multipart upload (cleanup). */
  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void>;

  /** Short-lived, ownership-gated download URL (attachment disposition). */
  getSignedDownloadUrl(input: {
    key: string;
    expiresInSeconds?: number;
    downloadFileName?: string;
  }): Promise<string>;

  /** Object size in bytes (for display + checksum jobs). */
  headObjectSize(key: string): Promise<number | null>;

  /**
   * List objects in the bucket for import browsing. With a delimiter ("/"),
   * returns objects at one level plus the sub-prefixes ("folders") beneath it.
   */
  listObjects(input: {
    prefix?: string;
    delimiter?: string;
    continuationToken?: string;
    maxKeys?: number;
  }): Promise<ListObjectsResult>;

  /** Size + content type + etag for one object, or null if it doesn't exist. */
  statObject(key: string): Promise<StorageObjectStat | null>;

  /**
   * Server-side copy of an object to a destination bucket/key (export). The
   * provider's credentials must be able to read the source and write the
   * destination (same account / same S3 endpoint).
   */
  copyToBucket(input: {
    sourceKey: string;
    destBucket: string;
    destKey: string;
  }): Promise<void>;
}
