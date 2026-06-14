import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendOrderReceipt } from "@/lib/email/receipts";
import {
  INVOICE_SELLER,
  type InvoiceSnapshot,
} from "@/lib/invoices/snapshot";

/*
 * Order fulfillment. The single, idempotent unit the payment webhook calls once
 * a payment is confirmed. It is deliberately a plain async function (not yet an
 * Inngest step) so it stays easy to verify; its correctness rests on database
 * constraints, not on an external queue:
 *
 *   - Invoice.orderId is @unique  -> at most one invoice per order. The second
 *     concurrent/replayed webhook hits P2002 and we treat it as already done.
 *   - Entitlement (userId, productId) is @unique + createMany(skipDuplicates)
 *     -> ownership is granted at most once, never clobbering a stronger source.
 *   - Invoice.number is @unique    -> sequential numbering; a cross-order race
 *     loses to P2002 and retries with a fresh max.
 *
 * Granting is driven entirely by the order we created at checkout, never by the
 * success redirect. Bundles fan out to member entitlements (source BUNDLE);
 * courses also get an Enrollment.
 */

const MAX_NUMBER_RETRIES = 6;

export type FulfillmentResult =
  | { status: "fulfilled"; invoiceNumber: number }
  | { status: "already_fulfilled"; invoiceNumber?: number }
  | { status: "order_not_found" };

export interface FulfillEvent {
  orderId?: string;
  providerSessionId?: string;
  providerPaymentId?: string;
}

/** Resolve our Order from whatever identifiers the webhook carried. */
async function resolveOrder(event: FulfillEvent) {
  const where: Prisma.OrderWhereInput | null = event.orderId
    ? { id: event.orderId }
    : event.providerSessionId
      ? { providerSessionId: event.providerSessionId }
      : event.providerPaymentId
        ? { providerPaymentId: event.providerPaymentId }
        : null;
  if (!where) return null;

  return prisma.order.findFirst({
    where,
    select: {
      id: true,
      userId: true,
      status: true,
      provider: true,
      currency: true,
      subtotalCents: true,
      totalCents: true,
      providerPaymentId: true,
      invoice: { select: { number: true } },
      user: { select: { name: true, email: true } },
      items: {
        select: { productId: true, titleSnapshot: true, priceCents: true, quantity: true },
      },
    },
  });
}

function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return targets.some((t) => t.includes(column));
}

