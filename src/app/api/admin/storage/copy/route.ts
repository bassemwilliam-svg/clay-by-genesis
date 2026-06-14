import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { getStorageProvider } from "@/lib/storage";
import { copyToBucketInput } from "@/lib/validation/import-schemas";

/*
 * Admin-only export: server-side copy of selected asset versions to another
 * S3 bucket/prefix (back-up, hand-off, migration). The provider credentials
 * must be able to write the destination. Per-version failures are collected,
 * not thrown, so one denied key doesn't sink the whole batch.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = copyToBucketInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const storage = getStorageProvider();
  if (!storage.isConfigured()) {
    return NextResponse.json(
      { error: "Storage isn't configured yet." },
      { status: 503 },
    );
  }

  const versions = await prisma.assetVersion.findMany({
    where: { id: { in: parsed.data.versionIds } },
    select: { id: true, storageKey: true, fileName: true },
  });

  // Normalize to "" or "trailing/slash/": drop any leading slashes, ensure one
  // trailing slash so it joins cleanly with the object basename.
  const raw = (parsed.data.destPrefix ?? "").trim().replace(/^\/+/, "");
  const destPrefix = raw && !raw.endsWith("/") ? `${raw}/` : raw;

  const copied: { versionId: string; destKey: string }[] = [];
  const failed: { versionId: string; reason: string }[] = [];

  for (const v of versions) {
    // Keep the object's basename; prepend the destination prefix if given.
    const base = v.storageKey.split("/").filter(Boolean).pop() ?? v.fileName;
    const destKey = `${destPrefix}${base}`;
    try {
      await storage.copyToBucket({
        sourceKey: v.storageKey,
        destBucket: parsed.data.destBucket,
        destKey,
      });
      copied.push({ versionId: v.id, destKey });
    } catch (e) {
      failed.push({
        versionId: v.id,
        reason: e instanceof Error ? e.message : "Copy failed",
      });
    }
  }

  return NextResponse.json({
    destBucket: parsed.data.destBucket,
    copied,
    failed,
  });
}
