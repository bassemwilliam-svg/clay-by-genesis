import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { bulkImportInput } from "@/lib/validation/import-schemas";
import {
  bulkCreateDraftsFromKeys,
  ImportError,
  importErrorStatus,
} from "@/lib/assets/import";

/*
 * Admin-only: bulk-create one DRAFT product per object key, each with the
 * object registered as its first version. Per-key failures come back in
 * `skipped` rather than failing the whole batch.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bulkImportInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const result = await bulkCreateDraftsFromKeys(parsed.data);
    if (result.created.length > 0) revalidatePath("/admin/products");
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ImportError) {
      return NextResponse.json(
        { error: e.message },
        { status: importErrorStatus(e.kind) },
      );
    }
    console.error("[admin/storage/import]", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
