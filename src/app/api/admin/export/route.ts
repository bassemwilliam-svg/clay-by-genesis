import { NextResponse } from "next/server";
import { authorizeRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";

/*
 * Admin-only: export the catalog (products + their asset keys/versions/sizes)
 * as a downloadable CSV or JSON file. CSV flattens to one row per version (a
 * product with no versions still gets a row); JSON nests versions under each
 * product. ?format=csv (default) | json.
 */

type VersionRow = {
  semver: string;
  fileName: string;
  storageKey: string;
  sizeBytes: number | null;
  isCurrent: boolean;
  uploadStatus: string;
  createdAt: string;
};

const CSV_HEADER = [
  "productId",
  "slug",
  "title",
  "type",
  "status",
  "priceCents",
  "currency",
  "includedInTier",
  "semver",
  "fileName",
  "storageKey",
  "sizeBytes",
  "isCurrent",
  "uploadStatus",
  "versionCreatedAt",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote anything with a comma, quote, or newline; double internal quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await authorizeRole("EDITOR");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const format =
    new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      status: true,
      priceCents: true,
      currency: true,
      includedInTier: true,
      asset: {
        select: {
          versions: {
            orderBy: { createdAt: "desc" },
            select: {
              semver: true,
              fileName: true,
              storageKey: true,
              fileSizeBytes: true,
              isCurrent: true,
              uploadStatus: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const data = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      type: p.type,
      status: p.status,
      priceCents: p.priceCents,
      currency: p.currency,
      includedInTier: p.includedInTier,
      versions: (p.asset?.versions ?? []).map(
        (v): VersionRow => ({
          semver: v.semver,
          fileName: v.fileName,
          storageKey: v.storageKey,
          sizeBytes: v.fileSizeBytes != null ? Number(v.fileSizeBytes) : null,
          isCurrent: v.isCurrent,
          uploadStatus: v.uploadStatus,
          createdAt: v.createdAt.toISOString(),
        }),
      ),
    }));
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), products: data }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="clay-catalog-${stamp}.json"`,
      },
    });
  }

  const lines = [CSV_HEADER.join(",")];
  for (const p of products) {
    const base = [
      p.id,
      p.slug,
      p.title,
      p.type,
      p.status,
      p.priceCents,
      p.currency,
      p.includedInTier ?? "",
    ];
    const versions = p.asset?.versions ?? [];
    if (versions.length === 0) {
      lines.push([...base, "", "", "", "", "", "", ""].map(csvCell).join(","));
    } else {
      for (const v of versions) {
        lines.push(
          [
            ...base,
            v.semver,
            v.fileName,
            v.storageKey,
            v.fileSizeBytes != null ? Number(v.fileSizeBytes) : "",
            v.isCurrent,
            v.uploadStatus,
            v.createdAt.toISOString(),
          ]
            .map(csvCell)
            .join(","),
        );
      }
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clay-catalog-${stamp}.csv"`,
    },
  });
}
