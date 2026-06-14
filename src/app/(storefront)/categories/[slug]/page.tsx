import Link from "next/link";
import { notFound } from "next/navigation";
import {
  browseProducts,
  listPublishedCategories,
} from "@/lib/products/storefront-queries";
import { ProductCard } from "@/components/storefront/product-card";

export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await listPublishedCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categories = await listPublishedCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const result = await browseProducts({ categorySlug: slug, pageSize: 48 });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <nav className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/browse" className="transition-colors hover:text-foreground">
          BROWSE
        </Link>
        <span className="text-border">/</span>
        <span className="text-primary/70">{category.name.toUpperCase()}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {category.name}
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {String(result.total).padStart(2, "0")}{" "}
        {result.total === 1 ? "product" : "products"}
      </p>

      {result.items.length === 0 ? (
        <div className="mt-8 border border-dashed border-border py-20 text-center text-muted-foreground">
          Nothing published in this category yet.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
