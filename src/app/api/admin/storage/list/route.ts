import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { getStorageProvider } from "@/lib/storage";
import { listObjectsInput } from "@/lib/validation/import-schemas";

/*
 * Admin-only: browse the storage bucket for import. Returns one page of objects
 * (and "folders" when a delimiter is sent). When storage isn't configured we
 * answer 200 with { configured: false } so the console renders a calm "set up
 * S3" state instead of an error.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = listObjectsInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const storage = getStorageProvider();
  if (!storage.isConfigured()) {
    return NextResponse.json({ configured: false, provider: storage.name });
  }

  try {
    const result = await storage.listObjects({
      prefix: parsed.data.prefix,
      continuationToken: parsed.data.continuationToken,
      // Default to tree navigation ("/") unless the caller asks for a flat list.
      delimiter: parsed.data.delimiter ?? "/",
    });
    return NextResponse.json({
      configured: true,
      provider: storage.name,
      prefix: parsed.data.prefix ?? "",
      ...result,
    });
  } catch (e) {
    console.error("[admin/storage/list]", e);
    return NextResponse.json(
      { error: "Could not list the bucket. Check credentials and permissions." },
      { status: 502 },
    );
  }
}
