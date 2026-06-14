import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseBuilderData } from "@/lib/courses/admin";
import { CourseBuilder } from "@/components/admin/course-builder";

/*
 * Course builder page. Loads the full curriculum for one COURSE product (incl.
 * answer-correctness, which only this role-gated surface ever sees) and hands
 * it to the client builder. The (admin) layout already enforces EDITOR+.
 */
export const dynamic = "force-dynamic";

export default async function CourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCourseBuilderData(id);
  if (!data) notFound();

  return (
    <section className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <nav className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/admin/courses" className="hover:text-foreground">
          COURSES
        </Link>
        <span className="text-border">/</span>
        <span className="text-primary/70">{data.slug}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${
            data.status === "PUBLISHED"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {data.status}
        </span>
        <Link
          href={`/admin/products/${data.id}/edit`}
          className="ml-auto font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          Edit product details →
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Build the curriculum: chapters hold lessons (unlisted YouTube videos) and
        quizzes. Changes publish to the live syllabus immediately.
      </p>

      <div className="mt-8">
        <CourseBuilder data={data} />
      </div>
    </section>
  );
}
