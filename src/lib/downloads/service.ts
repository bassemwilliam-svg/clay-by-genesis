import "server-only";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStorageProvider } from "@/lib/storage";
import { getRateLimiter } from "@/lib/ratelimit";
import { roleAtLeast } from "@/lib/auth-guards";

/*
 * Secure download issuance. The single choke point through which every buyer
 * download passes:
 *
 *   1. resolve assetVersion -> product
 *   2. ownership check: an active Entitlement (revokedAt = null), or staff
 *      (EDITOR+) for QA / hand-off
 *   3. the version must be READY (not mid-upload / pending checksum)
 *   4. storage must be configured
 *   5. rate-limit per user (protective; skipped when Upstash isn't set)
 *   6. mint a short-lived (5 min) presigned GET with attachment disposition
 *   7. write a DownloadLog row for audit
 *
 * The short expiry is safe for multi-GB files: expiry is checked when the
 * transfer starts, not during it, and HTTP Range requests let clients resume.
 */

const DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes
// Generous enough for a buyer grabbing every file in a large library, tight
// enough to blunt a leaked-session scraping run.
const DOWNLOAD_RATE_LIMIT = { limit: 60, windowSeconds: 10 * 60 };

export type DownloadResult =
  | { status: "ok"; url: string; fileName: string; expiresInSeconds: number }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "not_ready" }
  | { status: "storage_unconfigured" }
  | { status: "rate_limited"; retryAfterSeconds: number };

export async function issueDownload(input: {
  userId: string;
  userRole: UserRole;
  assetVersionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<DownloadResult> {
  const version = await prisma.assetVersion.findUnique({
    where: { id: input.assetVersionId },
    select: {
      storageKey: true,
      fileName: true,
      uploadStatus: true,
      asset: { select: { productId: true } },
    },
  });
  if (!version) return { status: "not_found" };

  // Ownership is the single source of truth. Staff bypass it for review work,
  // mirroring the admin signed-download route.
  if (!roleAtLeast(input.userRole, "EDITOR")) {
    const owns = await prisma.entitlement.findFirst({
      where: {
        userId: input.userId,
        productId: version.asset.productId,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!owns) return { status: "forbidden" };
  }

  if (version.uploadStatus !== "READY") return { status: "not_ready" };

  const storage = getStorageProvider();
  if (!storage.isConfigured()) return { status: "storage_unconfigured" };

  const limiter = getRateLimiter();
  if (limiter) {
    const rl = await limiter.limit(
      `download:${input.userId}`,
      DOWNLOAD_RATE_LIMIT,
    );
    if (!rl.success) {
      return { status: "rate_limited", retryAfterSeconds: rl.resetSeconds };
    }
  }

  const url = await storage.getSignedDownloadUrl({
    key: version.storageKey,
    downloadFileName: version.fileName,
    expiresInSeconds: DOWNLOAD_URL_EXPIRY_SECONDS,
  });

  // Audit trail. Best-effort: a log-write hiccup must not deny a paid download.
  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000);
  await prisma.downloadLog
    .create({
      data: {
        userId: input.userId,
        assetVersionId: input.assetVersionId,
        expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    .catch((e) => console.error("[downloads] log write failed:", e));

  return {
    status: "ok",
    url,
    fileName: version.fileName,
    expiresInSeconds: DOWNLOAD_URL_EXPIRY_SECONDS,
  };
}
