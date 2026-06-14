import { z } from "zod";
import { currency, productType, slug } from "@/lib/validation/common";

/*
 * Per-category product input schemas.
 *
 * One shared base (the columns every Product has) is extended by a discriminated
 * union keyed on `type`. The same union drives the dynamic admin form: the form
 * reads the active variant's `.shape` to know which category fields to render,
 * and the Server Action re-validates the whole payload against the union before
 * it touches the database. Keeping the discriminator here (mirroring the Prisma
 * `ProductType` enum) makes the validation layer the single source of input
 * truth, so the form and the persistence layer can never drift apart.
 *
 * Numeric/boolean fields use `z.coerce` because the admin form posts FormData
 * (everything arrives as a string); coercion lets one schema serve both the
 * typed Server Action callers and the raw form submission.
 */

export const productStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type ProductStatusInput = z.infer<typeof productStatus>;

/** Free-form list field arriving from the form as comma-separated text. */
const stringList = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(","))
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1)).max(50));

const optionalInt = z.coerce.number().int().nonnegative().optional();
/** Money in integer minor units, coerced from the form's string input. */
const moneyCents = z.coerce.number().int().nonnegative();
const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
  .transform((v) => v === true || v === "on" || v === "true");

/** Columns shared by every Product regardless of category. */
const productBase = z.object({
  slug,
  title: z.string().min(1).max(200),
  status: productStatus.default("DRAFT"),
  shortDesc: z.string().max(280).optional(),
  fullDesc: z.string().max(10_000).optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  licenseId: z.string().optional(),
  priceCents: moneyCents,
  discountCents: moneyCents.optional(),
  currency: currency.default("USD"),
  // Cross-cutting catalog facets (apply to every product type), surfaced as the
  // Industry / Theme / Style filters on browse. Free-form so the admin owns the
  // vocabulary; the facet lists are computed from whatever distinct values exist.
  industry: z.string().max(80).optional(),
  theme: z.string().max(80).optional(),
  style: z.string().max(80).optional(),
  // Membership inclusion floor. Empty form value arrives as undefined (à la
  // carte). PRO implies STUDIO coverage; enforced in code, not here.
  includedInTier: z.enum(["FREE", "PRO", "STUDIO"]).optional(),
});

// --- Per-category detail field sets (mirror the Prisma 1:1 detail tables) ----

const gameAssetDetail = z.object({
  polycount: optionalInt,
  isRigged: checkbox.default(false),
  isAnimated: checkbox.default(false),
  isPbr: checkbox.default(false),
  textureResMax: optionalInt,
  lodCount: optionalInt,
  fileFormats: stringList.default([]),
  targetEngines: stringList.default([]),
  software: stringList.default([]),
});

const environmentKitDetail = z.object({
  moduleCount: optionalInt,
  isModular: checkbox.default(true),
  coverageAreaM2: optionalInt,
  biome: z.string().max(80).optional(),
  fileFormats: stringList.default([]),
  targetEngines: stringList.default([]),
  software: stringList.default([]),
});

const proceduralToolDetail = z.object({
  hostSoftware: z.string().max(80).optional(),
  toolType: z.string().max(80).optional(),
  // The editable-parameter manifest (drives the configurator + landing demo).
  // Accepts a JSON object directly, or a JSON string from the form textarea.
  parameterManifest: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      if (!trimmed) return undefined;
      try {
        return JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Parameter manifest must be valid JSON",
        });
        return z.NEVER;
      }
    }),
});

// --- Discriminated union: base + the variant's detail under `type` -----------

export const productInput = z.discriminatedUnion("type", [
  productBase.extend({
    type: z.literal(productType.enum.GAME_ASSET),
    gameAssetDetail,
  }),
  productBase.extend({
    type: z.literal(productType.enum.ENVIRONMENT_KIT),
    environmentKitDetail,
  }),
  productBase.extend({
    type: z.literal(productType.enum.PROCEDURAL_TOOL),
    proceduralToolDetail,
  }),
  // Courses and bundles carry no inline detail here: the course content is built
  // in the course builder, and bundle membership is managed on the bundle page.
  productBase.extend({ type: z.literal(productType.enum.COURSE) }),
  productBase.extend({ type: z.literal(productType.enum.BUNDLE) }),
]);

export type ProductInput = z.infer<typeof productInput>;

/** The category-detail field sets, keyed by type, consumed by the dynamic form. */
export const detailSchemaByType = {
  GAME_ASSET: gameAssetDetail,
  ENVIRONMENT_KIT: environmentKitDetail,
  PROCEDURAL_TOOL: proceduralToolDetail,
  COURSE: null,
  BUNDLE: null,
} as const;
