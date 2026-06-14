import Link from "next/link";
import type { CourseLevel } from "@prisma/client";
import { listPublishedCourses, getCourseFacets } from "@/lib/courses/queries";
import { CourseCard } from "@/components/courses/course-card";
import { formatRuntime } from "@/lib/video/youtube";

/*
 * Courses catalog, the storefront landing for the LMS. A header tab routes
 * here; it shows every published COURSE product as a card (cover, curriculum
 * stats, price). Faceted by level and used software via URL searchParams, so
 * the page is rendered dynamically (per-request) rather than via ISR.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Courses · Clay",
  description:
    "Procedural-art courses, learn the craft behind the kits, then build worlds that are uniquely yours.",
};

const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All levels",
};

type SearchParams = { level?: string; software?: string };

function buildHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  if (merged.level) sp.set("level", merged.level);
  if (merged.software) sp.set("software", merged.software);
  const qs = sp.toString();
  return qs ? `/courses?${qs}` : "/courses";
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const level =
    sp.level && sp.level in LEVEL_LABELS
      ? (sp.level as CourseLevel)
      : undefined;
  const software = sp.software?.trim() || undefined;

  const [courses, facets] = await Promise.all([
    listPublishedCourses({ level, software }),
    getCourseFacets(),
  ]);

  const totals = courses.reduce(
    (acc, c) => ({
      lessons: acc.lessons + c.stats.lessonCount,
      seconds: acc.seconds + c.stats.totalSeconds,
    }),
    { lessons: 0, seconds: 0 },
  );

  const filtersActive = Boolean(level || software);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      {/* Hero */}
      <div className="border border-border bg-card/40 p-6 md:p-10">
        <span className="mono-label">Clay Academy</span>
        <h1 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Learn the craft behind the kits.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Procedural modelling, environment design, and engine pipelines, taught by the people who build the assets you ship. Watch, build, and
          prove it with a quiz at the end of every chapter.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
          <span>
            <span className="text-primary">{String(courses.length).padStart(2, "0")}</span>{" "}
            courses
          </span>
          <span className="text-border">·</span>
          <span>
            <span className="text-primary">{String(totals.lessons).padStart(2, "0")}</span>{" "}
            lessons
          </span>
          {totals.seconds > 0 ? (
            <>
              <span className="text-border">·</span>
              <span>
                <span className="text-primary">{formatRuntime(totals.seconds)}</span>{" "}
                of video
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Filters + grid */}
      <div className="mt-10 grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="space-y-px self-start border border-border bg-border">
          <div className="bg-background p-4">
            <h2 className="mono-label mb-3">Level</h2>
            <ul className="space-y-0.5 text-sm">
              <li>
                <Link
                  href={buildHref(sp, { level: undefined })}
                  className={`block px-2 py-1.5 transition-colors ${!level ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                >
                  All levels
                </Link>
              </li>
              {facets.levels.map((l) => (
                <li key={l.value}>
                  <Link
                    href={buildHref(sp, { level: l.value })}
                    className={`flex justify-between px-2 py-1.5 transition-colors ${level === l.value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                  >
                    <span>{LEVEL_LABELS[l.value]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(l.count).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {facets.software.length > 0 ? (
            <div className="bg-background p-4">
              <h2 className="mono-label mb-3">Software</h2>
              <ul className="space-y-0.5 text-sm">
                <li>
                  <Link
                    href={buildHref(sp, { software: undefined })}
                    className={`block px-2 py-1.5 transition-colors ${!software ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                  >
                    Any software
                  </Link>
                </li>
                {facets.software.map((s) => (
                  <li key={s.value}>
                    <Link
                      href={buildHref(sp, { software: s.value })}
                      className={`flex justify-between gap-2 px-2 py-1.5 transition-colors ${software === s.value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"}`}
                    >
                      <span className="truncate">{s.value}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(s.count).padStart(2, "0")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="bg-background p-4">
            <Link
              href="/browse?type=COURSE"
              className="block px-2 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              In catalog →
            </Link>
            {filtersActive ? (
              <Link
                href="/courses"
                className="mt-1 block px-2 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                ✕ Clear filters
              </Link>
            ) : null}
          </div>
        </aside>

        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {String(courses.length).padStart(2, "0")}{" "}
            {courses.length === 1 ? "course" : "courses"}
            {level ? ` · ${LEVEL_LABELS[level].toLowerCase()}` : ""}
            {software ? ` · ${software}` : ""}
          </p>

          {courses.length === 0 ? (
            <div className="border border-dashed border-border py-20 text-center text-muted-foreground">
              No courses match these filters yet.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
