import Link from "next/link";
import type { ProductType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Configurator } from "@/components/configurator/configurator";
import { ConciergeEntry } from "@/components/concierge/concierge-entry";
import { ProductCard } from "@/components/storefront/product-card";
import { CourseCard } from "@/components/courses/course-card";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { HomeVideoSeparator } from "@/components/marketing/home-video-separator";
import { BeforeAfterSlider } from "@/components/marketing/before-after-slider";
import { PRODUCT_TYPE_LABELS } from "@/lib/format";
import {
  browseFacets,
  browseProducts,
  listPublishedCategories,
} from "@/lib/products/storefront-queries";
import { listPublishedCourses } from "@/lib/courses/queries";
import { getHomeSlides, getHomeVideo } from "@/lib/homepage/queries";

export const revalidate = 300;

// The catalog's families, shown as a visual index. Each tile is anchored by a
// studio render of that family so the grid reads like a real catalog spread.
const FAMILIES: {
  type: ProductType;
  title: string;
  blurb: string;
  img: string;
}[] = [
  {
    type: "ENVIRONMENT_KIT",
    title: "Environment kits",
    blurb: "Modular streets, villages, and bases. Assemble whole scenes, then reshape them.",
    img: "/landing/clay-family-environment-kit.jpg",
  },
  {
    type: "GAME_ASSET",
    title: "Game assets",
    blurb: "Hard-surface props, vehicles, and set pieces. Drop-in ready for any engine.",
    img: "/landing/clay-family-game-asset.jpg",
  },
  {
    type: "PROCEDURAL_TOOL",
    title: "Procedural tools",
    blurb: "Houdini-grade generators you tune to your own scene, not a fixed export.",
    img: "/landing/clay-family-procedural-tool.jpg",
  },
  {
    type: "COURSE",
    title: "Courses",
    blurb: "Learn the procedural workflow itself and own every parameter you touch.",
    img: "/landing/clay-family-course.jpg",
  },
  {
    type: "BUNDLE",
    title: "Bundles",
    blurb: "Curated sets that cover a whole project in a single pickup.",
    img: "/landing/clay-family-bundle.jpg",
  },
];

export default async function LandingPage() {
  const [featured, categories, courses, typeFacets, slides, video] =
    await Promise.all([
      browseProducts({ pageSize: 3 }),
      listPublishedCategories(),
      listPublishedCourses(),
      browseFacets({}),
      getHomeSlides(),
      getHomeVideo(),
    ]);
  const countByType = new Map(typeFacets.types.map((f) => [f.type, f.count]));
  const featuredCourses = courses.slice(0, 3);

  return (
    <div className="flex flex-col">
      {/* Hero: full-width service carousel behind the headline. */}
      <HeroCarousel slides={slides}>
        <span className="mono-label text-primary/80">
          Procedural worlds, forged to be yours
        </span>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
          Start with clay.{" "}
          <span className="text-primary">Ship a world.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Pull a procedural building block off the shelf, reshape it live, and
          ship something unmistakably yours. Engine-ready in minutes, not weeks.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/browse">Browse the catalog</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See membership</Link>
          </Button>
        </div>
      </HeroCarousel>

      {/* Live configurator, framed and explained so it reads clearly. */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-16 md:px-10">
          <div className="max-w-2xl">
            <span className="mono-label">Live demo</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              This is the asset, not a video of it.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every control below drives a real parameter on a Houdini-built
              asset, rendering live in your browser. Change the height, add
              platforms, dial in the weathering. Then picture doing the same to
              any kit in the catalog. That is what &quot;make it yours&quot;
              means here.
            </p>
          </div>
          <div className="bp-ticks mt-8 border border-border bg-card/40 p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="mono-label">
                Live configurator / construction_tank_sys
              </span>
              <span className="mono-label text-primary/70">REAL-TIME</span>
            </div>
            <Configurator />
          </div>
        </div>
      </section>

      {/* Atlas, the project guide. */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center md:px-10">
          <span className="mono-label">Atlas · project guide</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Describe your project. Atlas maps the catalog.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Tell Atlas what you are building and get a curated set of assets,
            kits, and tools, only from the Clay catalog.
          </p>
          <ConciergeEntry />
        </div>
      </section>

      {/* Catalog families, the visual index. */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-20 md:px-10">
          <span className="mono-label">Catalog families</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            Everything a scene needs, in one catalog
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            From a single prop to a whole modular environment, plus the tools
            and courses to bend them to your project.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FAMILIES.map((f) => (
              <Link
                key={f.type}
                href={`/browse?type=${f.type}`}
                className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden bg-background p-6"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.img}
                  alt={`${f.title} render`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition-all duration-500 group-hover:scale-[1.03] group-hover:opacity-90"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="mono-label text-primary/70">
                      {PRODUCT_TYPE_LABELS[f.type] ?? f.type}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(countByType.get(f.type) ?? 0).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Clay to shipped, the before/after wipe. */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto grid w-full max-w-[1600px] items-center gap-10 px-6 py-20 md:grid-cols-2 md:px-10">
          <div>
            <span className="mono-label">{"// drag to compare"}</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Drag the handle. Watch clay become a shipped scene.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Clay starts you at the blueprint, a procedural asset with every
              parameter exposed, then lets you reshape it into something that is
              unmistakably your scene.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/browse?type=ENVIRONMENT_KIT">
                  Explore environment kits
                </Link>
              </Button>
            </div>
          </div>
          <BeforeAfterSlider
            className="aspect-square w-full border border-border bg-card"
            beforeLabel="Clay"
            afterLabel="Shipped"
            before={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/landing/clay-before.jpg"
                alt="A WW2 village environment kit as a raw, untextured clay model"
                className="h-full w-full object-cover"
              />
            }
            after={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/landing/clay-shipped-after.jpg"
                alt="The same WW2 village environment kit fully textured and shipped"
                className="h-full w-full object-cover"
              />
            }
          />
        </div>
      </section>

      {/* Video separator above the featured courses (admin-managed). */}
      <HomeVideoSeparator video={video} />

      {/* Featured courses */}
      {featuredCourses.length > 0 ? (
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-20 md:px-10">
            <div className="flex items-end justify-between">
              <div>
                <span className="mono-label">Learn the workflow</span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                  Featured courses
                </h2>
              </div>
              <Link
                href="/courses"
                className="mono-label transition-colors hover:text-foreground"
              >
                All courses →
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Category rails */}
      {categories.length > 0 ? (
        <section className="mx-auto w-full max-w-[1600px] px-6 py-20 md:px-10">
          <span className="mono-label">Index</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Browse by theme
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="group flex items-center gap-2 border border-border px-4 py-2 text-sm transition-colors hover:border-primary/60 hover:bg-card/60"
              >
                {c.name}
                <span className="font-mono text-xs text-muted-foreground group-hover:text-primary">
                  {String(c._count.products).padStart(2, "0")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured rail */}
      {featured.items.length > 0 ? (
        <section className="mx-auto w-full max-w-[1600px] px-6 pb-24 md:px-10">
          <div className="flex items-end justify-between">
            <div>
              <span className="mono-label">Latest units</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Fresh from the studio
              </h2>
            </div>
            <Link
              href="/browse"
              className="mono-label transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center md:px-10">
          <h2 className="text-3xl font-semibold tracking-tight">
            Start your next world.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Procedural assets, environment kits, and the tools to make them
            yours.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/browse">Explore the catalog</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See membership</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
