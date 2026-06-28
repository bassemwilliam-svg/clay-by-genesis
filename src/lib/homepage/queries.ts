import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Editable homepage content (hero carousel + video separator).
 *
 * Both are admin-managed but ship with sensible built-in defaults, so the
 * storefront renders a complete homepage even before anyone touches the admin
 * (and on a fresh database). Media is referenced by URL, so this works without
 * any object-storage credentials configured.
 */

export type HomeSlideView = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export type HomeVideo = {
  url: string | null;
  poster: string;
  heading: string;
  subtext: string;
};

// Built-in hero slides: the catalog's service families, used when an admin has
// not configured any of their own.
const DEFAULT_SLIDES: HomeSlideView[] = [
  {
    id: "default-environment-kit",
    title: "Environment kits",
    subtitle: "Modular streets, villages, and bases. Assemble a whole scene, then reshape it.",
    imageUrl: "/landing/clay-family-environment-kit.jpg",
    ctaLabel: "Explore kits",
    ctaHref: "/browse?type=ENVIRONMENT_KIT",
  },
  {
    id: "default-game-asset",
    title: "Game assets",
    subtitle: "Hard-surface props, vehicles, and set pieces. Drop-in ready for any engine.",
    imageUrl: "/landing/clay-family-game-asset.jpg",
    ctaLabel: "Explore assets",
    ctaHref: "/browse?type=GAME_ASSET",
  },
  {
    id: "default-procedural-tool",
    title: "Procedural tools",
    subtitle: "Houdini-grade generators you tune to your own scene, not a fixed export.",
    imageUrl: "/landing/clay-family-procedural-tool.jpg",
    ctaLabel: "Explore tools",
    ctaHref: "/browse?type=PROCEDURAL_TOOL",
  },
  {
    id: "default-course",
    title: "Courses",
    subtitle: "Learn the procedural workflow itself and own every parameter you touch.",
    imageUrl: "/landing/clay-family-course.jpg",
    ctaLabel: "Browse courses",
    ctaHref: "/courses",
  },
  {
    id: "default-bundle",
    title: "Bundles",
    subtitle: "Curated sets that cover a whole project in a single pickup.",
    imageUrl: "/landing/clay-family-bundle.jpg",
    ctaLabel: "See bundles",
    ctaHref: "/browse?type=BUNDLE",
  },
];

export const HOME_VIDEO_DEFAULTS: HomeVideo = {
  url: null,
  poster: "/landing/clay-shipped-after.jpg",
  heading: "Building from scratch is slow. Stock assets look like everyone's.",
  subtext:
    "Clay starts you at the blueprint, then lets you reshape it into something unmistakably yours.",
};

export const HOME_VIDEO_KEYS = {
  url: "home_video_url",
  poster: "home_video_poster",
  heading: "home_video_heading",
  subtext: "home_video_subtext",
} as const;

/** Active hero slides in display order; falls back to the built-in defaults. */
export async function getHomeSlides(): Promise<HomeSlideView[]> {
  const rows = await prisma.homeSlide.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      imageUrl: true,
      ctaLabel: true,
      ctaHref: true,
    },
  });
  return rows.length > 0 ? rows : DEFAULT_SLIDES;
}

/** Hero video-separator config, merged over the built-in defaults. */
export async function getHomeVideo(): Promise<HomeVideo> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(HOME_VIDEO_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const url = byKey.get(HOME_VIDEO_KEYS.url)?.trim();
  const poster = byKey.get(HOME_VIDEO_KEYS.poster)?.trim();
  const heading = byKey.get(HOME_VIDEO_KEYS.heading)?.trim();
  const subtext = byKey.get(HOME_VIDEO_KEYS.subtext)?.trim();
  return {
    url: url || HOME_VIDEO_DEFAULTS.url,
    poster: poster || HOME_VIDEO_DEFAULTS.poster,
    heading: heading || HOME_VIDEO_DEFAULTS.heading,
    subtext: subtext || HOME_VIDEO_DEFAULTS.subtext,
  };
}

/** All slides (incl. inactive) for the admin editor. */
export async function listAllHomeSlides() {
  return prisma.homeSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export const DEFAULT_HOME_SLIDES = DEFAULT_SLIDES;
