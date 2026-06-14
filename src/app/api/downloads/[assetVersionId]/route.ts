import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { issueDownload } from "@/lib/downloads/service";

// Ownership-gated signed-URL issuance. Always dynamic, Node runtime (the AWS
// SDK presigner needs Node crypto).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/downloads/[assetVersionId]">,
) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Sign in to download." }, { status: 401 });
  }

  const { assetVersionId } = await ctx.params;

  // x-forwarded-for is a comma-separated list; the client IP is the first hop.
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent");

  const result = await issueDownload({
    userId: user.id,
    userRole: user.role,
    assetVersionId,
    ipAddress,
    userAgent,
  });

  switch (result.status) {
    case "ok":
      return NextResponse.json(
        {
          url: result.url,
          fileName: result.fileName,
          expiresInSeconds: result.expiresInSeconds,
        },
        { headers: { "cache-control": "private, no-store" } },
      );
    case "not_found":
      return NextResponse.json(
        { error: "That file doesn't exist." },
        { status: 404 },
      );
    case "forbidden":
      return NextResponse.json(
        { error: "You don't own this item." },
        { status: 403 },
      );
    case "not_ready":
      return NextResponse.json(
        { error: "That version isn't ready to download yet." },
        { status: 409 },
      );
    case "storage_unconfigured":
      return NextResponse.json(
        { error: "Downloads aren't configured yet." },
        { status: 503 },
      );
    case "rate_limited":
      return NextResponse.json(
        { error: "Too many downloads. Please try again shortly." },
        {
          status: 429,
          headers: { "retry-after": String(result.retryAfterSeconds) },
        },
      );
  }
}
