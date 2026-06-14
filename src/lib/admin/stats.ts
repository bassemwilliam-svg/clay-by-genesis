import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ProductType, ProductStatus, OrderStatus } from "@prisma/client";

/*
 * Admin analytics. One round of aggregate queries that paint a health picture
 * of the store: money in, what's selling, what the catalog looks like, who's
 * here, and what buyers are asking Atlas for (including briefs that returned
 * nothing, the clearest signal of a catalog gap). All reads run inside the
 * role-gated admin, so they're free to see drafts, revoked rows, and raw briefs.
 */

const DAY_MS = 86_400_000;

export type TopSeller = {
  productId: string;
  title: string;
  type: ProductType;
  slug: string;
  units: number;
  orders: number;
};

export type RecentBrief = {
  id: string;
  brief: string;
  createdAt: Date;
  matched: boolean;
};

export async function getAdminStats() {
  const since30 = new Date(Date.now() - 30 * DAY_MS);

  const [
    ordersByStatus,
    topSellersRaw,
    productsByTypeStatus,
    entitlementsBySource,
    activeEntitlements,
    revokedEntitlements,
    enrollmentCount,
    usersByRole,
    newUsers30d,
    downloadsTotal,
    downloads30d,
    reviewAgg,
    briefCount,
    atlasTurns,
    atlasGapTurns,
    recentSessions,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: OrderStatus.PAID } },
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
    prisma.product.groupBy({
      by: ["type", "status"],
      _count: { _all: true },
    }),
    prisma.entitlement.groupBy({
      by: ["source"],
      where: { revokedAt: null },
      _count: { _all: true },
    }),
    prisma.entitlement.count({ where: { revokedAt: null } }),
    prisma.entitlement.count({ where: { revokedAt: { not: null } } }),
    prisma.enrollment.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.downloadLog.count(),
    prisma.downloadLog.count({ where: { issuedAt: { gte: since30 } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.conciergeSession.count(),
    prisma.conciergeMessage.count({ where: { role: "ASSISTANT" } }),
    prisma.conciergeMessage.count({
      where: { role: "ASSISTANT", recommendedProductIds: { isEmpty: true } },
    }),
    prisma.conciergeSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      where: { brief: { not: null } },
      select: {
        id: true,
        brief: true,
        createdAt: true,
        messages: {
          where: { role: "ASSISTANT" },
          select: { recommendedProductIds: true },
        },
      },
    }),
  ]);

  // --- Orders / revenue --------------------------------------------------
  const orderStat = (status: OrderStatus) =>
    ordersByStatus.find((o) => o.status === status);
  const paidRevenueCents = orderStat(OrderStatus.PAID)?._sum.totalCents ?? 0;
  const refundedCents = orderStat(OrderStatus.REFUNDED)?._sum.totalCents ?? 0;
  const orderCounts: { status: OrderStatus; count: number; cents: number }[] =
    Object.values(OrderStatus).map((status) => ({
      status,
      count: orderStat(status)?._count._all ?? 0,
      cents: orderStat(status)?._sum.totalCents ?? 0,
    }));
  const paidOrders = orderStat(OrderStatus.PAID)?._count._all ?? 0;

  // --- Top sellers (resolve titles for the grouped product ids) ----------
  const sellerIds = topSellersRaw.map((r) => r.productId);
  const sellerProducts = sellerIds.length
    ? await prisma.product.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, title: true, type: true, slug: true },
      })
    : [];
  const byId = new Map(sellerProducts.map((p) => [p.id, p]));
  const topSellers: TopSeller[] = topSellersRaw.flatMap((r) => {
    const p = byId.get(r.productId);
    if (!p) return [];
    return [
      {
        productId: r.productId,
        title: p.title,
        type: p.type,
        slug: p.slug,
        units: r._sum.quantity ?? 0,
        orders: r._count._all,
      },
    ];
  });

  // --- Catalog matrix: type x status -------------------------------------
  const catalog = Object.values(ProductType).map((type) => {
    const cell = (status: ProductStatus) =>
      productsByTypeStatus.find((c) => c.type === type && c.status === status)
        ?._count._all ?? 0;
    const published = cell(ProductStatus.PUBLISHED);
    const draft = cell(ProductStatus.DRAFT);
    const archived = cell(ProductStatus.ARCHIVED);
    return {
      type,
      published,
      draft,
      archived,
      total: published + draft + archived,
    };
  });
  const totalProducts = catalog.reduce((s, c) => s + c.total, 0);
  const publishedProducts = catalog.reduce((s, c) => s + c.published, 0);

  // --- Users / engagement ------------------------------------------------
  const totalUsers = usersByRole.reduce((s, r) => s + r._count._all, 0);
  const roleCounts = usersByRole
    .map((r) => ({ role: r.role, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  // --- Atlas interest ----------------------------------------------------
  const recentBriefs: RecentBrief[] = recentSessions.map((s) => ({
    id: s.id,
    brief: s.brief ?? "",
    createdAt: s.createdAt,
    matched: s.messages.some((m) => m.recommendedProductIds.length > 0),
  }));
  const atlasMatchRate =
    atlasTurns > 0 ? (atlasTurns - atlasGapTurns) / atlasTurns : null;

  return {
    revenue: {
      paidRevenueCents,
      refundedCents,
      paidOrders,
      orderCounts,
    },
    topSellers,
    catalog: {
      rows: catalog,
      totalProducts,
      publishedProducts,
    },
    ownership: {
      activeEntitlements,
      revokedEntitlements,
      enrollmentCount,
      bySource: entitlementsBySource
        .map((e) => ({ source: e.source, count: e._count._all }))
        .sort((a, b) => b.count - a.count),
    },
    audience: {
      totalUsers,
      newUsers30d,
      roleCounts,
    },
    activity: {
      downloadsTotal,
      downloads30d,
      reviewCount: reviewAgg._count._all,
      avgRating: reviewAgg._avg.rating,
    },
    atlas: {
      briefCount,
      atlasTurns,
      atlasGapTurns,
      atlasMatchRate,
      recentBriefs,
    },
  };
}
