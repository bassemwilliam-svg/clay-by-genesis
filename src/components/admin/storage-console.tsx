"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetDownloadButton } from "@/components/admin/asset-download-button";

/*
 * Import / Export console. Three jobs, three tabs:
 *  - Browse: walk the live bucket, select objects, then create draft products
 *    or attach a single object to an existing product (import by reference).
 *  - Paste: same import, driven by a pasted key list (no bucket read needed).
 *  - Export: download the catalog as CSV/JSON, mint signed links, or copy
 *    asset files to another S3 bucket/prefix.
 */

type ImportType = "GAME_ASSET" | "ENVIRONMENT_KIT" | "PROCEDURAL_TOOL";

const TYPE_LABELS: Record<ImportType, string> = {
  GAME_ASSET: "Game asset",
  ENVIRONMENT_KIT: "Environment kit",
  PROCEDURAL_TOOL: "Procedural tool",
};

type Target = {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
};

type ExportVersion = {
  id: string;
  semver: string;
  fileName: string;
  sizeBytes: number | null;
  storageKey: string;
  productTitle: string;
  productSlug: string;
};

type StorageObject = {
  key: string;
  sizeBytes: number;
  lastModified: string | null;
};

type ImportResult = {
  created: { id: string; slug: string; title: string; key: string }[];
  skipped: { key: string; reason: string }[];
};

const inputCls =
  "w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";
const btnPrimary =
  "inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60";
const btnGhost =
  "inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium transition hover:bg-muted/40 disabled:opacity-60";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function basename(key: string): string {
  return key.split("/").filter(Boolean).pop() ?? key;
}

