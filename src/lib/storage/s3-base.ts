import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageProvider,
  PresignedUpload,
  CompletedPart,
  ListObjectsResult,
  StorageObjectStat,
} from "./types";

const DEFAULT_DOWNLOAD_EXPIRY = 5 * 60; // 5 minutes, see secure download flow
const DEFAULT_LIST_KEYS = 200;

/*
 * Shared S3-protocol storage adapter. Cloudflare R2 and native AWS S3 both
 * speak the S3 API, so a single implementation serves both: only the client
 * construction (endpoint, region, credentials) differs, and that lives in the
 * thin r2.ts / s3.ts factories that feed this class.
 *
 * The client/bucket may be null when the provider isn't configured. Rather than
 * throw at construction (which would break unrelated pages on a half-set-up
 * deploy), callers check `isConfigured()` and only the methods that actually
 * touch storage throw — mirroring the payments "not configured yet" pattern.
 */
export class S3CompatibleStorage implements StorageProvider {
  readonly name: string;
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor(opts: {
    name: string;
    client: S3Client | null;
    bucket: string | null;
  }) {
    this.name = opts.name;
    this.client = opts.client;
    this.bucket = opts.bucket;
  }

  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null;
  }

  private ctx(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new Error(
        `Storage provider "${this.name}" is not configured (missing credentials or bucket).`,
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  async createMultipartUpload(input: {
    key: string;
    contentType: string;
    partCount: number;
  }): Promise<PresignedUpload> {
    const { client, bucket } = this.ctx();
    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
    );
    const uploadId = created.UploadId;
    if (!uploadId) throw new Error("Storage did not return an UploadId");

    const partUrls = await Promise.all(
      Array.from({ length: input.partCount }, (_, i) => i + 1).map(
        async (partNumber) => {
          const url = await getSignedUrl(
            client,
            new UploadPartCommand({
              Bucket: bucket,
              Key: input.key,
              UploadId: uploadId,
              PartNumber: partNumber,
            }),
            { expiresIn: 60 * 60 },
          );
          return { partNumber, url };
        },
      ),
    );

    return { uploadId, key: input.key, partUrls };
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: CompletedPart[];
  }): Promise<void> {
    const { client, bucket } = this.ctx();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(input: {
    key: string;
    uploadId: string;
  }): Promise<void> {
    const { client, bucket } = this.ctx();
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: input.key,
        UploadId: input.uploadId,
      }),
    );
  }

  async getSignedDownloadUrl(input: {
    key: string;
    expiresInSeconds?: number;
    downloadFileName?: string;
  }): Promise<string> {
    const { client, bucket } = this.ctx();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ResponseContentDisposition: input.downloadFileName
          ? `attachment; filename="${input.downloadFileName}"`
          : "attachment",
      }),
      { expiresIn: input.expiresInSeconds ?? DEFAULT_DOWNLOAD_EXPIRY },
    );
  }

  async headObjectSize(key: string): Promise<number | null> {
    const { client, bucket } = this.ctx();
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return head.ContentLength ?? null;
  }

  async listObjects(input: {
    prefix?: string;
    delimiter?: string;
    continuationToken?: string;
    maxKeys?: number;
  }): Promise<ListObjectsResult> {
    const { client, bucket } = this.ctx();
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: input.prefix || undefined,
        Delimiter: input.delimiter || undefined,
        ContinuationToken: input.continuationToken || undefined,
        MaxKeys: input.maxKeys ?? DEFAULT_LIST_KEYS,
      }),
    );

    return {
      objects: (res.Contents ?? [])
        // S3 returns the prefix "folder" itself as a zero-byte key; skip it.
        .filter((o) => o.Key && o.Key !== input.prefix)
        .map((o) => ({
          key: o.Key as string,
          sizeBytes: o.Size ?? 0,
          lastModified: o.LastModified
            ? o.LastModified.toISOString()
            : null,
          etag: o.ETag ?? null,
        })),
      prefixes: (res.CommonPrefixes ?? [])
        .map((p) => p.Prefix)
        .filter((p): p is string => Boolean(p)),
      nextToken: res.IsTruncated ? res.NextContinuationToken : undefined,
    };
  }

  async statObject(key: string): Promise<StorageObjectStat | null> {
    const { client, bucket } = this.ctx();
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        sizeBytes: head.ContentLength ?? 0,
        contentType: head.ContentType ?? null,
        etag: head.ETag ?? null,
      };
    } catch (e) {
      // 404 / NotFound / NoSuchKey → object absent; anything else re-throws.
      const name =
        e && typeof e === "object" && "name" in e
          ? (e as { name?: string }).name
          : undefined;
      const status =
        e && typeof e === "object" && "$metadata" in e
          ? (e as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode
          : undefined;
      if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
        return null;
      }
      throw e;
    }
  }

  async copyToBucket(input: {
    sourceKey: string;
    destBucket: string;
    destKey: string;
  }): Promise<void> {
    const { client, bucket } = this.ctx();
    // CopySource must be URI-encoded per path segment; the bucket and each key
    // segment are encoded individually so "/" separators survive.
    const source = [bucket, ...input.sourceKey.split("/")]
      .map(encodeURIComponent)
      .join("/");
    await client.send(
      new CopyObjectCommand({
        Bucket: input.destBucket,
        Key: input.destKey,
        CopySource: source,
      }),
    );
  }
}
