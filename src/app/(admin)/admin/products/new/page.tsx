import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { createProduct } from "@/lib/products/actions";
import { getProductFormOptions } from "@/lib/products/queries";

export default async function NewProductPage() {
  const options = await getProductFormOptions();

  return (
    <section className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <Link
        href="/admin/products"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Products
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">New product</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a type to reveal its category-specific fields. New products start as
        a draft.
      </p>

      <div className="mt-8">
        <ProductForm mode="create" action={createProduct} options={options} />
      </div>
    </section>
  );
}
