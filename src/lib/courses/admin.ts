import "server-only";
import { prisma } from "@/lib/db/prisma";

/*
 * Admin-side course reads for the course builder. Runs inside the role-gated
 * admin, so it reads drafts and exposes everything (including AnswerOption
 * correctness, which the builder needs to edit but the player never receives).
 */

export async function listCoursesForAdmin() {
  const rows = await prisma.product.findMany({
    where: { type: "COURSE" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      priceCents: true,
      currency: true,
      course: {
        select: {
          id: true,
          chapters: {
            select: {
              _count: { select: { lessons: true, quizzes: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((p) => ({
    ...p,
    chapterCount: p.course?.chapters.length ?? 0,
    lessonCount:
      p.course?.chapters.reduce((n, c) => n + c._count.lessons, 0) ?? 0,
    quizCount:
      p.course?.chapters.reduce((n, c) => n + c._count.quizzes, 0) ?? 0,
    hasCourse: p.course != null,
  }));
}

export async function getCourseBuilderData(productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, type: "COURSE" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      course: {
        select: {
          id: true,
          summary: true,
          level: true,
          estimatedTime: true,
          releaseDate: true,
          prerequisites: true,
          instructor: true,
          instructorTitle: true,
          software: true,
          outcomes: true,
          expectedRoi: true,
          chapters: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              sortOrder: true,
              lessons: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  title: true,
                  youtubeVideoId: true,
                  durationSeconds: true,
                  sortOrder: true,
                },
              },
              quizzes: {
                select: {
                  id: true,
                  title: true,
                  passingScore: true,
                  allowRetake: true,
                  requiredToContinue: true,
                  questions: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                      id: true,
                      type: true,
                      prompt: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { id: true, text: true, isCorrect: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export type CourseBuilderData = NonNullable<
  Awaited<ReturnType<typeof getCourseBuilderData>>
>;
