import { z } from "zod";

/*
 * Shared validation primitives. Every boundary (Server Actions, route handlers,
 * forms) validates with Zod; per-category product schemas (Stage 2) compose
 * these via discriminated unions. Keeping the primitives in one place makes the
 * rules consistent and the validation layer the single source of input truth.
 */

export const cuid = z.cuid();

export const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase, hyphenated slug");

/** Money is always integer minor units (cents). Never floats. */
export const priceCents = z.int().nonnegative();

export const currency = z
  .string()
  .length(3)
  .transform((c) => c.toUpperCase());

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type Pagination = z.infer<typeof pagination>;

/** Discriminator shared by Product schemas and the dynamic admin form. */
export const productType = z.enum([
  "GAME_ASSET",
  "ENVIRONMENT_KIT",
  "PROCEDURAL_TOOL",
  "COURSE",
  "BUNDLE",
]);

export type ProductType = z.infer<typeof productType>;
