import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { formatRuntime } from "@/lib/video/youtube";
import { SchematicArt } from "@/components/storefront/schematic-art";
import { hashSeed } from "@/lib/schematic";
import type { CourseCardData } from "@/lib/courses/queries";

/** Stable catalog code, e.g. CL-3F9A, reads like a part number. */
function partCode(slug: string): string {
  return `CL-${hashSeed(slug).toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const thumb = course.media[0]?.url;
  const onSale =
    course.discountCents != null && course.discountCents < course.priceCents;
  const free = course.priceCents === 0;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group relative flex flex-col border border-border bg-card/40 transition-colors duration-200 hover:border-primary/60"
    >
      <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />

      <div className="clay-cover relative aspect-[16/9] w-full overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={course.media[0]?.alt ?? course.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <SchematicArt
            seed={course.slug}
            type="COURSE"
            className="absolute inset-0 h-full w-full opacity-90 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        <span className="mono-label absolute left-3 top-3 border border-border bg-background/70 px-2 py-1 backdrop-blur">
          Course
        </span>
        <span className="absolute right-3 top-3 font-mono text-[0.625rem] tracking-widest text-primary/80">
          {partCode(course.slug)}
        </span>
        {/* Play glyph on hover, signals "this is video". */}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/60 bg-background/70 backdrop-blur">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.5v9l7-4.5z" fill="currentColor" className="text-primary" />
            </svg>
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-border p-4">
        <h3 className="text-balance font-medium leading-tight tracking-tight transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        {course.shortDesc ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.shortDesc}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground">
          <span>{course.stats.chapterCount} chapters</span>
          <span className="text-border">·</span>
          <span>{course.stats.lessonCount} lessons</span>
          {course.stats.totalSeconds > 0 ? (
            <>
              <span className="text-border">·</span>
              <span>{formatRuntime(course.stats.totalSeconds)}</span>
            </>
          ) : null}
        </div>

        <div className="mt-auto flex items-baseline gap-2 border-t border-dashed border-border/70 pt-3 font-mono">
          <span className="mono-label not-italic">ENROLL</span>
          {free ? (
            <span className="ml-auto text-sm font-semibold text-primary">Free</span>
          ) : onSale ? (
            <>
              <span className="ml-auto text-sm font-semibold text-primary">
                {formatMoney(course.discountCents!, course.currency)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {formatMoney(course.priceCents, course.currency)}
              </span>
            </>
          ) : (
            <span className="ml-auto text-sm font-semibold">
              {formatMoney(course.priceCents, course.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
