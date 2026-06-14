"use client";

import { useState, useTransition } from "react";

/*
 * Requests a fresh signed URL from /api/downloads/[id], then starts the
 * download by clicking a synthetic anchor. The signed URL responds with
 * `Content-Disposition: attachment`, so the browser downloads it without
 * navigating away from the library. URLs are short-lived and minted per click,
 * never embedded in the page.
 */
export function DownloadButton({
  versionId,
  label = "Download",
  variant = "primary",
}: {
  versionId: string;
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch(`/api/downloads/${versionId}`, {
          method: "POST",
        });
        const data: { url?: string; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (!res.ok || !data.url) {
          setError(data.error ?? "Download failed. Please try again.");
          return;
        }
        const a = document.createElement("a");
        a.href = data.url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const base =
    "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border text-foreground hover:bg-muted/40";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`${base} ${styles}`}
      >
        {pending ? "Preparing" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
