import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getStorageProvider } from "@/lib/storage";
import type { CompletedPart } from "@/lib/storage/types";

/*
 * Asset versioning service.
 *
 * Each version is immutable: a new semver gets a fresh, content-addressed-ish
 * storage key and is never overwritten, so an entitlement keeps working against
 * every version a buyer ever had access to. The object key embeds the semver,
 * which is unique per asset (DB constraint), so the key is deterministic and
 * collision-free without a round-trip to mint an id first.
 */

/** `products/{productId}/v/{semver}/{fileName}`, immutable per version. */
export function buildStorageKey(
  productId: string,
  semver: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `products/${productId}/v/${semver}/${safeName}`;
}

/** Ensure the 1:1 ProductAsset row exists, returning its id. */
export async function ensureAsset(productId: string): Promise<string> {
  const asset = await prisma.productAsset.upsert({
    where: { productId },
    update: {},
    create: { productId },
    select: { id: true },
  });
  return asset.id;
}

/**
 * Record a PENDING version and open a multipart upload. The uploadId is handed
 * back to the client rather than stored: the upload is stateless server-side
 * until `finalizeVersion` records the outcome.
 */
export async function createPendingVersion(input: {
  productId: string;
  semver: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  partCount: number;
  changelog?: string;
}) {
  const assetId = await ensureAsset(input.productId);
  const key = buildStorageKey(input.productId, input.semver, input.fileName);

  const version = await prisma.assetVersion.create({
    data: {
      assetId,
      semver: input.semver,
      fileName: input.fileName,
      storageKey: key,
      fileSizeBytes: BigInt(input.fileSizeBytes),
      changelog: input.changelog ?? null,
      uploadStatus: "UPLOADING",
    },
    select: { id: true, storageKey: true },
  });

  const upload = await getStorageProvider().createMultipartUpload({
    key,
    contentType: input.contentType,
    partCount: input.partCount,
  });

  return {
    versionId: version.id,
    key: version.storageKey,
    uploadId: upload.uploadId,
    partUrls: upload.partUrls,
  };
}

/**
 * Finalize a completed upload: close the multipart object, read the
 * authoritative size back from storage, mark READY, and (optionally) promote it
 * to the current version, all in one transaction so the catalog never points
 * at a half-written object. SHA-256 checksum is left to the durable post-upload
 * job (Stage 8 / Inngest); the column stays null until then.
 */
export async function finalizeVersion(input: {
  versionId: string;
  key: string;
  uploadId: string;
  parts: CompletedPart[];
  makeCurrent: boolean;
}) {
  const storage = getStorageProvider();

  await storage.completeMultipartUpload({
    key: input.key,
    uploadId: input.uploadId,
    parts: input.parts,
  });

  const size = await storage.headObjectSize(input.key);

  const version = await prisma.assetVersion.findUniqueOrThrow({
    where: { id: input.versionId },
    select: { assetId: true },
  });

  await prisma.$transaction(async (tx) => {
    if (input.makeCurrent) {
      await tx.assetVersion.updateMany({
        where: { assetId: version.assetId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    await tx.assetVersion.update({
      where: { id: input.versionId },
      data: {
        uploadStatus: "READY",
        fileSizeBytes: size != null ? BigInt(size) : undefined,
        isCurrent: input.makeCurrent,
      },
    });
  });

  return { ok: true as const };
}

/** Cancel an in-flight upload: abort the multipart object, drop the row. */
export async function abortVersion(input: {
  versionId: string;
  key: string;
  uploadId: string;
}) {
  await getStorageProvider()
    .abortMultipartUpload({ key: input.key, uploadId: input.uploadId })
    .catch(() => {
      // Abort is best-effort cleanup; storage may have already discarded it.
    });
  await prisma.assetVersion.delete({ where: { id: input.versionId } });
  return { ok: true as const };
}

/** Versions for a product, newest first, for the admin asset panel. */
export async function listVersions(productId: string) {
  return prisma.assetVersion.findMany({
    where: { asset: { productId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      semver: true,
      fileName: true,
      fileSizeBytes: true,
      checksumSha256: true,
      isCurrent: true,
      uploadStatus: true,
      changelog: true,
      createdAt: true,
    },
  });
}
