"use client";

import { useState } from "react";

/*
 * Admin-only: requests a short-lived signed URL for one asset version and
 * triggers the download. Used in the product asset table and the export
 * console. The link is minted on click (never embedded), so it can't leak.
 */
export function AssetDownloadButton({
  versionId,
  label = "Download",
  className,
}: {
  versionId: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not create a link.");
        return;
      }
      const a = document.createElement("a");
      a.href = body.url;
      a.rel = "noopener";
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={
          className ??
          "font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        }
      >
        {busy ? "Linking…" : label}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
