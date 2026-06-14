import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getOrdersForUser } from "@/lib/orders/queries";
import { formatMoney } from "@/lib/format";
import { formatInvoiceNumber } from "@/lib/invoices/snapshot";

// Buyer order history + invoice downloads. Always dynamic so it reflects the
// live payment pipeline (status flips from PENDING -> PAID on the webhook).
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  PAID: "border-primary/40 bg-primary/10 text-primary",
  PENDING: "border-border text-muted-foreground",
  FAILED: "border-border bg-muted/40 text-muted-foreground",
  REFUNDED: "border-border bg-muted/40 text-muted-foreground line-through",
  CANCELLED: "border-border bg-muted/40 text-muted-foreground line-through",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getOrdersForUser(user.id);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Your purchase history and invoices. Ownership is granted automatically
        once payment clears.
      </p>

      {orders.length === 0 ? (
        <div className="mt-10 border border-dashed border-border/70 px-6 py-16 text-center">
          <p className="text-muted-foreground">No orders yet.</p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[o.status] ?? "border-border text-muted-foreground"}`}
                  >
                    {o.status}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {dateFmt.format(o.createdAt)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {o.id.slice(0, 8)}
                  </span>
                </div>
                <span className="tabular-nums font-medium">
                  {formatMoney(o.totalCents, o.currency)}
                </span>
              </div>

              <div className="px-5 py-4">
                <ul className="space-y-1.5 text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>
                        {it.titleSnapshot}
                        {it.quantity > 1 ? (
                          <span className="text-muted-foreground"> ×{it.quantity}</span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(it.priceCents * it.quantity, o.currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  {o.invoice ? (
                    <a
                      href={`/api/invoices/${o.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Download invoice {formatInvoiceNumber(o.invoice.number)}
                    </a>
                  ) : o.status === "PENDING" ? (
                    <span className="text-sm text-muted-foreground">
                      Awaiting payment confirmation
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No invoice</span>
                  )}
                  <Link
                    href="/library"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View in library →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
