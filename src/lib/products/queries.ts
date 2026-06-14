import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Admin-side product reads. The storefront (Stage 4) gets its own ISR-friendly
 * query module; these run dynamically inside the role-gated admin and so are
 * free to read drafts and archived items.
 */

export async function listProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      status: true,
      priceCents: true,
      currency: true,
      updatedAt: true,
      category: { select: { name: true } },
    },
  });
}

/**
 * Downloadable products an imported S3 object can be attached to (the
 * file-backed types only — courses/bundles don't hold asset files).
 */
export async function listImportTargets() {
  return prisma.product.findMany({
    where: { type: { in: ["GAME_ASSET", "ENVIRONMENT_KIT", "PROCEDURAL_TOOL"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, type: true, status: true },
  });
}

/**
 * READY asset versions across the catalog, for the export console's
 * copy-to-bucket picker. Sizes are pre-coerced to Number so the row is safe to
 * hand a client component (BigInt isn't serializable across the boundary).
 */
export async function listVersionsForExport() {
  const versions = await prisma.assetVersion.findMany({
    where: { uploadStatus: "READY" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      semver: true,
      fileName: true,
      fileSizeBytes: true,
      storageKey: true,
      asset: { select: { product: { select: { title: true, slug: true } } } },
    },
  });
  return versions.map((v) => ({
    id: v.id,
    semver: v.semver,
    fileName: v.fileName,
    sizeBytes: v.fileSizeBytes != null ? Number(v.fileSizeBytes) : null,
    storageKey: v.storageKey,
    productTitle: v.asset.product.title,
    productSlug: v.asset.product.slug,
  }));
}

export type ExportVersionRow = Awaited<
  ReturnType<typeof listVersionsForExport>
>[number];

/** Full product (with its category detail) for the edit form. */
export async function getProductForEdit(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      gameAssetDetail: true,
      environmentKitDetail: true,
      proceduralToolDetail: true,
    },
  });
}

/**
 * Bundle editing data: the products currently in the bundle, plus the products
 * still eligible to be added. Members can be any non-bundle product (the editor
 * may bundle a draft they're still preparing); bundles can never be members, so
 * they're excluded from the candidate list. Already-added members are filtered
 * out so the picker only offers genuinely new choices.
 */
export async function getBundleEditorData(bundleId: string) {
  const [items, candidates] = await Promise.all([
    prisma.bundleItem.findMany({
      where: { bundleId },
      select: {
        member: {
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            status: true,
            priceCents: true,
            discountCents: true,
            currency: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { type: { not: "BUNDLE" }, id: { not: bundleId } },
      orderBy: [{ type: "asc" }, { title: "asc" }],
      select: { id: true, title: true, type: true, status: true },
    }),
  ]);

  const members = items.map((i) => i.member);
  const memberIds = new Set(members.map((m) => m.id));
  return {
    members,
    candidates: candidates.filter((c) => !memberIds.has(c.id)),
  };
}

export type BundleEditorData = Awaited<ReturnType<typeof getBundleEditorData>>;

/** Taxonomy + licenses + facet suggestions to populate the form's inputs. */
export async function getProductFormOptions() {
  const [categories, licenses, industryRows, themeRows, styleRows] =
    await Promise.all([
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          subcategories: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true },
          },
        },
      }),
      prisma.license.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // Distinct, non-null values already in use, so the admin can reuse the
      // existing vocabulary (datalist suggestions) instead of fragmenting facets.
      prisma.product.findMany({
        where: { industry: { not: null } },
        distinct: ["industry"],
        orderBy: { industry: "asc" },
        select: { industry: true },
      }),
      prisma.product.findMany({
        where: { theme: { not: null } },
        distinct: ["theme"],
        orderBy: { theme: "asc" },
        select: { theme: true },
      }),
      prisma.product.findMany({
        where: { style: { not: null } },
        distinct: ["style"],
        orderBy: { style: "asc" },
        select: { style: true },
      }),
    ]);
  const notNull = (v: string | null): v is string => v !== null;
  return {
    categories,
    licenses,
    facets: {
      industry: industryRows.map((r) => r.industry).filter(notNull),
      theme: themeRows.map((r) => r.theme).filter(notNull),
      style: styleRows.map((r) => r.style).filter(notNull),
    },
  };
}

export type ProductFormOptions = Awaited<
  ReturnType<typeof getProductFormOptions>
>;
export type ProductForEdit = Awaited<ReturnType<typeof getProductForEdit>>;
