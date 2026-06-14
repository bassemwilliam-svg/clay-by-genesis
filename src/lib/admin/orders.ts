import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Admin-side order reads. Runs dynamically inside the role-gated admin, so it
 * is free to see every buyer's orders across all statuses. Read-only: order
 * state transitions are driven by the payment webhook pipeline, never the UI.
 */
export async function listOrdersForAdmin(limit = 100) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      provider: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
      invoice: { select: { number: true } },
      _count: { select: { items: true } },
    },
  });
}
