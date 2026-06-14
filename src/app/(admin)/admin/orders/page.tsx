import Link from "next/link";
import { listOrdersForAdmin } from "@/lib/admin/orders";
import { formatMoney } from "@/lib/format";
import { formatInvoiceNumber } from "@/lib/invoices/snapshot";

// Read-only order ledger. Admin is role-gated by the layout; always dynamic so
// the list reflects the live payment pipeline.
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

export default async function AdminOrdersPage() {
  const orders = await listOrdersForAdmin();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orders.length} order{orders.length === 1 ? "" : "s"}. Status is driven
          by the payment webhook pipeline, this view is read-only.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Buyer</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No orders yet. Paid checkouts land here.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-border hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.id.slice(0, 8)}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {o.provider}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {o.user.email ?? o.user.name ?? (
                      <span className="text-muted-foreground">unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dateFmt.format(o.createdAt)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {o._count.items}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(o.totalCents, o.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[o.status] ?? "border-border text-muted-foreground"}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.invoice ? (
                      <a
                        href={`/api/invoices/${o.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {formatInvoiceNumber(o.invoice.number)}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Need the numbers?{" "}
        <Link href="/admin/stats" className="text-primary hover:underline">
          See revenue and top sellers in Stats.
        </Link>
      </p>
    </section>
  );
}
