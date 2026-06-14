import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { CourseLevel, Prisma } from "@prisma/client";

/*
 * Course reads. Courses ARE products (type COURSE) with a 1:1 Course detail row
 * that owns the curriculum (chapters → lessons + quizzes). The storefront reads
 * here only ever return PUBLISHED courses; the player read additionally checks
 * ownership before exposing the (unlisted) YouTube ids.
 *
 * Ownership is the Entitlement table, the single source of truth (a purchase,
 * bundle fan-out, or grant all land there). Enrollment is the learning-progress
 * record created alongside it.
 */

const PUBLISHED = { status: "PUBLISHED" as const };

export type CourseStats = {
  chapterCount: number;
  lessonCount: number;
  quizCount: number;
  totalSeconds: number;
};

export type CourseFilters = { level?: CourseLevel; software?: string };

/** Catalog grid: every published course with cover + a curriculum summary. */
export async function listPublishedCourses(filters: CourseFilters = {}) {
  const where: Prisma.ProductWhereInput = { ...PUBLISHED, type: "COURSE" };
  if (filters.level || filters.software) {
    where.course = {
      is: {
        ...(filters.level ? { level: filters.level } : {}),
        ...(filters.software ? { software: { has: filters.software } } : {}),
      },
    };
  }
  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      priceCents: true,
      discountCents: true,
      currency: true,
      media: {
        where: { kind: "THUMBNAIL" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true, alt: true },
      },
      course: {
        select: {
          summary: true,
          chapters: {
            select: {
              _count: { select: { quizzes: true } },
              lessons: { select: { durationSeconds: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((p) => {
    const chapters = p.course?.chapters ?? [];
    const stats: CourseStats = {
      chapterCount: chapters.length,
      lessonCount: chapters.reduce((n, c) => n + c.lessons.length, 0),
      quizCount: chapters.reduce((n, c) => n + c._count.quizzes, 0),
      totalSeconds: chapters.reduce(
        (n, c) =>
          n + c.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
        0,
      ),
    };
    return { ...p, stats };
  });
}

export type CourseCardData = Awaited<
  ReturnType<typeof listPublishedCourses>
>[number];

export type CourseFacets = {
  levels: { value: CourseLevel; count: number }[];
  software: { value: string; count: number }[];
};

/**
 * Facet counts for the course filters (level + used software), computed over
 * every published course. The course set is small, so we aggregate in memory
 * rather than running a groupBy per dimension.
 */
export async function getCourseFacets(): Promise<CourseFacets> {
  const rows = await prisma.product.findMany({
    where: { ...PUBLISHED, type: "COURSE" },
    select: { course: { select: { level: true, software: true } } },
  });

  const levelCounts = new Map<CourseLevel, number>();
  const softwareCounts = new Map<string, number>();
  for (const r of rows) {
    const c = r.course;
    if (!c) continue;
    if (c.level) levelCounts.set(c.level, (levelCounts.get(c.level) ?? 0) + 1);
    for (const s of c.software ?? []) {
      softwareCounts.set(s, (softwareCounts.get(s) ?? 0) + 1);
    }
  }

  // Level is an ordered scale; keep a stable, meaningful order.
  const LEVEL_ORDER: CourseLevel[] = [
    "BEGINNER",
    "INTERMEDIATE",
    "ADVANCED",
    "ALL_LEVELS",
  ];
  return {
    levels: LEVEL_ORDER.filter((l) => levelCounts.has(l)).map((value) => ({
      value,
      count: levelCounts.get(value) ?? 0,
    })),
    software: [...softwareCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };
}

/** Public syllabus for the course landing page. No video ids are exposed. */
export async function getPublishedCourseBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, ...PUBLISHED, type: "COURSE" },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      fullDesc: true,
      priceCents: true,
      discountCents: true,
      currency: true,
      category: { select: { name: true, slug: true } },
      license: { select: { name: true, summary: true } },
      media: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
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
              lessons: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, durationSeconds: true },
              },
              quizzes: {
                select: {
                  id: true,
                  title: true,
                  _count: { select: { questions: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!product?.course) return null;

  const chapters = product.course.chapters;
  const stats: CourseStats = {
    chapterCount: chapters.length,
    lessonCount: chapters.reduce((n, c) => n + c.lessons.length, 0),
    quizCount: chapters.reduce((n, c) => n + c.quizzes.length, 0),
    totalSeconds: chapters.reduce(
      (n, c) => n + c.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0),
      0,
    ),
  };
  return { ...product, stats };
}

export type CourseSyllabus = NonNullable<
  Awaited<ReturnType<typeof getPublishedCourseBySlug>>
>;

/** Does this user own the course (entitlement is the source of truth)? */
export async function isEnrolled(userId: string, productId: string) {
  const ent = await prisma.entitlement.findFirst({
    where: { userId, productId, revokedAt: null },
    select: { id: true },
  });
  return ent != null;
}

/**
 * Everything the player needs: full curriculum *including* the unlisted video
 * ids, plus the viewer's progress. Returns null when the course doesn't exist
 * or the viewer doesn't own it, the caller turns that into a redirect.
 */
export async function getCoursePlayerData(slug: string, userId: string) {
  const product = await prisma.product.findFirst({
    where: { slug, ...PUBLISHED, type: "COURSE" },
    select: {
      id: true,
      slug: true,
      title: true,
      course: {
        select: {
          id: true,
          summary: true,
          chapters: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              lessons: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  title: true,
                  youtubeVideoId: true,
                  durationSeconds: true,
                },
              },
              quizzes: {
                select: {
                  id: true,
                  title: true,
                  passingScore: true,
                  allowRetake: true,
                  showCorrectAnswers: true,
                  requiredToContinue: true,
                  questions: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                      id: true,
                      type: true,
                      prompt: true,
                      // isCorrect is intentionally NOT selected, never sent to
                      // the client. Grading happens server-side in submitQuiz.
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { id: true, text: true },
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
  if (!product?.course) return null;

  const owned = await isEnrolled(userId, product.id);
  if (!owned) return null;

  const lessonIds = product.course.chapters.flatMap((c) =>
    c.lessons.map((l) => l.id),
  );
  const progress = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: {
      lessonId: true,
      completed: true,
      lastPositionSeconds: true,
      maxPositionSeconds: true,
    },
  });
  const quizIds = product.course.chapters.flatMap((c) =>
    c.quizzes.map((q) => q.id),
  );
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, quizId: { in: quizIds } },
    orderBy: { submittedAt: "desc" },
    select: { quizId: true, scorePct: true, passed: true },
  });

  // Latest attempt per quiz (the query is newest-first, so first wins).
  const bestByQuiz: Record<string, { scorePct: number; passed: boolean }> = {};
  for (const a of attempts) {
    if (!bestByQuiz[a.quizId]) {
      bestByQuiz[a.quizId] = { scorePct: a.scorePct, passed: a.passed };
    }
  }

  return {
    product,
    course: product.course,
    progressByLesson: Object.fromEntries(progress.map((p) => [p.lessonId, p])),
    attemptByQuiz: bestByQuiz,
  };
}

export type CoursePlayerData = NonNullable<
  Awaited<ReturnType<typeof getCoursePlayerData>>
>;

/** Courses the user is enrolled in, with progress %, for the /learn index. */
export async function listEnrolledCourses(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "desc" },
    select: {
      enrolledAt: true,
      course: {
        select: {
          product: {
            select: {
              slug: true,
              title: true,
              shortDesc: true,
              media: {
                where: { kind: "THUMBNAIL" },
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true, alt: true },
              },
            },
          },
          chapters: { select: { lessons: { select: { id: true } } } },
        },
      },
    },
  });

  // Progress = completed lessons / total lessons across each course.
  const allLessonIds = enrollments.flatMap((e) =>
    e.course.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
  );
  const completed = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: allLessonIds }, completed: true },
    select: { lessonId: true },
  });
  const completedSet = new Set(completed.map((c) => c.lessonId));

  return enrollments.map((e) => {
    const lessonIds = e.course.chapters.flatMap((c) =>
      c.lessons.map((l) => l.id),
    );
    const done = lessonIds.filter((id) => completedSet.has(id)).length;
    const total = lessonIds.length;
    return {
      slug: e.course.product.slug,
      title: e.course.product.title,
      shortDesc: e.course.product.shortDesc,
      media: e.course.product.media,
      lessonCount: total,
      completedCount: done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}
