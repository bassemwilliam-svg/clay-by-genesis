import "server-only";
import { Prisma, type ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEmbedder, toVectorLiteral } from "./embeddings";
import type { ConciergeProduct, MatchedVia } from "./types";

/*
 * Hybrid catalog search, the engine behind the concierge's `search_catalog`
 * tool (and reusable elsewhere). It only ever returns PUBLISHED products.
 *
 * Ranking strategy, in order of preference:
 *   1. Semantic (pgvector cosine KNN) when an embedder is configured AND some
 *      rows have embeddings.
 *   2. Full-text (tsvector / websearch_to_tsquery, ranked by ts_rank).
 *   3. Trigram/substring (ILIKE) as a final fuzzy fallback.
 * Structured filters (type, category, engine, price ceiling) are always applied
 * on the typed columns in the Prisma fetch step. With no embedder/embeddings, * the default until VOYAGE_API_KEY is set and a backfill runs, search degrades
 * cleanly to FTS, which works against the seeded catalog today.
 */

const CANDIDATE_POOL = 50;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

export type CatalogSearchFilters = {
  type?: ProductType;
  categorySlug?: string;
  /** Target engine, e.g. "Unreal", "Unity", "Godot" (matches detail tables). */
  engine?: string;
  maxPriceCents?: number;
};

export type CatalogSearchInput = {
  query?: string;
  filters?: CatalogSearchFilters;
  limit?: number;
};

const CARD_SELECT = {
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
    where: { kind: "THUMBNAIL" as const },
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    select: { url: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

function structuredWhere(
  filters: CatalogSearchFilters | undefined,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  if (!filters) return where;
  if (filters.type) where.type = filters.type;
  if (filters.categorySlug) where.category = { slug: filters.categorySlug };
  if (typeof filters.maxPriceCents === "number") {
    where.priceCents = { lte: filters.maxPriceCents };
  }
  if (filters.engine) {
    where.OR = [
      { gameAssetDetail: { targetEngines: { has: filters.engine } } },
      { environmentKitDetail: { targetEngines: { has: filters.engine } } },
    ];
  }
  return where;
}

/** Semantic KNN ids; null when no embedder or no embedded rows exist. */
async function rankBySemantic(query: string): Promise<string[] | null> {
  const embedder = getEmbedder();
  if (!embedder) return null;

  const [vec] = await embedder.embed([query], "query");
  if (!vec) return null;
  const literal = toVectorLiteral(vec);

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "Product"
    WHERE status = 'PUBLISHED' AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${CANDIDATE_POOL}
  `);
  return rows.length ? rows.map((r) => r.id) : null;
}

/** Full-text ids ranked by ts_rank; empty array if nothing matches. */
async function rankByFullText(query: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id
    FROM "Product"
    WHERE status = 'PUBLISHED'
      AND "searchVector" @@ websearch_to_tsquery('english', ${query})
    ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${query})) DESC
    LIMIT ${CANDIDATE_POOL}
  `);
  return rows.map((r) => r.id);
}

/** Substring fallback so a single odd keyword still finds something. */
async function rankBySubstring(query: string): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { shortDesc: { contains: query, mode: "insensitive" } },
        { fullDesc: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: CANDIDATE_POOL,
  });
  return rows.map((r) => r.id);
}

export async function searchCatalog(
  input: CatalogSearchInput,
): Promise<ConciergeProduct[]> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const query = input.query?.trim();
  const where = structuredWhere(input.filters);

  let rankedIds: string[] | null = null;
  let matchedVia: MatchedVia = "filter";

  if (query) {
    const semantic = await rankBySemantic(query);
    if (semantic) {
      rankedIds = semantic;
      matchedVia = "semantic";
    } else {
      const fts = await rankByFullText(query);
      const ids = fts.length ? fts : await rankBySubstring(query);
      rankedIds = ids;
      matchedVia = "keyword";
    }
    // A query that ranked nothing means no catalog match for those terms; let
    // the structured filters (if any) still surface relevant items.
    if (rankedIds.length === 0) rankedIds = null;
  }

  if (rankedIds) where.id = { in: rankedIds };

  const rows = await prisma.product.findMany({
    where,
    select: CARD_SELECT,
    take: rankedIds ? rankedIds.length : limit,
    orderBy: rankedIds
      ? undefined
      : [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  // Preserve rank order from the raw query (Prisma's `in` doesn't guarantee it).
  const ordered = rankedIds
    ? rankedIds
        .map((id) => rows.find((r) => r.id === id))
        .filter((r): r is (typeof rows)[number] => Boolean(r))
    : rows;

  return ordered.slice(0, limit).map((r) => ({ ...r, matchedVia }));
}

/** Specs for the concierge's `get_product_details` tool, compact, text-first. */
export async function getProductForConcierge(id: string) {
  const p = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      shortDesc: true,
      fullDesc: true,
      priceCents: true,
      discountCents: true,
      currency: true,
      category: { select: { name: true } },
      license: { select: { name: true, summary: true } },
      gameAssetDetail: true,
      environmentKitDetail: true,
      proceduralToolDetail: {
        select: { hostSoftware: true, toolType: true },
      },
    },
  });
  return p;
}
