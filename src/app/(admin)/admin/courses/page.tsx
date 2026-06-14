import Link from "next/link";
import { listCoursesForAdmin } from "@/lib/courses/admin";
import { formatMoney } from "@/lib/format";

/*
 * Admin course list. Every COURSE-type product (any status), with a quick read
 * on whether its curriculum has been started and how much it holds. Click
 * through to the builder. Courses are created as products on the product CRUD
 * side; this surface manages their curriculum.
 */
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-border text-muted-foreground",
  PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
  ARCHIVED: "border-border bg-muted/40 text-muted-foreground line-through",
};

export default async function AdminCoursesPage() {
  const courses = await listCoursesForAdmin();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:px-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courses.length} course{courses.length === 1 ? "" : "s"} · build
            chapters, lessons, and quizzes
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm transition hover:bg-muted/40"
        >
          New course product
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Curriculum</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No courses yet. Create a product of type{" "}
                  <span className="font-mono">COURSE</span> first, then build its
                  curriculum here.
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {c.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.slug}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {c.hasCourse ? (
                      <>
                        {c.chapterCount} ch · {c.lessonCount} lessons ·{" "}
                        {c.quizCount} quiz
                      </>
                    ) : (
                      <span className="text-amber-600">not started</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(c.priceCents, c.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      Build →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
