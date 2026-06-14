import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { completeInput } from "@/lib/validation/asset-schemas";
import { finalizeVersion } from "@/lib/assets/service";

/** Admin-only: finalize a multipart upload and mark the version READY. */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = completeInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const result = await finalizeVersion(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[uploads/complete]", e);
    return NextResponse.json(
      { error: "Failed to finalize upload" },
      { status: 500 },
    );
  }
}
