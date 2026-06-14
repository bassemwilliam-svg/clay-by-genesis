"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PART_SIZE = 64 * 1024 * 1024; // 64 MiB parts (>= S3/R2 5 MiB minimum)

const inputCls =
  "w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";

type Phase = "idle" | "uploading" | "finalizing" | "done" | "error";

export function AssetUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [semver, setSemver] = useState("1.0.0");
  const [changelog, setChangelog] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    const partCount = Math.max(1, Math.ceil(file.size / PART_SIZE));
    setPhase("uploading");
    setProgress(0);

    // 1) Presign: server records a PENDING version + opens the multipart upload.
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId,
        semver,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        partCount,
        changelog: changelog || undefined,
      }),
    });
    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}));
      setPhase("error");
      setError(body.error ?? "Could not start the upload.");
      return;
    }
    const { versionId, key, uploadId, partUrls } = (await presignRes.json()) as {
      versionId: string;
      key: string;
      uploadId: string;
      partUrls: { partNumber: number; url: string }[];
    };

    // 2) PUT each part straight to storage; capture its ETag.
    const parts: { partNumber: number; etag: string }[] = [];
    try {
      for (const { partNumber, url } of partUrls) {
        const start = (partNumber - 1) * PART_SIZE;
        const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));
        const put = await fetch(url, { method: "PUT", body: blob });
        if (!put.ok) throw new Error(`Part ${partNumber} failed (${put.status})`);
        const etag = put.headers.get("ETag");
        if (!etag) {
          throw new Error(
            "Storage did not return an ETag, check the bucket CORS exposes the ETag header.",
          );
        }
        parts.push({ partNumber, etag });
        setProgress(Math.round((parts.length / partUrls.length) * 100));
      }
    } catch (err) {
      // Best-effort cleanup of the half-finished upload.
      await fetch("/api/uploads/abort", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId, key, uploadId }),
      }).catch(() => {});
      setPhase("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
      return;
    }

    // 3) Complete: server finalizes the object, records size, marks READY.
    setPhase("finalizing");
    const completeRes = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId, key, uploadId, parts, makeCurrent: true }),
    });
    if (!completeRes.ok) {
      const body = await completeRes.json().catch(() => ({}));
      setPhase("error");
      setError(body.error ?? "Could not finalize the upload.");
      return;
    }

    setPhase("done");
    setProgress(100);
    if (fileRef.current) fileRef.current.value = "";
    setChangelog("");
    router.refresh();
  }

  const busy = phase === "uploading" || phase === "finalizing";

  return (
    <form onSubmit={upload} className="space-y-4 rounded-lg border border-border p-5">
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
          <span className="text-sm font-medium">File</span>
          <input ref={fileRef} type="file" className={inputCls} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Changelog (optional)</span>
        <input
          className={inputCls}
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="What changed in this version"
        />
      </label>

      {busy ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {phase === "done" ? (
        <p className="text-sm text-primary">Uploaded and set as current.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {phase === "uploading"
          ? `Uploading… ${progress}%`
          : phase === "finalizing"
            ? "Finalizing…"
            : "Upload new version"}
      </button>
    </form>
  );
}
