"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth-guards";
import { HOME_VIDEO_KEYS } from "@/lib/homepage/queries";

/*
 * Admin write boundary for editable homepage content: the hero carousel slides
 * and the video-separator settings. Every mutation re-validates the homepage so
 * the change is visible on the next request. Media is referenced by URL (no
 * object storage required), so the admin pastes image/video URLs directly.
 */

export type HomeActionState = { ok: boolean; error?: string };

// Accept absolute URLs or site-relative paths (e.g. /landing/foo.jpg).
const urlOrPath = z
  .string()
  .trim()
  .min(1, "A URL or path is required.")
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
    "Enter a full URL (https://…) or a site path starting with /.",
  );

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null));

async function revalidateHome() {
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

// ---------------------------------------------------------------------------
// Video separator settings
// ---------------------------------------------------------------------------

const videoSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v ?? "")
    .refine(
      (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
      "Enter a full video URL, a site path, or leave it blank.",
    ),
  poster: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v ?? ""),
  heading: z.string().trim().max(300).optional().transform((v) => v ?? ""),
  subtext: z.string().trim().max(1000).optional().transform((v) => v ?? ""),
});

async function upsertSetting(key: string, value: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function saveHomeVideo(
  _prev: HomeActionState,
  formData: FormData,
): Promise<HomeActionState> {
  await requireRole("EDITOR");
  const parsed = videoSchema.safeParse({
    url: formData.get("url"),
    poster: formData.get("poster"),
    heading: formData.get("heading"),
    subtext: formData.get("subtext"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { url, poster, heading, subtext } = parsed.data;
  await Promise.all([
    upsertSetting(HOME_VIDEO_KEYS.url, url),
    upsertSetting(HOME_VIDEO_KEYS.poster, poster),
    upsertSetting(HOME_VIDEO_KEYS.heading, heading),
    upsertSetting(HOME_VIDEO_KEYS.subtext, subtext),
  ]);
  await revalidateHome();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hero slides
// ---------------------------------------------------------------------------

const slideSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(120),
  subtitle: optionalText,
  imageUrl: urlOrPath,
  ctaLabel: optionalText,
  ctaHref: optionalText,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function addHomeSlide(
  _prev: HomeActionState,
  formData: FormData,
): Promise<HomeActionState> {
  await requireRole("EDITOR");
  const parsed = slideSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    imageUrl: formData.get("imageUrl"),
    ctaLabel: formData.get("ctaLabel"),
    ctaHref: formData.get("ctaHref"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  await prisma.homeSlide.create({ data: parsed.data });
  await revalidateHome();
  return { ok: true };
}

export async function removeHomeSlide(id: string): Promise<void> {
  await requireRole("EDITOR");
  await prisma.homeSlide.deleteMany({ where: { id } });
  await revalidateHome();
}

export async function toggleHomeSlide(id: string, isActive: boolean): Promise<void> {
  await requireRole("EDITOR");
  await prisma.homeSlide.updateMany({ where: { id }, data: { isActive } });
  await revalidateHome();
}
