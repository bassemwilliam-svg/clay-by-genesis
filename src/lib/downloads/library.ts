import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Buyer library: every product the user owns (active Entitlement) that has at
 * least one downloadable, READY asset version. Courses (consumed in the LMS)
 * and bundle parents (their members are granted individually) carry no asset,
 * so they fall out of this query naturally and live under "My learning".
 *
 * fileSizeBytes stays BigInt here; the server page formats it before anything
 * crosses into a client component (BigInt is not RSC-serializable).
 */
export async function getLibraryForUser(userId: string) {
  const rows = await prisma.entitlement.findMany({
    where: {
      userId,
      revokedAt: null,
      product: { asset: { versions: { some: { uploadStatus: "READY" } } } },
    },
    orderBy: { grantedAt: "desc" },
    select: {
      source: true,
      grantedAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          media: {
            where: { kind: "THUMBNAIL" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true, alt: true },
          },
          asset: {
            select: {
              versions: {
                where: { uploadStatus: "READY" },
                orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  semver: true,
                  fileName: true,
                  fileSizeBytes: true,
                  isCurrent: true,
                  changelog: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => ({
    source: r.source,
    grantedAt: r.grantedAt,
    product: {
      id: r.product.id,
      slug: r.product.slug,
      title: r.product.title,
      type: r.product.type,
      thumbnailUrl: r.product.media[0]?.url ?? null,
      thumbnailAlt: r.product.media[0]?.alt ?? null,
      versions: r.product.asset?.versions ?? [],
    },
  }));
}

export type LibraryItem = Awaited<ReturnType<typeof getLibraryForUser>>[number];
