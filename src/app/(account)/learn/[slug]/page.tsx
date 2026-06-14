import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getCoursePlayerData } from "@/lib/courses/queries";
import { CoursePlayerShell } from "@/components/courses/course-player-shell";

/*
 * The LMS player route. Ownership-gated: getCoursePlayerData returns null unless
 * the viewer holds a live entitlement on the course, in which case we bounce to
 * the public course page (where they can enroll). Otherwise it hands the full
 * curriculum, including the unlisted video ids, to the client player shell.
 */
export const dynamic = "force-dynamic";

export default async function LearnPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const data = await getCoursePlayerData(slug, user.id);

  // No course, or the viewer doesn't own it → send them to the enroll page.
  if (!data) redirect(`/courses/${slug}`);

  const passedQuizIds = Object.entries(data.attemptByQuiz)
    .filter(([, a]) => a.passed)
    .map(([id]) => id);

  return (
    <CoursePlayerShell
      courseTitle={data.product.title}
      slug={data.product.slug}
      chapters={data.course.chapters}
      progressByLesson={data.progressByLesson}
      passedQuizIds={passedQuizIds}
    />
  );
}
