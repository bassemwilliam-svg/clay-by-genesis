import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRole } from "@/lib/auth-guards";
import { abortInput } from "@/lib/validation/asset-schemas";
import { abortVersion } from "@/lib/assets/service";

/** Admin-only: cancel an in-flight upload and drop the pending version row. */
export async function POST(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = abortInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  try {
    const result = await abortVersion(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[uploads/abort]", e);
    return NextResponse.json({ error: "Failed to abort upload" }, { status: 500 });
  }
}
