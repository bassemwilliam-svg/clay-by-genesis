import "server-only";
import { Prisma, type ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStorageProvider } from "@/lib/storage";
import { ensureAsset } from "./service";

/*
 * Import-by-reference.
 *
 * The studio already keeps its assets in S3, so importing is registration, not
 * copying: we point an immutable AssetVersion straight at the existing object
 * key (uploadStatus READY immediately) after a HEAD confirms it exists and
 * reads back its size. `AssetVersion.storageKey` is unique, so the same object
 * can't be registered twice — the natural idempotency guard for re-runs.
 */

export type ImportErrorKind =
  | "not_configured"
  | "not_found"
  | "conflict"
  | "invalid";

export class ImportError extends Error {
  constructor(
    readonly kind: ImportErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

/** Map an import failure to an HTTP status for route handlers. */
export function importErrorStatus(kind: ImportErrorKind): number {
  switch (kind) {
    case "not_configured":
      return 503;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "invalid":
      return 422;
  }
}

/** Importable (downloadable) product types — courses/bundles aren't files. */
export const IMPORTABLE_TYPES: ProductType[] = [
  "GAME_ASSET",
  "ENVIRONMENT_KIT",
  "PROCEDURAL_TOOL",
];

function basename(key: string): string {
  return key.split("/").filter(Boolean).pop() ?? key;
}

/** Drop the directory + extension and humanize into a product title. */
function titleFromKey(key: string): string {
  const name = basename(key).replace(/\.[a-zA-Z0-9]+$/, "");
  const words = name
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return basename(key);
  return words
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
  return base || "asset";
}

/** Find a free slug, appending -2, -3, … on collision. */
async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let n = 2; n < 1000; n++) {
    const clash = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base.slice(0, 110)}-${n}`;
  }
  // Fall back to a random suffix if a thousand variants are somehow taken.
  return `${base.slice(0, 100)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Register an existing storage object as a new immutable version of a product.
 * Used to attach S3 objects to a product that already exists.
 */
export async function registerExistingObject(input: {
  productId: string;
  storageKey: string;
  semver?: string;
  fileName?: string;
  changelog?: string;
  makeCurrent?: boolean;
}) {
  const storage = getStorageProvider();
  if (!storage.isConfigured()) {
    throw new ImportError(
      "not_configured",
      "Storage isn't configured yet. Set the S3 environment variables to import.",
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) {
    throw new ImportError("invalid", "That product no longer exists.");
  }

  const stat = await storage.statObject(input.storageKey);
  if (!stat) {
    throw new ImportError(
      "not_found",
      `No object at key "${input.storageKey}" in the ${storage.name} bucket.`,
    );
  }

  const semver = input.semver ?? "1.0.0";
  const fileName = input.fileName ?? basename(input.storageKey);
  const makeCurrent = input.makeCurrent ?? true;
  const assetId = await ensureAsset(input.productId);

  try {
    return await prisma.$transaction(async (tx) => {
      if (makeCurrent) {
        await tx.assetVersion.updateMany({
          where: { assetId, isCurrent: true },
          data: { isCurrent: false },
        });
      }
      return tx.assetVersion.create({
        data: {
          assetId,
          semver,
          fileName,
          storageKey: input.storageKey,
          fileSizeBytes: BigInt(stat.sizeBytes),
          changelog: input.changelog ?? null,
          uploadStatus: "READY",
          isCurrent: makeCurrent,
        },
        select: {
          id: true,
          semver: true,
          fileName: true,
          storageKey: true,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: string })?.target ?? "");
      throw new ImportError(
        "conflict",
        target.includes("storageKey")
          ? "That object is already imported."
          : `Version ${semver} already exists for this product.`,
      );
    }
    throw e;
  }
}

/**
 * Bulk-create one DRAFT product per object key, registering each object as the
 * product's first version. Per-key failures are collected, not thrown, so one
 * bad key never aborts the batch. Drafts are reviewed/published from the admin
 * products screen as usual.
 */
export async function bulkCreateDraftsFromKeys(input: {
  type: ProductType;
  keys: string[];
}): Promise<{
  created: { id: string; slug: string; title: string; key: string }[];
  skipped: { key: string; reason: string }[];
}> {
  if (!IMPORTABLE_TYPES.includes(input.type)) {
    throw new ImportError("invalid", "That product type can't hold asset files.");
  }

  const storage = getStorageProvider();
  if (!storage.isConfigured()) {
    throw new ImportError(
      "not_configured",
      "Storage isn't configured yet. Set the S3 environment variables to import.",
    );
  }

  const created: { id: string; slug: string; title: string; key: string }[] = [];
  const skipped: { key: string; reason: string }[] = [];

  // De-dupe the incoming list so two identical pasted lines don't both create.
  const keys = Array.from(new Set(input.keys.map((k) => k.trim()).filter(Boolean)));

  for (const key of keys) {
    try {
      const already = await prisma.assetVersion.findUnique({
        where: { storageKey: key },
        select: { id: true },
      });
      if (already) {
        skipped.push({ key, reason: "Already imported" });
        continue;
      }

      const stat = await storage.statObject(key);
      if (!stat) {
        skipped.push({ key, reason: "Not found in bucket" });
        continue;
      }

      const title = titleFromKey(key);
      const slug = await uniqueSlug(slugify(title));

      const product = await prisma.product.create({
        data: { slug, type: input.type, title, status: "DRAFT" },
        select: { id: true },
      });

      const assetId = await ensureAsset(product.id);
      await prisma.assetVersion.create({
        data: {
          assetId,
          semver: "1.0.0",
          fileName: basename(key),
          storageKey: key,
          fileSizeBytes: BigInt(stat.sizeBytes),
          uploadStatus: "READY",
          isCurrent: true,
        },
      });

      created.push({ id: product.id, slug, title, key });
    } catch (e) {
      const reason =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
          ? "Already imported"
          : e instanceof Error
            ? e.message
            : "Import failed";
      skipped.push({ key, reason });
    }
  }

  return { created, skipped };
}
