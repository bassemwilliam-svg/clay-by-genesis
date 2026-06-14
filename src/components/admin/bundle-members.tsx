"use client";

import { useActionState } from "react";
import { formatMoney, PRODUCT_TYPE_LABELS } from "@/lib/format";
import {
  addBundleMember,
  removeBundleMember,
  type BundleActionState,
} from "@/lib/bundles/actions";

type Member = {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  priceCents: number;
  discountCents: number | null;
  currency: string;
};

type Candidate = { id: string; title: string; type: string; status: string };

const INITIAL: BundleActionState = { ok: false };

/** À la carte price a buyer would pay for this member today (discount wins). */
function effectivePrice(m: Member): number {
  return m.discountCents != null && m.discountCents < m.priceCents
    ? m.discountCents
    : m.priceCents;
}

export function BundleMembers({
  bundleId,
  members,
  candidates,
  bundlePriceCents,
  currency,
}: {
  bundleId: string;
  members: Member[];
  candidates: Candidate[];
  bundlePriceCents: number;
  currency: string;
}) {
  const addAction = addBundleMember.bind(null, bundleId);
  const [state, formAction, pending] = useActionState<BundleActionState, FormData>(
    addAction,
    INITIAL,
  );

  const partsTotal = members.reduce((sum, m) => sum + effectivePrice(m), 0);
  const savings = partsTotal - bundlePriceCents;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">Bundle contents</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Buyers who purchase this bundle receive an entitlement to every product
        listed here, each delivered to their library individually. Bundles can
        &apos;t contain other bundles.
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">À la carte</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products in this bundle yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{m.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {PRODUCT_TYPE_LABELS[m.type] ?? m.type}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {m.status}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatMoney(effectivePrice(m), m.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={removeBundleMember.bind(null, bundleId, m.id)}>
                      <button
                        type="submit"
                        className="text-xs text-muted-foreground transition hover:text-destructive"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {members.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>
            Parts total{" "}
            <span className="text-foreground">
              {formatMoney(partsTotal, currency)}
            </span>
          </span>
          <span>
            Bundle price{" "}
            <span className="text-foreground">
              {formatMoney(bundlePriceCents, currency)}
            </span>
          </span>
          {savings > 0 ? (
            <span className="text-primary">
              Buyers save {formatMoney(savings, currency)}
            </span>
          ) : savings < 0 ? (
            <span className="text-destructive">
              Priced {formatMoney(-savings, currency)} above the parts
            </span>
          ) : (
            <span>Priced level with the parts</span>
          )}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="mono-label">Add a product</span>
          <select
            name="memberId"
            defaultValue=""
            disabled={candidates.length === 0}
            className="h-9 min-w-72 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              {candidates.length === 0
                ? "All eligible products are in this bundle"
                : "Select a product…"}
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {(PRODUCT_TYPE_LABELS[c.type] ?? c.type)} · {c.title}
                {c.status !== "PUBLISHED" ? ` (${c.status})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || candidates.length === 0}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Adding" : "Add to bundle"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
