import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Storefront review reads. Reviews are public, so this module never needs the
 * session: it returns the aggregate (average + count) and the most recent
 * reviews for a product. The personalized "can I review / my review" state is
 * resolved at request time by the client island via a server action, which
 * keeps the product page itself statically renderable (ISR).
 */

export type ProductReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  authorName: string;
};

export type ReviewSummary = {
  average: number; // 0 when there are no reviews
  count: number;
  reviews: ProductReview[];
};

export async function getProductReviews(
  productId: string,
): Promise<ReviewSummary> {
  const [agg, rows] = await Promise.all([
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        body: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    average: agg._avg.rating ?? 0,
    count: agg._count._all,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt,
      authorName: r.user.name?.trim() || "Genesis member",
    })),
  };
}
