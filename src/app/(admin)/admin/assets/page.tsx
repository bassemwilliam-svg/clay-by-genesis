import { StorageConsole } from "@/components/admin/storage-console";
import { listImportTargets, listVersionsForExport } from "@/lib/products/queries";
import { getStorageProvider } from "@/lib/storage";
import { env } from "@/lib/env";

/*
 * Import / Export console. Imports register the studio's existing S3 objects by
 * reference (no re-upload); exports pull catalog data, signed links, or copies
 * to another bucket. Storage config is resolved server-side so the client can
 * degrade gracefully when credentials aren't set.
 */
export default async function AdminAssetsPage() {
  const storage = getStorageProvider();
  const [targets, exportVersions] = await Promise.all([
    listImportTargets(),
    listVersionsForExport(),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Import / Export</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Bring assets in from S3 by reference — no re-upload — and pull catalog
        data or files back out. Attach objects to existing products or spin up
        draft products straight from the bucket.
      </p>

      <StorageConsole
        configured={storage.isConfigured()}
        provider={storage.name}
        targets={targets}
        exportVersions={exportVersions}
        defaultExportBucket={env.S3_EXPORT_BUCKET ?? ""}
      />
    </section>
  );
}
