import Link from "next/link";
import type { ProductType } from "@prisma/client";
import {
  browseProducts,
  browseFacets,
  listPublishedCategories,
  type ValueFacet,
} from "@/lib/products/storefront-queries";
import { ProductCard } from "@/components/storefront/product-card";
import { PRODUCT_TYPE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = {
  type?: string;
  category?: string;
  q?: string;
  industry?: string;
  theme?: string;
  style?: string;
  price?: string;
  sale?: string;
  page?: string;
};

const TYPE_ORDER: ProductType[] = [
  "GAME_ASSET",
  "ENVIRONMENT_KIT",
  "PROCEDURAL_TOOL",
  "COURSE",
  "BUNDLE",
];

const PRICE_BUCKETS: {
  token: string;
  label: string;
  minCents?: number;
  maxCents?: number;
}[] = [
  { token: "free", label: "Free", maxCents: 0 },
  { token: "under-50", label: "Under $50", minCents: 1, maxCents: 4999 },
  { token: "50-100", label: "$50 to $100", minCents: 5000, maxCents: 9999 },
  { token: "over-100", label: "$100 and up", minCents: 10000 },
];

function priceRange(token?: string): {
  minPriceCents?: number;
  maxPriceCents?: number;
} {
  const bucket = PRICE_BUCKETS.find((b) => b.token === token);
  if (!bucket) return {};
  return { minPriceCents: bucket.minCents, maxPriceCents: bucket.maxCents };
}

function buildHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.type) sp.set("type", merged.type);
  if (merged.category) sp.set("category", merged.category);
  if (merged.industry) sp.set("industry", merged.industry);
  if (merged.theme) sp.set("theme", merged.theme);
  if (merged.style) sp.set("style", merged.style);
  if (merged.price) sp.set("price", merged.price);
  if (merged.sale) sp.set("sale", merged.sale);
  if (merged.page && merged.page !== "1") sp.set("page", merged.page);
  const qs = sp.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

