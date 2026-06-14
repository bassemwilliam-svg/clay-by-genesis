import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Buyer-facing order history. Read-only: status is owned by the payment webhook
 * pipeline. Includes the invoice number (when issued) so the UI can offer the
 * PDF download, and the line-item snapshots so the list never drifts.
 */
export async function getOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      provider: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      invoice: { select: { number: true } },
      items: {
        select: { titleSnapshot: true, priceCents: true, quantity: true },
      },
    },
  });
}

export type UserOrder = Awaited<ReturnType<typeof getOrdersForUser>>[number];
