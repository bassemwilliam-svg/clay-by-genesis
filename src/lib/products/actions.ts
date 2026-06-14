"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth-guards";
import { productInput, productStatus } from "@/lib/validation/product-schemas";
import { reindexProductSafe } from "@/lib/ai/indexing";
import { syncProductMembershipEntitlements } from "@/lib/membership/entitlements";

/*
 * Product write boundary. Every mutation: (1) re-checks the EDITOR role,
 * (2) reshapes raw FormData into the discriminated-union input, (3) validates
 * with Zod, (4) persists base columns + the matching 1:1 detail table.
 *
 * `useActionState` shape: actions return { ok, fieldErrors?, formError? } so the
 * client form can render inline errors; create redirects on success instead.
 */

export type ProductActionState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

/** Trim FormData to value-or-undefined so empty inputs hit Zod's `.optional()`. */
function val(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** Reshape flat FormData into the nested per-type input the union expects. */
function reshape(fd: FormData): unknown {
  const type = val(fd, "type");
  const base = {
    type,
    slug: val(fd, "slug"),
    title: val(fd, "title"),
    status: val(fd, "status"),
    shortDesc: val(fd, "shortDesc"),
    fullDesc: val(fd, "fullDesc"),
    categoryId: val(fd, "categoryId"),
    subcategoryId: val(fd, "subcategoryId"),
    licenseId: val(fd, "licenseId"),
    priceCents: val(fd, "priceCents"),
    discountCents: val(fd, "discountCents"),
    currency: val(fd, "currency"),
    industry: val(fd, "industry"),
    theme: val(fd, "theme"),
    style: val(fd, "style"),
    includedInTier: val(fd, "includedInTier"),
  };

  switch (type) {
    case "GAME_ASSET":
      return {
        ...base,
        gameAssetDetail: {
          polycount: val(fd, "polycount"),
          isRigged: fd.get("isRigged") ?? undefined,
          isAnimated: fd.get("isAnimated") ?? undefined,
          isPbr: fd.get("isPbr") ?? undefined,
          textureResMax: val(fd, "textureResMax"),
          lodCount: val(fd, "lodCount"),
          fileFormats: val(fd, "fileFormats") ?? "",
          targetEngines: val(fd, "targetEngines") ?? "",
          software: val(fd, "software") ?? "",
        },
      };
    case "ENVIRONMENT_KIT":
      return {
        ...base,
        environmentKitDetail: {
          moduleCount: val(fd, "moduleCount"),
          isModular: fd.get("isModular") ?? undefined,
          coverageAreaM2: val(fd, "coverageAreaM2"),
          biome: val(fd, "biome"),
          fileFormats: val(fd, "fileFormats") ?? "",
          targetEngines: val(fd, "targetEngines") ?? "",
          software: val(fd, "software") ?? "",
        },
      };
    case "PROCEDURAL_TOOL":
      return {
        ...base,
        proceduralToolDetail: {
          hostSoftware: val(fd, "hostSoftware"),
          toolType: val(fd, "toolType"),
          parameterManifest: val(fd, "parameterManifest"),
        },
      };
    default:
      return base;
  }
}

/** The Product table's own columns (no detail, no discriminator-only extras). */
function baseColumns(data: z.infer<typeof productInput>) {
  return {
    slug: data.slug,
    type: data.type,
    status: data.status,
    title: data.title,
    shortDesc: data.shortDesc ?? null,
    fullDesc: data.fullDesc ?? null,
    categoryId: data.categoryId ?? null,
    subcategoryId: data.subcategoryId ?? null,
    licenseId: data.licenseId ?? null,
    priceCents: data.priceCents,
    discountCents: data.discountCents ?? null,
    currency: data.currency,
    industry: data.industry ?? null,
    theme: data.theme ?? null,
    style: data.style ?? null,
    includedInTier: data.includedInTier ?? null,
  };
}

const jsonOrNull = (v: unknown) =>
  v === undefined || v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireRole("EDITOR");

  const parsed = productInput.safeParse(reshape(formData));
  if (!parsed.success) {
    return {
      ok: false,
      formError: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const data = parsed.data;

  let created;
  try {
    created = await prisma.product.create({
      data: {
        ...baseColumns(data),
        gameAssetDetail:
          data.type === "GAME_ASSET"
            ? { create: data.gameAssetDetail }
            : undefined,
        environmentKitDetail:
          data.type === "ENVIRONMENT_KIT"
            ? { create: data.environmentKitDetail }
            : undefined,
        proceduralToolDetail:
          data.type === "PROCEDURAL_TOOL"
            ? {
                create: {
                  hostSoftware: data.proceduralToolDetail.hostSoftware ?? null,
                  toolType: data.proceduralToolDetail.toolType ?? null,
                  parameterManifest: jsonOrNull(
                    data.proceduralToolDetail.parameterManifest,
                  ),
                },
              }
            : undefined,
      },
      select: { id: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, fieldErrors: { slug: ["This slug is already taken"] } };
    }
    throw e;
  }

  reindexProductSafe(created.id);
  await syncProductMembershipEntitlements(created.id);
  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}/edit`);
}

export async function updateProduct(
  id: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireRole("EDITOR");

  const parsed = productInput.safeParse(reshape(formData));
  if (!parsed.success) {
    return {
      ok: false,
      formError: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const data = parsed.data;

  try {
    await prisma.product.update({
      where: { id },
      data: {
        ...baseColumns(data),
        gameAssetDetail:
          data.type === "GAME_ASSET"
            ? {
                upsert: {
                  create: data.gameAssetDetail,
                  update: data.gameAssetDetail,
                },
              }
            : undefined,
        environmentKitDetail:
          data.type === "ENVIRONMENT_KIT"
            ? {
                upsert: {
                  create: data.environmentKitDetail,
                  update: data.environmentKitDetail,
                },
              }
            : undefined,
        proceduralToolDetail:
          data.type === "PROCEDURAL_TOOL"
            ? {
                upsert: {
                  create: {
                    hostSoftware: data.proceduralToolDetail.hostSoftware ?? null,
                    toolType: data.proceduralToolDetail.toolType ?? null,
                    parameterManifest: jsonOrNull(
                      data.proceduralToolDetail.parameterManifest,
                    ),
                  },
                  update: {
                    hostSoftware: data.proceduralToolDetail.hostSoftware ?? null,
                    toolType: data.proceduralToolDetail.toolType ?? null,
                    parameterManifest: jsonOrNull(
                      data.proceduralToolDetail.parameterManifest,
                    ),
                  },
                },
              }
            : undefined,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, fieldErrors: { slug: ["This slug is already taken"] } };
    }
    throw e;
  }

  reindexProductSafe(id);
  await syncProductMembershipEntitlements(id);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  return { ok: true };
}

/**
 * Draft → Published → Archived workflow. Publishing stamps `publishedAt` once;
 * re-publishing keeps the original timestamp so storefront "new" ordering is
 * stable. (Storefront ISR revalidation on publish is wired in Stage 4.)
 */
export async function setProductStatus(id: string, next: string): Promise<void> {
  await requireRole("EDITOR");
  const status = productStatus.parse(next);

  const current = await prisma.product.findUnique({
    where: { id },
    select: { publishedAt: true },
  });

  await prisma.product.update({
    where: { id },
    data: {
      status,
      publishedAt:
        status === "PUBLISHED"
          ? (current?.publishedAt ?? new Date())
          : current?.publishedAt,
    },
  });

  if (status === "PUBLISHED") reindexProductSafe(id);
  // Publish/unpublish flips membership coverage on or off for this product.
  await syncProductMembershipEntitlements(id);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
}
