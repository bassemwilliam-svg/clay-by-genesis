"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";

/*
 * Attach an object that already lives in storage as a new version of this
 * product — import by reference, no upload. The full bucket browser lives at
 * /admin/assets; this is the quick "I know the key" path on the edit screen.
 */
export function S3AttachForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [semver, setSemver] = useState("1.0.0");
  const [changelog, setChangelog] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function attach(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!key.trim()) {
      setError("Enter the object key (path in the bucket).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/storage/attach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          key: key.trim(),
          semver,
          changelog: changelog || undefined,
          makeCurrent,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not attach that object.");
        return;
      }
      setDone(true);
      setKey("");
      setChangelog("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={attach}
      className="space-y-4 rounded-lg border border-dashed border-border p-5"
    >
      <div>
        <h3 className="text-sm font-medium">Attach from S3</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Register an object that already lives in the bucket as a new version.
          Nothing is re-uploaded.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Object key</span>
        <input
          className={`${inputCls} font-mono`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="environments/ww2-bunker/v1/bunker.zip"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Version (semver)</span>
          <input
            className={inputCls}
            value={semver}
            onChange={(e) => setSemver(e.target.value)}
            placeholder="1.0.0"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Changelog (optional)</span>
          <input
            className={inputCls}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="What changed in this version"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={makeCurrent}
          onChange={(e) => setMakeCurrent(e.target.checked)}
          className="h-4 w-4"
        />
        Make this the current version
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {done ? <p className="text-sm text-primary">Attached.</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium transition hover:bg-muted/40 disabled:opacity-60"
      >
        {busy ? "Attaching…" : "Attach object"}
      </button>
    </form>
  );
}
