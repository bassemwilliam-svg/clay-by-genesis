import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEmbedder, toVectorLiteral } from "./embeddings";

/*
 * Product → embedding indexing. The "proper" home for this is a durable Inngest
 * job fired on publish/edit (Stage 8); until that lands, `reindexProduct` is
 * called best-effort from the product write actions and is a no-op when no
 * embedder is configured, so it never blocks or breaks a publish.
 */

type IndexableProduct = {
  title: string;
  shortDesc: string | null;
  fullDesc: string | null;
  type: string;
  industry: string | null;
  theme: string | null;
  style: string | null;
  category: { name: string } | null;
  gameAssetDetail: { targetEngines: string[]; software: string[] } | null;
  environmentKitDetail: {
    biome: string | null;
    targetEngines: string[];
    software: string[];
  } | null;
  proceduralToolDetail: {
    hostSoftware: string | null;
    toolType: string | null;
  } | null;
};

/** The text we embed: what it is, what it's for, and its key attributes. */
export function buildEmbeddingText(p: IndexableProduct): string {
  const parts: string[] = [p.title, p.type.replace(/_/g, " ").toLowerCase()];
  if (p.category) parts.push(p.category.name);
  if (p.industry) parts.push(p.industry);
  if (p.theme) parts.push(p.theme);
  if (p.style) parts.push(p.style);
  if (p.shortDesc) parts.push(p.shortDesc);
  if (p.fullDesc) parts.push(p.fullDesc);
  if (p.gameAssetDetail) {
    parts.push(...p.gameAssetDetail.targetEngines, ...p.gameAssetDetail.software);
  }
  if (p.environmentKitDetail) {
    if (p.environmentKitDetail.biome) parts.push(p.environmentKitDetail.biome);
    parts.push(
      ...p.environmentKitDetail.targetEngines,
      ...p.environmentKitDetail.software,
    );
  }
  if (p.proceduralToolDetail) {
    if (p.proceduralToolDetail.hostSoftware) {
      parts.push(p.proceduralToolDetail.hostSoftware);
    }
    if (p.proceduralToolDetail.toolType) {
      parts.push(p.proceduralToolDetail.toolType);
    }
  }
  return parts.filter(Boolean).join(". ");
}

const INDEX_INCLUDE = {
  category: { select: { name: true } },
  gameAssetDetail: { select: { targetEngines: true, software: true } },
  environmentKitDetail: {
    select: { biome: true, targetEngines: true, software: true },
  },
  proceduralToolDetail: { select: { hostSoftware: true, toolType: true } },
} satisfies Prisma.ProductInclude;

/** Returns true if an embedding was written; false if skipped (no provider). */
export async function reindexProduct(productId: string): Promise<boolean> {
  const embedder = getEmbedder();
  if (!embedder) return false;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: INDEX_INCLUDE,
  });
  if (!product) return false;

  const [vec] = await embedder.embed([buildEmbeddingText(product)], "document");
  if (!vec) return false;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Product" SET embedding = ${toVectorLiteral(vec)}::vector
    WHERE id = ${productId}
  `);
  return true;
}

/** Fire-and-forget wrapper for the write path, logs failures, never throws. */
export function reindexProductSafe(productId: string): void {
  void reindexProduct(productId).catch((e) =>
    console.error("[ai/indexing] reindex failed", productId, e),
  );
}
