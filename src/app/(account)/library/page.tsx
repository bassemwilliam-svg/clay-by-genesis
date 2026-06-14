import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getLibraryForUser } from "@/lib/downloads/library";
import { formatBytes, PRODUCT_TYPE_LABELS } from "@/lib/format";
import { DownloadButton } from "@/components/library/download-button";

// Owned downloadable assets + ownership-gated, expiring downloads. Always
// dynamic: ownership flips the instant the webhook pipeline grants or a refund
// revokes an entitlement.
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const SOURCE_LABELS: Record<string, string> = {
  PURCHASE: "Purchased",
  BUNDLE: "From a bundle",
  MEMBERSHIP: "Included with membership",
  GRANT: "Granted",
};

export default async function LibraryPage() {
  const user = await requireUser();
  const items = await getLibraryForUser(user.id);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Everything you own, ready to download. Links are generated per click and
        expire after five minutes, so grab a fresh one whenever you need it.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 border border-dashed border-border/70 px-6 py-16 text-center">
          <p className="text-muted-foreground">
            No downloadable assets yet. Purchases and bundle contents land here
            once payment clears.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-5">
          {items.map((item) => {
            const p = item.product;
            const current = p.versions.find((v) => v.isCurrent) ?? p.versions[0];
            const older = p.versions.filter((v) => v.id !== current?.id);
            return (
              <li key={p.id} className="rounded-lg border border-border">
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="mono-label text-[0.625rem]">
                        {PRODUCT_TYPE_LABELS[p.type] ?? p.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {SOURCE_LABELS[item.source] ?? item.source}
                      </span>
                    </div>
                    <Link
                      href={`/products/${p.slug}`}
                      className="mt-1 block truncate text-lg font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    {current ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {current.fileName} · v{current.semver} ·{" "}
                        {formatBytes(current.fileSizeBytes)}
                      </p>
                    ) : null}
                  </div>

                  {current ? (
                    <DownloadButton
                      versionId={current.id}
                      label={`Download v${current.semver}`}
                    />
                  ) : null}
                </div>

                {older.length > 0 ? (
                  <details className="border-t border-border/60 px-5 py-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      {older.length} earlier version
                      {older.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {older.map((v) => (
                        <li
                          key={v.id}
                          className="flex flex-wrap items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-muted-foreground">
                            v{v.semver} · {formatBytes(v.fileSizeBytes)} ·{" "}
                            {dateFmt.format(v.createdAt)}
                          </span>
                          <DownloadButton
                            versionId={v.id}
                            variant="ghost"
                            label={`Download v${v.semver}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