export function StorageConsole({
  configured,
  provider,
  targets,
  exportVersions,
  defaultExportBucket,
}: {
  configured: boolean;
  provider: string;
  targets: Target[];
  exportVersions: ExportVersion[];
  defaultExportBucket: string;
}) {
  const [tab, setTab] = useState<"browse" | "paste" | "export">(
    configured ? "browse" : "paste",
  );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {(
          [
            ["browse", "Browse bucket"],
            ["paste", "Paste keys"],
            ["export", "Export"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "browse" ? (
          <BrowseTab
            configured={configured}
            provider={provider}
            targets={targets}
          />
        ) : null}
        {tab === "paste" ? <PasteTab targets={targets} /> : null}
        {tab === "export" ? (
          <ExportTab
            configured={configured}
            versions={exportVersions}
            defaultBucket={defaultExportBucket}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Browse */

function BrowseTab({
  configured,
  provider,
  targets,
}: {
  configured: boolean;
  provider: string;
  targets: Target[];
}) {
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (toPrefix: string, token?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/storage/list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prefix: toPrefix || undefined,
            continuationToken: token,
            delimiter: "/",
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Could not list the bucket.");
          return;
        }
        if (body.configured === false) {
          setError("Storage isn't configured.");
          return;
        }
        setPrefix(body.prefix ?? toPrefix);
        if (token) {
          setObjects((prev) => [...prev, ...(body.objects ?? [])]);
        } else {
          setObjects(body.objects ?? []);
          setPrefixes(body.prefixes ?? []);
        }
        setNextToken(body.nextToken);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!configured) return;
    // Defer so the fetch's synchronous setState prelude doesn't run inside the
    // effect body (avoids cascading-render churn on mount).
    const t = setTimeout(() => void load(""), 0);
    return () => clearTimeout(t);
  }, [configured, load]);

  if (!configured) return <NotConfigured provider={provider} />;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const segments = prefix ? prefix.replace(/\/$/, "").split("/") : [];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
        <button
          type="button"
          onClick={() => {
            setSelected(new Set());
            void load("");
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          {provider}://
        </button>
        {segments.map((seg, i) => {
          const to = segments.slice(0, i + 1).join("/") + "/";
          return (
            <span key={to} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => void load(to)}
                className="text-muted-foreground hover:text-foreground"
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Object</th>
              <th className="px-4 py-2.5 font-medium text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {prefixes.map((p) => (
              <tr key={p} className="border-t border-border">
                <td className="px-4 py-2.5" />
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => void load(p)}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {basename(p)}/
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  —
                </td>
              </tr>
            ))}
            {objects.map((o) => (
              <tr key={o.key} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(o.key)}
                    onChange={() => toggle(o.key)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {basename(o.key)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {formatBytes(o.sizeBytes)}
                </td>
              </tr>
            ))}
            {!loading && prefixes.length === 0 && objects.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nothing here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {nextToken ? (
          <button
            type="button"
            onClick={() => void load(prefix, nextToken)}
            disabled={loading}
            className={btnGhost}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {selected.size} selected
        </span>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>

      <ImportActions
        keys={[...selected]}
        targets={targets}
        onImported={() => setSelected(new Set())}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- Paste */

function PasteTab({ targets }: { targets: Target[] }) {
  const [text, setText] = useState("");
  const keys = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Paste object keys, one per line. Use this when you have a manifest and
        don&apos;t need to browse the bucket.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"game-assets/crate.zip\nenvironments/ww2-bunker/v1/bunker.zip"}
        className={`${inputCls} font-mono`}
      />
      <p className="text-xs text-muted-foreground">{keys.length} key(s)</p>
      <ImportActions keys={keys} targets={targets} onImported={() => setText("")} />
    </div>
  );
}

/* --------------------------------------------------- Shared import actions */

function ImportActions({
  keys,
  targets,
  onImported,
}: {
  keys: string[];
  targets: Target[];
  onImported: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<ImportType>("GAME_ASSET");
  const [productId, setProductId] = useState("");
  const [semver, setSemver] = useState("1.0.0");
  const [busy, setBusy] = useState<"draft" | "attach" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setMessage(null);
    setError(null);
  };

  async function createDrafts() {
    if (keys.length === 0) {
      setError("Select or paste at least one object.");
      return;
    }
    reset();
    setBusy("draft");
    try {
      const res = await fetch("/api/admin/storage/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, keys }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Import failed.");
        return;
      }
      setResult(body as ImportResult);
      onImported();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function attach() {
    if (keys.length !== 1) {
      setError("Attach works on exactly one object at a time.");
      return;
    }
    if (!productId) {
      setError("Choose a product to attach to.");
      return;
    }
    reset();
    setBusy("attach");
    try {
      const res = await fetch("/api/admin/storage/attach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, key: keys[0], semver, makeCurrent: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Attach failed.");
        return;
      }
      setMessage("Attached to the selected product.");
      onImported();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 rounded-lg border border-border p-5 lg:grid-cols-2">
      {/* Create drafts */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Create draft products</h3>
        <p className="text-xs text-muted-foreground">
          One DRAFT product per object; title and slug are inferred from the key.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product type
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ImportType)}
            className={inputCls}
          >
            {(Object.keys(TYPE_LABELS) as ImportType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={createDrafts}
          disabled={busy !== null || keys.length === 0}
          className={btnPrimary}
        >
          {busy === "draft"
            ? "Importing…"
            : `Create ${keys.length || ""} draft${keys.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Attach to existing */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Attach to a product</h3>
        <p className="text-xs text-muted-foreground">
          Add a single object as a new version of an existing product.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputCls}
          >
            <option value="">Choose product…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status.toLowerCase()})
              </option>
            ))}
          </select>
          <input
            value={semver}
            onChange={(e) => setSemver(e.target.value)}
            placeholder="1.0.0"
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={attach}
          disabled={busy !== null || keys.length !== 1}
          className={btnGhost}
        >
          {busy === "attach" ? "Attaching…" : "Attach single object"}
        </button>
      </div>

      {/* Feedback spans both columns */}
      {(error || message || result) && (
        <div className="lg:col-span-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-primary">{message}</p> : null}
          {result ? (
            <div className="space-y-2 text-sm">
              {result.created.length > 0 ? (
                <p className="text-primary">
                  Created {result.created.length} draft
                  {result.created.length === 1 ? "" : "s"}.
                </p>
              ) : null}
              {result.skipped.length > 0 ? (
                <details className="rounded-md border border-border bg-muted/30 p-3">
                  <summary className="cursor-pointer text-muted-foreground">
                    Skipped {result.skipped.length}
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                    {result.skipped.map((s) => (
                      <li key={s.key}>
                        {basename(s.key)} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Export */

function ExportTab({
  configured,
  versions,
  defaultBucket,
}: {
  configured: boolean;
  versions: ExportVersion[];
  defaultBucket: string;
}) {
  const [destBucket, setDestBucket] = useState(defaultBucket);
  const [destPrefix, setDestPrefix] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{
    copied: number;
    failed: { versionId: string; reason: string }[];
  } | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = versions.length > 0 && selected.size === versions.length;

  async function copy() {
    setError(null);
    setCopyResult(null);
    if (!destBucket.trim()) {
      setError("Enter a destination bucket.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one file to copy.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/storage/copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          versionIds: [...selected],
          destBucket: destBucket.trim(),
          destPrefix: destPrefix.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Copy failed.");
        return;
      }
      setCopyResult({ copied: body.copied?.length ?? 0, failed: body.failed ?? [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Catalog data export */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Export catalog data</h3>
        <p className="text-xs text-muted-foreground">
          Every product with its asset keys, versions, and sizes.
        </p>
        <div className="flex gap-3">
          <a href="/api/admin/export?format=csv" className={btnGhost} download>
            Download CSV
          </a>
          <a href="/api/admin/export?format=json" className={btnGhost} download>
            Download JSON
          </a>
        </div>
      </div>

      {/* Copy files to a bucket */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Copy files to S3</h3>
          <p className="text-xs text-muted-foreground">
            Server-side copy of selected asset files to another bucket/prefix.
            {!configured ? " Requires storage to be configured." : ""}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Destination bucket
            </span>
            <input
              value={destBucket}
              onChange={(e) => setDestBucket(e.target.value)}
              placeholder="my-export-bucket"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Destination prefix (optional)
            </span>
            <input
              value={destPrefix}
              onChange={(e) => setDestPrefix(e.target.value)}
              placeholder="backups/2026-06/"
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(versions.map((v) => v.id)),
                      )
                    }
                    className="h-4 w-4"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">File</th>
                <th className="px-4 py-2.5 font-medium">Ver</th>
                <th className="px-4 py-2.5 font-medium text-right">Size</th>
                <th className="px-4 py-2.5 font-medium text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No asset files yet.
                  </td>
                </tr>
              ) : (
                versions.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-2.5">{v.productTitle}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {v.fileName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{v.semver}</td>
                    <td className="px-4 py-2.5 text-right">
                      {formatBytes(v.sizeBytes)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <AssetDownloadButton versionId={v.id} label="Link" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copy}
            disabled={busy || !configured}
            className={btnPrimary}
          >
            {busy ? "Copying…" : `Copy ${selected.size || ""} to bucket`}
          </button>
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {copyResult ? (
          <div className="space-y-2 text-sm">
            <p className="text-primary">Copied {copyResult.copied} file(s).</p>
            {copyResult.failed.length > 0 ? (
              <details className="rounded-md border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-muted-foreground">
                  {copyResult.failed.length} failed
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                  {copyResult.failed.map((f) => (
                    <li key={f.versionId}>
                      {f.versionId} — {f.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Not configured */

function NotConfigured({ provider }: { provider: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Storage not configured
      </span>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Live bucket browsing needs storage credentials. Set{" "}
        <code className="font-mono">STORAGE_PROVIDER=s3</code> and the{" "}
        <code className="font-mono">S3_*</code> environment variables (region,
        bucket, access key, secret). Current provider:{" "}
        <code className="font-mono">{provider}</code>. You can still paste a key
        list once credentials are in place.
      </p>
    </div>
  );
}
