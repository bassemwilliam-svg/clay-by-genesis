import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, ProductType } from "@prisma/client";

/*
 * Storefront (public) reads. These only ever return PUBLISHED products and are
 * cached for ISR (the pages tag their fetches and revalidate on publish in the
 * admin workflow). Keep this module distinct from the admin queries, which read
 * drafts and run dynamically.
 *
 * Keyword search uses case-insensitive substring matching (ILIKE), accelerated
 * by the pg_trgm index from prisma/sql/search-indexes.sql. Ranked tsvector FTS
 * + typeahead is the planned upgrade (same index file) and is what the Stage 6
 * concierge will lean on; substring is the right, robust default for browse.
 */

const PUBLISHED = { status: "PUBLISHED" as const };

export type BrowseParams = {
  type?: ProductType;
  categorySlug?: string;
  q?: string;
  industry?: string;
  theme?: string;
  style?: string;
  onSale?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  page?: number;
  pageSize?: number;
};

function buildWhere(params: BrowseParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...PUBLISHED };
  if (params.type) where.type = params.type;
  if (params.categorySlug) where.category = { slug: params.categorySlug };
  if (params.industry) where.industry = params.industry;
  if (params.theme) where.theme = params.theme;
  if (params.style) where.style = params.style;
  if (params.onSale) where.discountCents = { not: null };
  if (params.minPriceCents != null || params.maxPriceCents != null) {
    where.priceCents = {
      ...(params.minPriceCents != null ? { gte: params.minPriceCents } : {}),
      ...(params.maxPriceCents != null ? { lte: params.maxPriceCents } : {}),
    };
  }
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shortDesc: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function browseProducts(params: BrowseParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 24));
  const where = buildWhere(params);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        shortDesc: true,
        priceCents: true,
        discountCents: true,
        currency: true,
        category: { select: { name: true, slug: true } },
        media: {
          where: { kind: "THUMBNAIL" },
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { url: true, alt: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
}

export type FacetScope = { categorySlug?: string; q?: string };
export type ValueFacet = { value: string; count: number };

/** A scalar facet group (industry / theme / style), null values dropped, count desc. */
async function scalarFacet(
  base: Prisma.ProductWhereInput,
  field: "industry" | "theme" | "style",
): Promise<ValueFacet[]> {
  const grouped = await prisma.product.groupBy({
    by: [field],
    where: { ...base, [field]: { not: null } },
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ value: g[field] as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * All facet counts across the current category/keyword scope. The result grid
 * narrows further by type/industry/theme/style/price, but the facet lists stay
 * computed over {category, q} so every option (and its count) is always visible.
 */
export async function browseFacets(scope: FacetScope) {
  const base = buildWhere({ ...scope });
  const [types, industry, theme, style, onSaleCount, priceAgg] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["type"],
        where: base,
        _count: { _all: true },
      }),
      scalarFacet(base, "industry"),
      scalarFacet(base, "theme"),
      scalarFacet(base, "style"),
      prisma.product.count({ where: { ...base, discountCents: { not: null } } }),
      prisma.product.aggregate({
        where: base,
        _min: { priceCents: true },
        _max: { priceCents: true },
      }),
    ]);
  return {
    types: types.map((g) => ({ type: g.type, count: g._count._all })),
    industry,
    theme,
    style,
    onSaleCount,
    priceMinCents: priceAgg._min.priceCents ?? 0,
    priceMaxCents: priceAgg._max.priceCents ?? 0,
  };
}

export type BrowseFacets = Awaited<ReturnType<typeof browseFacets>>;

export async function listPublishedCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: PUBLISHED } } },
    },
  });
}

/** Full product detail for the storefront product page. */
export async function getPublishedProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, ...PUBLISHED },
    include: {
      category: { select: { name: true, slug: true } },
      subcategory: { select: { name: true } },
      license: { select: { name: true, summary: true } },
      media: { orderBy: { sortOrder: "asc" } },
      gameAssetDetail: true,
      environmentKitDetail: true,
      proceduralToolDetail: true,
      // Bundle "what's included": only surface members that are themselves
      // published (a draft member isn't buyable on its own yet). The shape here
      // matches ProductCardData so the storefront card renders them directly.
      bundleItems: {
        where: { member: { status: "PUBLISHED" } },
        select: {
          member: {
            select: {
              slug: true,
              title: true,
              type: true,
              shortDesc: true,
              priceCents: true,
              discountCents: true,
              currency: true,
              category: { select: { name: true, slug: true } },
              media: {
                where: { kind: "THUMBNAIL" },
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
        },
      },
    },
  });
}

/** Slugs for static generation of product pages (ISR seed). */
export async function listPublishedSlugs() {
  const rows = await prisma.product.findMany({
    where: PUBLISHED,
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

export type BrowseResult = Awaited<ReturnType<typeof browseProducts>>;
export type StorefrontProduct = Awaited<
  ReturnType<typeof getPublishedProductBySlug>
>;
