import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { roleAtLeast } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { formatInvoiceNumber, isInvoiceSnapshot } from "@/lib/invoices/snapshot";

/*
 * Invoice PDF download. Rendered on demand from the immutable snapshot (no
 * object storage needed). Access is the order's buyer, or any EDITOR/ADMIN for
 * support. Node runtime (Prisma + pdf-lib), never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/invoices/[orderId]">,
) {
  const { orderId } = await ctx.params;

  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { orderId },
    select: { number: true, snapshot: true, order: { select: { userId: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const isOwner = invoice.order.userId === user.id;
  const isStaff = roleAtLeast(user.role, "EDITOR");
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isInvoiceSnapshot(invoice.snapshot)) {
    return NextResponse.json({ error: "Invoice data unreadable" }, { status: 500 });
  }

  const pdf = await renderInvoicePdf(invoice.snapshot);

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="clay-${formatInvoiceNumber(invoice.number).toLowerCase()}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
