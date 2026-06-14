import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { listEnrolledCourses } from "@/lib/courses/queries";
import { SchematicArt } from "@/components/storefront/schematic-art";

/*
 * "My learning", the account-side index of courses the viewer is enrolled in,
 * each with a live progress bar. Links into the LMS player. Gated by the
 * (account) layout; per-user, so dynamic.
 */
export const dynamic = "force-dynamic";

export default async function LearnIndexPage() {
  const user = await requireUser();
  const courses = await listEnrolledCourses(user.id);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <span className="mono-label">Clay Academy</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">My learning</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Courses you&apos;re enrolled in. Pick up where you left off, progress is
        tracked as you watch.
      </p>

      {courses.length === 0 ? (
        <div className="mt-10 border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">
            You&apos;re not enrolled in any courses yet.
          </p>
          <Link
            href="/courses"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-border px-5 text-sm transition hover:bg-muted/40"
          >
            Browse courses →
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const thumb = c.media[0]?.url;
            const done = c.percent >= 100;
            return (
              <Link
                key={c.slug}
                href={`/learn/${c.slug}`}
                className="group flex flex-col border border-border bg-card/40 transition-colors hover:border-primary/60"
              >
                <div className="clay-cover relative aspect-[16/9] w-full overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={c.media[0]?.alt ?? c.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <SchematicArt
                      seed={c.slug}
                      type="COURSE"
                      className="absolute inset-0 h-full w-full opacity-90"
                    />
                  )}
                  <span className="mono-label absolute left-3 top-3 border border-border bg-background/70 px-2 py-1 backdrop-blur">
                    {done ? "Complete" : "Enrolled"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 border-t border-border p-4">
                  <h2 className="text-balance font-medium leading-tight tracking-tight transition-colors group-hover:text-primary">
                    {c.title}
                  </h2>

                  <div className="mt-auto">
                    <div className="flex items-center justify-between font-mono text-[0.625rem] text-muted-foreground">
                      <span>
                        {c.completedCount}/{c.lessonCount} lessons
                      </span>
                      <span className="text-primary">{c.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${c.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