/** A single-select facet panel: "All" + a count-labelled link per value. */
function FacetPanel({
  title,
  field,
  values,
  active,
  base,
}: {
  title: string;
  field: "industry" | "theme" | "style";
  values: ValueFacet[];
  active: string | undefined;
  base: SearchParams;
}) {
  if (values.length === 0) return null;
  return (
    <div className="bg-background p-4">
      <h2 className="mono-label mb-3">{title}</h2>
      <ul className="space-y-0.5 text-sm">
        <li>
          <Link
            href={buildHref(base, { [field]: undefined, page: "1" })}
            className={`block px-2 py-1.5 transition-colors ${!active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
          >
            All
          </Link>
        </li>
        {values.map((v) => (
          <li key={v.value}>
            <Link
              href={buildHref(base, { [field]: v.value, page: "1" })}
              className={`flex justify-between gap-2 px-2 py-1.5 transition-colors ${active === v.value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
            >
              <span className="truncate">{v.value}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {String(v.count).padStart(2, "0")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const type =
    sp.type && TYPE_ORDER.includes(sp.type as ProductType)
      ? (sp.type as ProductType)
      : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = priceRange(sp.price);
  const onSale = sp.sale === "1";

  const [result, facets, categories] = await Promise.all([
    browseProducts({
      type,
      categorySlug: sp.category,
      q: sp.q,
      industry: sp.industry,
      theme: sp.theme,
      style: sp.style,
      onSale,
      minPriceCents: range.minPriceCents,
      maxPriceCents: range.maxPriceCents,
      page,
    }),
    browseFacets({ categorySlug: sp.category, q: sp.q }),
    listPublishedCategories(),
  ]);

  const facetByType = new Map(facets.types.map((f) => [f.type, f.count]));
  const totalAcrossTypes = facets.types.reduce((n, f) => n + f.count, 0);
  const activePrice = PRICE_BUCKETS.some((b) => b.token === sp.price)
    ? sp.price
    : undefined;
  const filtersActive = Boolean(
    type ||
      sp.category ||
      sp.q ||
      sp.industry ||
      sp.theme ||
      sp.style ||
      activePrice ||
      onSale,
  );

  return (
    <section className="mx-auto max-w-[1600px] px-6 py-12 md:px-10">
      <span className="mono-label">Catalog index</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Browse the catalog
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Game assets, environment kits, procedural tools, courses, and bundles, built to be customized and made uniquely yours.
      </p>

      <form action="/browse" method="get" className="mt-8 flex gap-2">
        {type ? <input type="hidden" name="type" value={type} /> : null}
        {sp.category ? (
          <input type="hidden" name="category" value={sp.category} />
        ) : null}
        {sp.industry ? (
          <input type="hidden" name="industry" value={sp.industry} />
        ) : null}
        {sp.theme ? <input type="hidden" name="theme" value={sp.theme} /> : null}
        {sp.style ? <input type="hidden" name="style" value={sp.style} /> : null}
        {activePrice ? (
          <input type="hidden" name="price" value={activePrice} />
        ) : null}
        {onSale ? <input type="hidden" name="sale" value="1" /> : null}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search assets, kits, tools…"
          className="w-full max-w-md border border-border bg-input/40 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-ring"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="space-y-px self-start border border-border bg-border">
          <div className="bg-background p-4">
            <h2 className="mono-label mb-3">Type</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href={buildHref(sp, { type: undefined, page: "1" })}
                  className={`flex justify-between px-2 py-1.5 transition-colors ${!type ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                >
                  <span>All</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(totalAcrossTypes).padStart(2, "0")}
                  </span>
                </Link>
              </li>
              {TYPE_ORDER.map((t) => (
                <li key={t}>
                  <Link
                    href={buildHref(sp, { type: t, page: "1" })}
                    className={`flex justify-between px-2 py-1.5 transition-colors ${type === t ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                  >
                    <span>{PRODUCT_TYPE_LABELS[t]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(facetByType.get(t) ?? 0).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-background p-4">
            <h2 className="mono-label mb-3">Category</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href={buildHref(sp, { category: undefined, page: "1" })}
                  className={`block px-2 py-1.5 transition-colors ${!sp.category ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                >
                  All categories
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={buildHref(sp, { category: c.slug, page: "1" })}
                    className={`flex justify-between px-2 py-1.5 transition-colors ${sp.category === c.slug ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                  >
                    <span>{c.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(c._count.products).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-background p-4">
            <h2 className="mono-label mb-3">Price</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href={buildHref(sp, { price: undefined, page: "1" })}
                  className={`block px-2 py-1.5 transition-colors ${!activePrice ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                >
                  Any price
                </Link>
              </li>
              {PRICE_BUCKETS.map((b) => (
                <li key={b.token}>
                  <Link
                    href={buildHref(sp, { price: b.token, page: "1" })}
                    className={`block px-2 py-1.5 transition-colors ${activePrice === b.token ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                  >
                    {b.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-background p-4">
            <h2 className="mono-label mb-3">Discount</h2>
            <Link
              href={buildHref(sp, {
                sale: onSale ? undefined : "1",
                page: "1",
              })}
              className={`flex items-center justify-between px-2 py-1.5 text-sm transition-colors ${onSale ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
            >
              <span>On sale only</span>
              <span className="font-mono text-xs text-muted-foreground">
                {String(facets.onSaleCount).padStart(2, "0")}
              </span>
            </Link>
          </div>

          <FacetPanel
            title="Industry"
            field="industry"
            values={facets.industry}
            active={sp.industry}
            base={sp}
          />
          <FacetPanel
            title="Theme"
            field="theme"
            values={facets.theme}
            active={sp.theme}
            base={sp}
          />
          <FacetPanel
            title="Style"
            field="style"
            values={facets.style}
            active={sp.style}
            base={sp}
          />

          {filtersActive ? (
            <div className="bg-background p-4">
              <Link
                href="/browse"
                className="block px-2 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                ✕ Clear all filters
              </Link>
            </div>
          ) : null}
        </aside>

        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {String(result.total).padStart(2, "0")}{" "}
            {result.total === 1 ? "result" : "results"}
            {sp.q ? ` · query “${sp.q}”` : ""}
          </p>

          {result.items.length === 0 ? (
            <div className="border border-dashed border-border py-20 text-center text-muted-foreground">
              No products match these filters yet.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {result.pageCount > 1 ? (
            <nav className="mt-10 flex items-center justify-center gap-2 font-mono text-sm">
              {page > 1 ? (
                <Link
                  href={buildHref(sp, { page: String(page - 1) })}
                  className="border border-border px-3 py-1.5 transition-colors hover:border-primary/60 hover:bg-card/60"
                >
                  ← Prev
                </Link>
              ) : null}
              <span className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
                {String(page).padStart(2, "0")} / {String(result.pageCount).padStart(2, "0")}
              </span>
              {page < result.pageCount ? (
                <Link
                  href={buildHref(sp, { page: String(page + 1) })}
                  className="border border-border px-3 py-1.5 transition-colors hover:border-primary/60 hover:bg-card/60"
                >
                  Next →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}
