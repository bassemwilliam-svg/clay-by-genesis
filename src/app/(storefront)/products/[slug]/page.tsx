import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublishedProductBySlug,
  listPublishedSlugs,
} from "@/lib/products/storefront-queries";
import { bundleSavings, formatMoney, PRODUCT_TYPE_LABELS } from "@/lib/format";
import { ParameterTable } from "@/components/storefront/parameter-table";
import { ProductCard } from "@/components/storefront/product-card";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { SchematicArt } from "@/components/storefront/schematic-art";
import { hashSeed } from "@/lib/schematic";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await listPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Stable catalog code, e.g. CL-3F9A, reads like a part number. */
function partCode(slug: string): string {
  return `CL-${hashSeed(slug).toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

type SpecRow = { label: string; value: string };

function specsFor(
  product: NonNullable<Awaited<ReturnType<typeof getPublishedProductBySlug>>>,
): SpecRow[] {
  const rows: SpecRow[] = [];
  const yn = (b: boolean) => (b ? "Yes" : "No");
  const list = (a: string[]) => (a.length ? a.join(", ") : "-");

  if (product.gameAssetDetail) {
    const d = product.gameAssetDetail;
    if (d.polycount != null) rows.push({ label: "Polycount", value: d.polycount.toLocaleString() });
    rows.push({ label: "Rigged", value: yn(d.isRigged) });
    rows.push({ label: "Animated", value: yn(d.isAnimated) });
    rows.push({ label: "PBR textures", value: yn(d.isPbr) });
    if (d.textureResMax != null) rows.push({ label: "Max texture res", value: `${d.textureResMax}px` });
    if (d.lodCount != null) rows.push({ label: "LOD levels", value: String(d.lodCount) });
    rows.push({ label: "File formats", value: list(d.fileFormats) });
    rows.push({ label: "Target engines", value: list(d.targetEngines) });
    rows.push({ label: "Software", value: list(d.software) });
  }
  if (product.environmentKitDetail) {
    const d = product.environmentKitDetail;
    if (d.moduleCount != null) rows.push({ label: "Modules", value: String(d.moduleCount) });
    rows.push({ label: "Modular", value: yn(d.isModular) });
    if (d.coverageAreaM2 != null) rows.push({ label: "Coverage", value: `${d.coverageAreaM2} m²` });
    if (d.biome) rows.push({ label: "Biome", value: d.biome });
    rows.push({ label: "File formats", value: list(d.fileFormats) });
    rows.push({ label: "Target engines", value: list(d.targetEngines) });
    rows.push({ label: "Software", value: list(d.software) });
  }
  if (product.proceduralToolDetail) {
    const d = product.proceduralToolDetail;
    if (d.hostSoftware) rows.push({ label: "Host software", value: d.hostSoftware });
    if (d.toolType) rows.push({ label: "Tool type", value: d.toolType });
  }
  return rows;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  const onSale =
    product.discountCents != null && product.discountCents < product.priceCents;
  const hero = product.media[0];
  const gallery = product.media.slice(1);
  const specs = specsFor(product);
  const manifest = product.proceduralToolDetail?.parameterManifest;
  const typeLabel = PRODUCT_TYPE_LABELS[product.type] ?? product.type;
  const code = partCode(product.slug);

  const bundleMembers = product.bundleItems.map((bi) => bi.member);
  const savings =
    product.type === "BUNDLE" && bundleMembers.length > 0
      ? bundleSavings(bundleMembers, product.priceCents)
      : null;

  return (
    <article className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      {/* Breadcrumb / coordinate trail. */}
      <nav className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/browse" className="transition-colors hover:text-foreground">
          BROWSE
        </Link>
        {product.category ? (
          <>
            <span className="text-border">/</span>
            <Link
              href={`/categories/${product.category.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {product.category.name.toUpperCase()}
            </Link>
          </>
        ) : null}
        <span className="text-border">/</span>
        <span className="text-primary/70">{code}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          {/* Cover, real render when present, generative schematic otherwise. */}
          <div className="bp-ticks clay-cover relative aspect-[4/3] w-full overflow-hidden border border-border">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.url}
                alt={hero.alt ?? product.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <SchematicArt
                seed={product.slug}
                type={product.type}
                className="absolute inset-0 h-full w-full"
              />
            )}
            <span className="mono-label absolute left-3 top-3 border border-border bg-background/70 px-2 py-1 backdrop-blur">
              {typeLabel}
            </span>
            <span className="absolute right-3 top-3 font-mono text-[0.625rem] tracking-widest text-primary/80">
              {code}
            </span>
          </div>
          {gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.map((m) => (
                <div
                  key={m.id}
                  className="aspect-square overflow-hidden border border-border bg-card"
                  style={{
                    backgroundImage: `url(${m.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  aria-label={m.alt ?? ""}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <span className="mono-label">{typeLabel}</span>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight">
            {product.title}
          </h1>
          {product.shortDesc ? (
            <p className="mt-3 text-muted-foreground">{product.shortDesc}</p>
          ) : null}

          {/* Price readout. */}
          <div className="mt-6 flex items-baseline gap-3 border-y border-dashed border-border/70 py-4 font-mono">
            <span className="mono-label not-italic">
              {product.type === "BUNDLE" ? "BUNDLE PRICE" : "UNIT PRICE"}
            </span>
            {onSale ? (
              <>
                <span className="ml-auto text-2xl font-semibold text-primary">
                  {formatMoney(product.discountCents!, product.currency)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatMoney(product.priceCents, product.currency)}
                </span>
              </>
            ) : (
              <span className="ml-auto text-2xl font-semibold">
                {formatMoney(product.priceCents, product.currency)}
              </span>
            )}
          </div>

          {savings && savings.savingsCents > 0 ? (
            <p className="mt-3 font-mono text-sm text-primary">
              Save {formatMoney(savings.savingsCents, product.currency)} (
              {savings.savingsPct}%) versus buying the {bundleMembers.length}{" "}
              items separately.
            </p>
          ) : null}

          <AddToCartButton productId={product.id} />

          {product.license ? (
            <div className="mt-6 border border-border p-4 text-sm">
              <span className="mono-label">License</span>
              <p className="mt-2 font-medium">{product.license.name}</p>
              {product.license.summary ? (
                <p className="mt-1 text-muted-foreground">
                  {product.license.summary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {product.type === "BUNDLE" && bundleMembers.length > 0 ? (
        <section className="mt-14">
          <span className="mono-label">{`// ${bundleMembers.length} products included`}</span>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            What&apos;s included
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buy the bundle once and own every item below. Each lands in your
            library individually, ready to download.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bundleMembers.map((m) => (
              <ProductCard key={m.slug} product={m} />
            ))}
          </div>
        </section>
      ) : null}

      {product.fullDesc ? (
        <section className="mt-14 max-w-3xl">
          <span className="mono-label">{"// overview"}</span>
          <p className="mt-3 whitespace-pre-line text-muted-foreground">
            {product.fullDesc}
          </p>
        </section>
      ) : null}

      {specs.length > 0 ? (
        <section className="mt-14">
          <span className="mono-label">Specification sheet</span>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Technical data
          </h2>
          <div className="mt-4 border border-border">
            <table className="w-full font-mono text-sm">
              <tbody>
                {specs.map((row, i) => (
                  <tr
                    key={row.label}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="w-2/5 border-r border-border/60 px-4 py-2.5 text-muted-foreground">
                      <span className="text-primary/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>{" "}
                      {row.label}
                    </td>
                    <td className="px-4 py-2.5">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {manifest ? (
        <section className="mt-14">
          <span className="mono-label">Control panel</span>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Editable parameters
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tune these before download to make it uniquely yours.
          </p>
          <ParameterTable manifest={manifest} />
        </section>
      ) : null}

      <ProductReviews productId={product.id} />
    </article>
  );
}
