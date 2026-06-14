import Link from "next/link";
import { listProductsForAdmin } from "@/lib/products/queries";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-border text-muted-foreground",
  PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
  ARCHIVED: "border-border bg-muted/40 text-muted-foreground line-through",
};

const TYPE_LABELS: Record<string, string> = {
  GAME_ASSET: "Game asset",
  ENVIRONMENT_KIT: "Environment kit",
  PROCEDURAL_TOOL: "Procedural tool",
  COURSE: "Course",
  BUNDLE: "Bundle",
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function AdminProductsPage() {
  const products = await listProductsForAdmin();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} item{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          New product
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No products yet.{" "}
                  <Link href="/admin/products/new" className="text-primary hover:underline">
                    Create the first one.
                  </Link>
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="font-medium hover:text-primary"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {TYPE_LABELS[p.type]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.category?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3">{money(p.priceCents, p.currency)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
