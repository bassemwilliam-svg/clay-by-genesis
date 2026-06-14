import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { attachObjectInput } from "@/lib/validation/import-schemas";
import {
  registerExistingObject,
  ImportError,
  importErrorStatus,
} from "@/lib/assets/import";

/*
 * Admin-only: attach an existing storage object to a product as a new immutable
 * version (import by reference — no bytes are copied). Mirrors the upload
 * pipeline's outcome (a READY version) without the multipart dance.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = attachObjectInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const version = await registerExistingObject({
      productId: parsed.data.productId,
      storageKey: parsed.data.key,
      semver: parsed.data.semver,
      fileName: parsed.data.fileName,
      changelog: parsed.data.changelog,
      makeCurrent: parsed.data.makeCurrent,
    });
    revalidatePath(`/admin/products/${parsed.data.productId}/edit`);
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) {
    if (e instanceof ImportError) {
      return NextResponse.json(
        { error: e.message },
        { status: importErrorStatus(e.kind) },
      );
    }
    console.error("[admin/storage/attach]", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
