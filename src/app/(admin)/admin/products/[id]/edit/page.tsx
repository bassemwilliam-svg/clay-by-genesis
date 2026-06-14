import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { AssetUploader } from "@/components/admin/asset-uploader";
import { AssetDownloadButton } from "@/components/admin/asset-download-button";
import { S3AttachForm } from "@/components/admin/s3-attach-form";
import { BundleMembers } from "@/components/admin/bundle-members";
import { setProductStatus, updateProduct } from "@/lib/products/actions";
import {
  getBundleEditorData,
  getProductForEdit,
  getProductFormOptions,
} from "@/lib/products/queries";
import { listVersions } from "@/lib/assets/service";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-border text-muted-foreground",
  PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
  ARCHIVED: "border-border bg-muted/40 text-muted-foreground",
};

const DOWNLOADABLE_TYPES = new Set([
  "GAME_ASSET",
  "ENVIRONMENT_KIT",
  "PROCEDURAL_TOOL",
]);

function formatBytes(bytes: bigint | null): string {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Number(bytes);
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, options] = await Promise.all([
    getProductForEdit(id),
    getProductFormOptions(),
  ]);

  if (!product) notFound();

  const downloadable = DOWNLOADABLE_TYPES.has(product.type);
  const versions = downloadable ? await listVersions(id) : [];

  const isBundle = product.type === "BUNDLE";
  const bundleData = isBundle ? await getBundleEditorData(id) : null;

  // Single form with multiple submit buttons: only the clicked button's
  // name/value posts, so one inline action covers every transition.
  async function transition(formData: FormData) {
    "use server";
    const next = String(formData.get("next"));
    await setProductStatus(id, next);
  }

  const boundUpdate = updateProduct.bind(null, id);

  return (
    <section className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <Link
        href="/admin/products"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Products
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {product.title}
          </h1>
          <span
            className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[product.status]}`}
          >
            {product.status}
          </span>
        </div>

        <form action={transition} className="flex flex-wrap gap-2">
          {product.status !== "PUBLISHED" ? (
            <button
              name="next"
              value="PUBLISHED"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Publish
            </button>
          ) : (
            <button
              name="next"
              value="DRAFT"
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm transition hover:bg-muted/40"
            >
              Unpublish
            </button>
          )}
          {product.status !== "ARCHIVED" ? (
            <button
              name="next"
              value="ARCHIVED"
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm text-muted-foreground transition hover:bg-muted/40"
            >
              Archive
            </button>
          ) : (
            <button
              name="next"
              value="DRAFT"
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm transition hover:bg-muted/40"
            >
              Restore to draft
            </button>
          )}
        </form>
      </div>

      <div className="mt-8">
        <ProductForm
          mode="edit"
          action={boundUpdate}
          options={options}
          initial={product}
        />
      </div>

      {downloadable ? (
        <div className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Asset files</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable, versioned downloads. Uploads go straight from the browser
            to object storage; entitlements cover every version.
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Version</th>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Current</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No versions yet.
                    </td>
                  </tr>
                ) : (
                  versions.map((v) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-mono text-xs">{v.semver}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{v.fileName}</td>
                      <td className="px-4 py-2.5">{formatBytes(v.fileSizeBytes)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{v.uploadStatus}</td>
                      <td className="px-4 py-2.5">{v.isCurrent ? "✓" : ""}</td>
                      <td className="px-4 py-2.5 text-right">
                        {v.uploadStatus === "READY" ? (
                          <AssetDownloadButton versionId={v.id} />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <AssetUploader productId={id} />
            <S3AttachForm productId={id} />
          </div>
        </div>
      ) : null}

      {isBundle && bundleData ? (
        <BundleMembers
          bundleId={id}
          members={bundleData.members}
          candidates={bundleData.candidates}
          bundlePriceCents={product.priceCents}
          currency={product.currency}
        />
      ) : null}
    </section>
  );
}