export async function fulfillPaidOrder(
  event: FulfillEvent,
): Promise<FulfillmentResult> {
  const order = await resolveOrder(event);
  if (!order) return { status: "order_not_found" };

  // Idempotency latch: an invoice already exists -> this order is fulfilled.
  if (order.invoice) {
    return { status: "already_fulfilled", invoiceNumber: order.invoice.number };
  }

  const itemProductIds = order.items.map((i) => i.productId);

  // Resolve product types so we can fan bundles out to their members.
  const products = await prisma.product.findMany({
    where: { id: { in: itemProductIds } },
    select: {
      id: true,
      type: true,
      bundleItems: { select: { memberId: true } }, // members of this bundle
    },
  });

  // productId -> source. Direct items are PURCHASE; bundle members are BUNDLE
  // (unless also bought directly, in which case the PURCHASE claim wins).
  const grantSource = new Map<string, "PURCHASE" | "BUNDLE">();
  for (const p of products) grantSource.set(p.id, "PURCHASE");
  for (const p of products) {
    if (p.type === "BUNDLE") {
      for (const { memberId } of p.bundleItems) {
        if (!grantSource.has(memberId)) grantSource.set(memberId, "BUNDLE");
      }
    }
  }

  const allGrantIds = [...grantSource.keys()];
  const purchaseIds = allGrantIds.filter((id) => grantSource.get(id) === "PURCHASE");
  const bundleIds = allGrantIds.filter((id) => grantSource.get(id) === "BUNDLE");

  // Courses among the granted products get an Enrollment too.
  const courses = await prisma.course.findMany({
    where: { productId: { in: allGrantIds } },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);

  const snapshotBase = {
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    order: {
      id: order.id,
      provider: order.provider,
      providerPaymentId: event.providerPaymentId ?? order.providerPaymentId ?? null,
    },
    buyer: { name: order.user.name, email: order.user.email },
    seller: { name: INVOICE_SELLER.name, tagline: INVOICE_SELLER.tagline },
    items: order.items.map((i) => ({
      title: i.titleSnapshot,
      priceCents: i.priceCents,
      quantity: i.quantity,
    })),
  };

  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
    try {
      const { number, snapshot } = await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            providerPaymentId: event.providerPaymentId ?? order.providerPaymentId,
          },
        });

        if (purchaseIds.length) {
          await tx.entitlement.createMany({
            data: purchaseIds.map((productId) => ({
              userId: order.userId,
              productId,
              source: "PURCHASE" as const,
              orderId: order.id,
            })),
            skipDuplicates: true,
          });
        }
        if (bundleIds.length) {
          await tx.entitlement.createMany({
            data: bundleIds.map((productId) => ({
              userId: order.userId,
              productId,
              source: "BUNDLE" as const,
              orderId: order.id,
            })),
            skipDuplicates: true,
          });
        }
        // Re-purchase after a refund: re-activate any previously revoked rows
        // for these products and re-point them at this order.
        await tx.entitlement.updateMany({
          where: {
            userId: order.userId,
            productId: { in: allGrantIds },
            revokedAt: { not: null },
          },
          data: { revokedAt: null, orderId: order.id },
        });

        if (courseIds.length) {
          await tx.enrollment.createMany({
            data: courseIds.map((courseId) => ({ userId: order.userId, courseId })),
            skipDuplicates: true,
          });
        }

        const agg = await tx.invoice.aggregate({ _max: { number: true } });
        const nextNumber = (agg._max.number ?? 0) + 1;
        const snap: InvoiceSnapshot = {
          ...snapshotBase,
          invoiceNumber: nextNumber,
          issuedAt: new Date().toISOString(),
        };
        await tx.invoice.create({
          data: {
            orderId: order.id,
            number: nextNumber,
            snapshot: snap as unknown as Prisma.InputJsonValue,
          },
        });
        return { number: nextNumber, snapshot: snap };
      });

      // Receipt is best-effort and never throws; granting must not depend on it.
      await sendOrderReceipt(snapshot);
      return { status: "fulfilled", invoiceNumber: number };
    } catch (e) {
      // A concurrent/replayed webhook already created the invoice for this order.
      if (isUniqueViolationOn(e, "orderId")) {
        const existing = await prisma.invoice.findUnique({
          where: { orderId: order.id },
          select: { number: true },
        });
        return { status: "already_fulfilled", invoiceNumber: existing?.number };
      }
      // Two different orders raced for the same invoice number: retry.
      if (isUniqueViolationOn(e, "number")) continue;
      throw e;
    }
  }

  throw new Error(
    `Could not assign a unique invoice number for order ${order.id} after ${MAX_NUMBER_RETRIES} attempts`,
  );
}

export type RefundOutcome =
  | { status: "revoked" }
  | { status: "already_refunded" }
  | { status: "order_not_found" };

/**
 * Refund handler: mark the order REFUNDED and soft-revoke the entitlements it
 * granted (downloads are denied the instant revokedAt is set). MEMBERSHIP and
 * GRANT entitlements are left untouched: those didn't come from this order.
 */
export async function revokeRefundedOrder(
  providerPaymentId: string,
): Promise<RefundOutcome> {
  const order = await prisma.order.findFirst({
    where: { providerPaymentId },
    select: { id: true, status: true },
  });
  if (!order) return { status: "order_not_found" };
  if (order.status === "REFUNDED") return { status: "already_refunded" };

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } }),
    prisma.entitlement.updateMany({
      where: {
        orderId: order.id,
        source: { in: ["PURCHASE", "BUNDLE"] },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { status: "revoked" };
}

/** Late failure/expiry: flip a still-PENDING order to FAILED (never a paid one). */
export async function markOrderFailed(event: FulfillEvent): Promise<void> {
  const where: Prisma.OrderWhereInput | null = event.orderId
    ? { id: event.orderId }
    : event.providerSessionId
      ? { providerSessionId: event.providerSessionId }
      : event.providerPaymentId
        ? { providerPaymentId: event.providerPaymentId }
        : null;
  if (!where) return;

  await prisma.order.updateMany({
    where: { ...where, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
