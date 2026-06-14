"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { CartSummary } from "@/lib/cart/queries";
import { removeFromCart, clearCart } from "@/lib/cart/actions";
import { startCheckout } from "@/lib/checkout/actions";
import { CART_CHANGED_EVENT } from "@/lib/cart/shared";
import { formatMoney, PRODUCT_TYPE_LABELS } from "@/lib/format";
import { TIER_LABEL } from "@/lib/membership/tiers";
import { SchematicArt } from "@/components/storefront/schematic-art";

/*
 * Interactive cart. Seeded with the server-resolved summary, then manages line
 * removal locally for instant feedback (the server action is the source of
 * truth and revalidates on its own). Checkout runs through useActionState so a
 * graceful "not configured yet" message renders inline while payments are
 * still code-first; a successful start redirects to the provider.
 */
export function CartView({ initial }: { initial: CartSummary }) {
  const [items, setItems] = useState(initial.items);
  const [, startTransition] = useTransition();
  const [state, checkoutAction, checkoutPending] = useActionState(
    startCheckout,
    {} as Awaited<ReturnType<typeof startCheckout>>,
  );

  const currency = items[0]?.currency ?? initial.currency;
  const subtotalCents = items.reduce((s, i) => s + i.effectivePriceCents, 0);
  const memberSubtotalCents = items.reduce(
    (s, i) => s + i.memberPriceCents,
    0,
  );
  const savingsCents = subtotalCents - memberSubtotalCents;
  const memberTier = initial.memberTier;
  const hasMemberPricing = savingsCents > 0;

  const broadcast = (count: number) =>
    window.dispatchEvent(
      new CustomEvent(CART_CHANGED_EVENT, { detail: { count } }),
    );

  const remove = (id: string) =>
    startTransition(async () => {
      const { count } = await removeFromCart(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      broadcast(count);
    });

  const clear = () =>
    startTransition(async () => {
      await clearCart();
      setItems([]);
      broadcast(0);
    });

  if (items.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-border p-12 text-center">
        <span className="mono-label">Cart empty</span>
        <p className="mt-2 text-muted-foreground">
          No units staged for checkout.
        </p>
        <Link
          href="/browse"
          className="mt-5 inline-flex h-10 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <ul className="divide-y divide-border border border-border">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-4 p-4">
            <div
              className="relative h-16 w-16 shrink-0 overflow-hidden border border-border bg-card bg-cover bg-center"
              style={
                item.thumbUrl
                  ? { backgroundImage: `url(${item.thumbUrl})` }
                  : undefined
              }
              aria-hidden
            >
              {!item.thumbUrl ? (
                <>
                  <span className="bp-grid absolute inset-0 opacity-60" />
                  <SchematicArt
                    seed={item.slug}
                    type={item.type}
                    className="absolute inset-0 h-full w-full"
                  />
                </>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${item.slug}`}
                className="block truncate font-medium transition-colors hover:text-primary"
              >
                {item.title}
              </Link>
              <span className="mono-label">
                {String(i + 1).padStart(2, "0")} ·{" "}
                {PRODUCT_TYPE_LABELS[item.type] ?? item.type}
              </span>
            </div>
            <div className="text-right">
              {item.memberPriceCents === 0 &&
              item.effectivePriceCents > 0 ? (
                <div className="font-mono font-medium text-primary">
                  Included
                  <span className="block font-mono text-[0.65rem] font-normal text-muted-foreground line-through">
                    {formatMoney(item.effectivePriceCents, item.currency)}
                  </span>
                </div>
              ) : item.memberPriceCents < item.effectivePriceCents ? (
                <div className="font-mono font-medium">
                  {formatMoney(item.memberPriceCents, item.currency)}
                  <span className="block font-mono text-[0.65rem] font-normal text-muted-foreground line-through">
                    {formatMoney(item.effectivePriceCents, item.currency)}
                  </span>
                </div>
              ) : (
                <div className="font-mono font-medium">
                  {formatMoney(item.effectivePriceCents, item.currency)}
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="mt-1 font-mono text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit border border-border p-6">
        <span className="mono-label">Order summary</span>
        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-border/70 pt-3 font-mono">
          <span className="text-muted-foreground">SUBTOTAL</span>
          <span
            className={
              hasMemberPricing
                ? "text-sm text-muted-foreground line-through"
                : "text-xl font-semibold"
            }
          >
            {formatMoney(subtotalCents, currency)}
          </span>
        </div>

        {hasMemberPricing ? (
          <>
            <div className="mt-2 flex items-baseline justify-between font-mono text-sm text-primary">
              <span>{TIER_LABEL[memberTier].toUpperCase()} MEMBER</span>
              <span>−{formatMoney(savingsCents, currency)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-border/70 pt-2 font-mono">
              <span className="text-muted-foreground">TOTAL</span>
              <span className="text-xl font-semibold">
                {formatMoney(memberSubtotalCents, currency)}
              </span>
            </div>
          </>
        ) : null}

        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {String(items.length).padStart(2, "0")} unit
          {items.length === 1 ? "" : "s"} · taxes calculated at checkout
        </p>

        <form action={checkoutAction} className="mt-6">
          <button
            type="submit"
            disabled={checkoutPending}
            className="inline-flex h-11 w-full items-center justify-center bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {checkoutPending ? "Starting checkout…" : "Proceed to checkout"}
          </button>
        </form>

        {state.error ? (
          <p className="mt-3 border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {state.error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={clear}
          className="mt-4 w-full text-center font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear cart
        </button>
      </aside>
    </div>
  );
}
