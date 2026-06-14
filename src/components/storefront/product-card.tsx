import Link from "next/link";
import { formatMoney, PRODUCT_TYPE_LABELS } from "@/lib/format";
import { SchematicArt } from "@/components/storefront/schematic-art";
import { hashSeed } from "@/lib/schematic";

export type ProductCardData = {
  slug: string;
  title: string;
  type: string;
  shortDesc: string | null;
  priceCents: number;
  discountCents: number | null;
  currency: string;
  category: { name: string; slug: string } | null;
  media: { url: string; alt: string | null }[];
};

/** Stable catalog code, e.g. CL-3F9A, reads like a part number. */
function partCode(slug: string): string {
  return `CL-${hashSeed(slug).toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const thumb = product.media[0]?.url;
  const onSale =
    product.discountCents != null && product.discountCents < product.priceCents;
  const typeLabel = PRODUCT_TYPE_LABELS[product.type] ?? product.type;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex flex-col border border-border bg-card/40 transition-colors duration-200 hover:border-primary/60"
    >
      {/* Hover accent line drawn along the top edge. */}
      <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />

      {/* Cover, real render when present, generative schematic otherwise. */}
      <div className="clay-cover relative aspect-[4/3] w-full overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={product.media[0]?.alt ?? product.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <SchematicArt
            seed={product.slug}
            type={product.type}
            className="absolute inset-0 h-full w-full opacity-90 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}

        {/* Top annotations. */}
        <span className="mono-label absolute left-3 top-3 border border-border bg-background/70 px-2 py-1 backdrop-blur">
          {typeLabel}
        </span>
        <span className="absolute right-3 top-3 font-mono text-[0.625rem] tracking-widest text-primary/80">
          {partCode(product.slug)}
        </span>
      </div>

      {/* Body. */}
      <div className="flex flex-1 flex-col gap-2 border-t border-border p-4">
        {product.category ? (
          <span className="mono-label">{product.category.name}</span>
        ) : null}
        <h3 className="text-balance font-medium leading-tight tracking-tight transition-colors group-hover:text-primary">
          {product.title}
        </h3>
        {product.shortDesc ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {product.shortDesc}
          </p>
        ) : null}

        <div className="mt-auto flex items-baseline gap-2 border-t border-dashed border-border/70 pt-3 font-mono">
          <span className="mono-label not-italic">UNIT</span>
          {onSale ? (
            <>
              <span className="ml-auto text-sm font-semibold text-primary">
                {formatMoney(product.discountCents!, product.currency)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {formatMoney(product.priceCents, product.currency)}
              </span>
            </>
          ) : (
            <span className="ml-auto text-sm font-semibold">
              {formatMoney(product.priceCents, product.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
