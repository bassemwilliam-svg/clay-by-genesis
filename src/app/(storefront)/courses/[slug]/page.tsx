import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPublishedCourseBySlug, isEnrolled } from "@/lib/courses/queries";
import { enrollInCourse } from "@/lib/courses/actions";
import { formatDuration, formatRuntime } from "@/lib/video/youtube";
import { formatMoney } from "@/lib/format";
import { SchematicArt } from "@/components/storefront/schematic-art";
import { hashSeed } from "@/lib/schematic";

/*
 * Public course page, the syllabus and the enroll gate. Anyone can read the
 * curriculum (chapter/lesson titles, runtimes, quiz counts), but video ids are
 * never exposed here. Owners get a "Continue learning" link into the LMS; the
 * rest get an enroll CTA. Per-user (session) state → dynamic render.
 */
export const dynamic = "force-dynamic";

/** Stable catalog code, e.g. CL-3F9A, reads like a part number. */
function partCode(slug: string): string {
  return `CL-${hashSeed(slug).toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All levels",
};

const releaseFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
});

/** One labelled row in the course spec sheet; renders nothing when empty. */
function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <span className="text-[0.5625rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  const session = await auth();
  const enrolled = session?.user
    ? await isEnrolled(session.user.id, course.id)
    : false;

  const onSale =
    course.discountCents != null && course.discountCents < course.priceCents;
  const free = course.priceCents === 0;
  const hero = course.media[0];
  const code = partCode(course.slug);
  const detail = course.course;
  const chapters = detail?.chapters ?? [];
  const levelLabel = detail?.level ? LEVEL_LABELS[detail.level] : null;
  const releaseLabel = detail?.releaseDate
    ? releaseFmt.format(detail.releaseDate)
    : null;
  const hasMeta = Boolean(
    levelLabel ||
      detail?.instructor ||
      detail?.estimatedTime ||
      releaseLabel ||
      (detail?.software?.length ?? 0) > 0,
  );

  // Running lesson number across the whole syllabus (for the spec-sheet feel).
  let lessonNo = 0;

  return (
    <article className="mx-auto max-w-[1600px] px-6 py-10 md:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/courses" className="transition-colors hover:text-foreground">
          COURSES
        </Link>
        <span className="text-border">/</span>
        <span className="text-primary/70">{code}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          {/* Cover */}
          <div className="bp-ticks clay-cover relative aspect-[16/9] w-full overflow-hidden border border-border">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.url}
                alt={hero.alt ?? course.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <SchematicArt
                seed={course.slug}
                type="COURSE"
                className="absolute inset-0 h-full w-full"
              />
            )}
            <span className="mono-label absolute left-3 top-3 border border-border bg-background/70 px-2 py-1 backdrop-blur">
              Course
            </span>
            <span className="absolute right-3 top-3 font-mono text-[0.625rem] tracking-widest text-primary/80">
              {code}
            </span>
          </div>

          {course.fullDesc ? (
            <section className="mt-8 max-w-3xl">
              <span className="mono-label">{"// about this course"}</span>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">
                {course.fullDesc}
              </p>
            </section>
          ) : null}

          {detail?.outcomes && detail.outcomes.length > 0 ? (
            <section className="mt-8 max-w-3xl">
              <span className="mono-label">{"// what you'll learn"}</span>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {detail.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary"
                    />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {detail?.prerequisites ? (
            <section className="mt-8 max-w-3xl">
              <span className="mono-label">{"// prerequisites"}</span>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">
                {detail.prerequisites}
              </p>
            </section>
          ) : null}

          {detail?.expectedRoi ? (
            <section className="mt-8 max-w-3xl border-l-2 border-primary/50 bg-primary/5 p-4">
              <span className="mono-label text-primary/80">
                {"// the payoff"}
              </span>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {detail.expectedRoi}
              </p>
            </section>
          ) : null}
        </div>

        <div className="flex flex-col">
          <span className="mono-label">Course</span>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight">
            {course.title}
          </h1>
          {course.shortDesc ? (
            <p className="mt-3 text-muted-foreground">{course.shortDesc}</p>
          ) : null}

          {/* Curriculum stats */}
          <dl className="mt-6 grid grid-cols-3 gap-px border border-border bg-border font-mono">
            <Stat label="Chapters" value={String(course.stats.chapterCount)} />
            <Stat label="Lessons" value={String(course.stats.lessonCount)} />
            <Stat
              label="Runtime"
              value={
                course.stats.totalSeconds > 0
                  ? formatRuntime(course.stats.totalSeconds)
                  : "-"
              }
            />
          </dl>

          {/* Course spec sheet */}
          {hasMeta ? (
            <div className="mt-4 divide-y divide-border border border-border">
              <MetaRow label="Level" value={levelLabel} />
              <MetaRow label="Instructor" value={detail?.instructor ?? null} />
              <MetaRow
                label="Estimated time"
                value={detail?.estimatedTime ?? null}
              />
              <MetaRow label="Released" value={releaseLabel} />
              {detail?.software && detail.software.length > 0 ? (
                <MetaRow label="Software" value={detail.software.join(", ")} />
              ) : null}
            </div>
          ) : null}

          {/* Price + CTA */}
          <div className="mt-6 flex items-baseline gap-3 border-y border-dashed border-border/70 py-4 font-mono">
            <span className="mono-label not-italic">ENROLLMENT</span>
            {free ? (
              <span className="ml-auto text-2xl font-semibold text-primary">
                Free
              </span>
            ) : onSale ? (
              <>
                <span className="ml-auto text-2xl font-semibold text-primary">
                  {formatMoney(course.discountCents!, course.currency)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatMoney(course.priceCents, course.currency)}
                </span>
              </>
            ) : (
              <span className="ml-auto text-2xl font-semibold">
                {formatMoney(course.priceCents, course.currency)}
              </span>
            )}
          </div>

          {enrolled ? (
            <Link
              href={`/learn/${course.slug}`}
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Continue learning →
            </Link>
          ) : session?.user ? (
            <form action={enrollInCourse}>
              <input type="hidden" name="slug" value={course.slug} />
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                {free ? "Enroll for free" : "Enroll now"}
              </button>
            </form>
          ) : (
            <Link
              href={`/login?next=/courses/${course.slug}`}
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Sign in to enroll
            </Link>
          )}

          <p className="mt-3 text-center font-mono text-[0.625rem] text-muted-foreground">
            Lifetime access · watch in the browser · chapter quizzes
          </p>

          {course.license ? (
            <div className="mt-6 border border-border p-4 text-sm">
              <span className="mono-label">License</span>
              <p className="mt-2 font-medium">{course.license.name}</p>
              {course.license.summary ? (
                <p className="mt-1 text-muted-foreground">
                  {course.license.summary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Syllabus */}
      <section className="mt-14">
        <span className="mono-label">Syllabus</span>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          What you&apos;ll cover
        </h2>

        {chapters.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            The curriculum for this course is being finalized.
          </p>
        ) : (
          <div className="mt-6 space-y-px border border-border bg-border">
            {chapters.map((chapter, ci) => (
              <div key={chapter.id} className="bg-background">
                <div className="flex items-center gap-3 bg-muted/20 px-5 py-3">
                  <span className="font-mono text-xs text-primary/60">
                    {String(ci + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-medium tracking-tight">{chapter.title}</h3>
                  <span className="ml-auto font-mono text-[0.625rem] text-muted-foreground">
                    {chapter.lessons.length} lesson
                    {chapter.lessons.length === 1 ? "" : "s"}
                    {chapter.quizzes.length > 0
                      ? ` · ${chapter.quizzes.length} quiz`
                      : ""}
                  </span>
                </div>
                <ul className="divide-y divide-border/60">
                  {chapter.lessons.map((lesson) => {
                    lessonNo++;
                    return (
                      <li
                        key={lesson.id}
                        className="flex items-center gap-3 px-5 py-2.5 text-sm"
                      >
                        <span className="font-mono text-[0.625rem] text-muted-foreground/60">
                          {String(lessonNo).padStart(2, "0")}
                        </span>
                        <PlayGlyph />
                        <span className="flex-1 truncate text-muted-foreground">
                          {lesson.title}
                        </span>
                        <span className="font-mono text-[0.625rem] text-muted-foreground/70">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      </li>
                    );
                  })}
                  {chapter.quizzes.map((quiz) => (
                    <li
                      key={quiz.id}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm"
                    >
                      <span className="font-mono text-[0.625rem] text-muted-foreground/60">
                        ··
                      </span>
                      <QuizGlyph />
                      <span className="flex-1 truncate text-muted-foreground">
                        {quiz.title}
                      </span>
                      <span className="font-mono text-[0.625rem] text-primary/70">
                        {quiz._count.questions} Q
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-3 text-center">
      <div className="text-lg font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[0.5625rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PlayGlyph() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-primary/70">
      <svg width="8" height="8" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
      </svg>
    </span>
  );
}

function QuizGlyph() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary/40 font-mono text-[0.5rem] text-primary">
      ?
    </span>
  );
}
