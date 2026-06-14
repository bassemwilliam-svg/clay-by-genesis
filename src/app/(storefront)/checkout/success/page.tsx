import Link from "next/link";
import { ClearCartOnMount } from "@/components/cart/clear-cart-on-mount";

/*
 * Post-checkout landing. Informational only, ownership is granted by the
 * payment webhook (Stage 8), not by this redirect. We clear the cart here
 * since the buyer has completed the provider flow.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center md:px-10">
      <ClearCartOnMount />
      <span className="mono-label inline-flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 animate-pulse bg-primary" />
        Order received · confirming
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Thanks for your order
      </h1>
      <p className="mt-3 text-muted-foreground">
        We&#x2019;re confirming your payment. Your purchases will appear in your
        library as soon as it clears, we&#x2019;ll email your receipt too.
      </p>
      {order ? (
        <p className="mt-4 inline-block border border-dashed border-border/70 px-3 py-1.5 font-mono text-xs text-muted-foreground">
          REF <span className="text-primary/70">{order}</span>
        </p>
      ) : null}
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/library"
          className="inline-flex h-11 items-center bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Go to library
        </Link>
        <Link
          href="/browse"
          className="inline-flex h-11 items-center border border-border px-6 text-sm font-medium transition hover:bg-muted/40"
        >
          Keep browsing
        </Link>
      </div>
    </div>
  );
}
