import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { presignInput } from "@/lib/validation/asset-schemas";
import { createPendingVersion } from "@/lib/assets/service";

/*
 * Admin-only: open a resumable multipart upload and return presigned PUT URLs.
 * The browser uploads parts directly to object storage, bytes never transit
 * this server, so multi-GB assets don't blow the serverless body limit.
 */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = presignInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const result = await createPendingVersion(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That version already exists for this product." },
        { status: 409 },
      );
    }
    console.error("[uploads/presign]", e);
    return NextResponse.json({ error: "Upload init failed" }, { status: 500 });
  }
}
