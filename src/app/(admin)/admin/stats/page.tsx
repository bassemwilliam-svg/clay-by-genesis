import Link from "next/link";
import { getAdminStats } from "@/lib/admin/stats";
import { formatMoney, PRODUCT_TYPE_LABELS } from "@/lib/format";

// Live health read of the store. Admin is role-gated by the layout; this page
// is always dynamic since the numbers should never be stale.
export const dynamic = "force-dynamic";

const ORDER_STATUS_STYLES: Record<string, string> = {
  PAID: "text-primary",
  PENDING: "text-muted-foreground",
  FAILED: "text-muted-foreground",
  REFUNDED: "text-muted-foreground",
  CANCELLED: "text-muted-foreground",
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-background p-6">
      <span className="mono-label text-muted-foreground">{label}</span>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Panel({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="mono-label text-primary/70">{code}</span>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function AdminStatsPage() {
  const stats = await getAdminStats();
  const { revenue, topSellers, catalog, ownership, audience, activity, atlas } =
    stats;

  const maxSellerUnits = Math.max(1, ...topSellers.map((s) => s.units));
  const avgRating = activity.avgRating;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <div>
        <span className="mono-label text-primary/70">Health</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Money in, what is selling, the shape of the catalog, who is here, and
          what buyers are asking Atlas for. Reads the live database.
        </p>
      </div>

      {/* Headline KPIs */}
      <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Paid revenue"
          value={formatMoney(revenue.paidRevenueCents, "USD")}
          hint={`${revenue.paidOrders} paid order${revenue.paidOrders === 1 ? "" : "s"}`}
        />
        <Stat
          label="Active entitlements"
          value={ownership.activeEntitlements.toLocaleString()}
          hint={`${ownership.revokedEntitlements} revoked`}
        />
        <Stat
          label="Enrollments"
          value={ownership.enrollmentCount.toLocaleString()}
          hint="course seats granted"
        />
        <Stat
          label="Members"
          value={audience.totalUsers.toLocaleString()}
          hint={`${audience.newUsers30d} new in 30 days`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Orders by status */}
        <Panel code="R-01" title="Orders by status">
          {revenue.orderCounts.every((o) => o.count === 0) ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {revenue.orderCounts.map((o) => (
                <li
                  key={o.status}
                  className="flex items-center justify-between gap-4"
                >
                  <span
                    className={`font-mono text-xs uppercase tracking-wide ${ORDER_STATUS_STYLES[o.status] ?? "text-muted-foreground"}`}
                  >
                    {o.status}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-muted-foreground">
                      {formatMoney(o.cents, "USD")}
                    </span>
                    <span className="w-8 text-right font-semibold tabular-nums">
                      {o.count}
                    </span>
                  </span>
                </li>
              ))}
              {revenue.refundedCents > 0 ? (
                <li className="border-t border-border pt-2 text-xs text-muted-foreground">
                  {formatMoney(revenue.refundedCents, "USD")} refunded
                </li>
              ) : null}
            </ul>
          )}
        </Panel>

        {/* Top sellers */}
        <Panel code="R-02" title="Top sellers">
          {topSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sales yet. Top products appear here once orders are paid.
            </p>
          ) : (
            <ul className="space-y-3">
              {topSellers.map((s) => (
                <li key={s.productId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/products/${s.slug}`}
                      className="truncate font-medium hover:text-primary"
                    >
                      {s.title}
                    </Link>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {s.units} unit{s.units === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <Bar value={s.units} max={maxSellerUnits} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {PRODUCT_TYPE_LABELS[s.type] ?? s.type}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Catalog matrix */}
      <div className="mt-6">
        <Panel code="C-01" title="Catalog">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 px-4 text-right font-medium">Published</th>
                  <th className="py-2 px-4 text-right font-medium">Draft</th>
                  <th className="py-2 px-4 text-right font-medium">Archived</th>
                  <th className="py-2 pl-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {catalog.rows.map((row) => (
                  <tr key={row.type} className="border-t border-border">
                    <td className="py-2.5 pr-4">
                      {PRODUCT_TYPE_LABELS[row.type] ?? row.type}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-primary">
                      {row.published}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                      {row.draft}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                      {row.archived}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">
                      {row.total}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="py-2.5 pr-4">All</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-primary">
                    {catalog.publishedProducts}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                    {catalog.rows.reduce((s, r) => s + r.draft, 0)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                    {catalog.rows.reduce((s, r) => s + r.archived, 0)}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums">
                    {catalog.totalProducts}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Atlas interest + activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel code="A-01" title="Atlas interest">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-center">
            <div className="bg-background p-3">
              <div className="text-2xl font-semibold tabular-nums">
                {atlas.briefCount}
              </div>
              <span className="mono-label text-muted-foreground">Briefs</span>
            </div>
            <div className="bg-background p-3">
              <div className="text-2xl font-semibold tabular-nums">
                {atlas.atlasMatchRate == null
                  ? "—"
                  : `${Math.round(atlas.atlasMatchRate * 100)}%`}
              </div>
              <span className="mono-label text-muted-foreground">
                Match rate
              </span>
            </div>
            <div className="bg-background p-3">
              <div className="text-2xl font-semibold tabular-nums">
                {atlas.atlasGapTurns}
              </div>
              <span className="mono-label text-muted-foreground">Gaps</span>
            </div>
          </div>

          <p className="mt-4 mb-2 text-xs text-muted-foreground">
            Recent briefs. A gap (no match) is the clearest signal of missing
            catalog coverage.
          </p>
          {atlas.recentBriefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No briefs yet. They appear here as buyers describe projects to
              Atlas.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {atlas.recentBriefs.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="truncate" title={b.brief}>
                    {b.brief}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                      b.matched
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {b.matched ? "Matched" : "No match"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel code="D-01" title="Downloads">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold tabular-nums">
                {activity.downloadsTotal.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {activity.downloads30d} in 30 days
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              signed download URLs issued
            </p>
          </Panel>

          <Panel code="U-01" title="Audience">
            {audience.roleCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {audience.roleCounts.map((r) => (
                  <li
                    key={r.role}
                    className="flex items-center justify-between"
                  >
                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                      {r.role}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {r.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel code="Q-01" title="Reviews">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold tabular-nums">
                {avgRating == null ? "—" : avgRating.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {activity.reviewCount} review
                {activity.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              average rating across the catalog
            </p>
          </Panel>
        </div>
      </div>
    </section>
  );
}
