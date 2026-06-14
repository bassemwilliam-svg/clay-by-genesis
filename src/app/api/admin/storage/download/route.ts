import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { getStorageProvider } from "@/lib/storage";
import { signedDownloadInput } from "@/lib/validation/import-schemas";

const ADMIN_LINK_EXPIRY = 5 * 60; // 5 minutes

/*
 * Admin-only export: mint a short-lived signed download URL for one asset
 * version, straight from storage. Unlike the buyer download flow (Stage 9,
 * entitlement-gated), this is for staff to pull files for review or hand-off,
 * so it gates on EDITOR rather than ownership.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = signedDownloadInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const version = await prisma.assetVersion.findUnique({
    where: { id: parsed.data.versionId },
    select: { storageKey: true, fileName: true, uploadStatus: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }
  if (version.uploadStatus !== "READY") {
    return NextResponse.json(
      { error: "That version isn't ready yet." },
      { status: 409 },
    );
  }

  const storage = getStorageProvider();
  if (!storage.isConfigured()) {
    return NextResponse.json(
      { error: "Storage isn't configured yet." },
      { status: 503 },
    );
  }

  try {
    const url = await storage.getSignedDownloadUrl({
      key: version.storageKey,
      downloadFileName: version.fileName,
      expiresInSeconds: ADMIN_LINK_EXPIRY,
    });
    return NextResponse.json({ url, expiresInSeconds: ADMIN_LINK_EXPIRY });
  } catch (e) {
    console.error("[admin/storage/download]", e);
    return NextResponse.json(
      { error: "Could not create a download link." },
      { status: 502 },
    );
  }
}
