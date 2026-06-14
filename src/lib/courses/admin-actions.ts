"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth-guards";
import { fetchYoutubeDurationSeconds } from "@/lib/video/youtube";
import { CourseLevel, type QuestionType } from "@prisma/client";

/*
 * Course-builder mutations (EDITOR+). Each course is the curriculum for a
 * COURSE-type product: ensureCourse creates the 1:1 Course row, then chapters,
 * lessons (unlisted YouTube id + duration), quizzes, and questions hang off it.
 * sortOrder is always max+1 so new items append. Every mutation re-validates
 * the builder page and the public syllabus so changes show immediately.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

async function revalidateCourse(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  revalidatePath(`/admin/courses/${productId}`);
  if (product) {
    revalidatePath(`/courses/${product.slug}`);
    revalidatePath("/courses");
  }
}

export async function ensureCourse(productId: string): Promise<ActionResult> {
  await requireRole("EDITOR");
  const product = await prisma.product.findFirst({
    where: { id: productId, type: "COURSE" },
    select: { id: true, course: { select: { id: true } } },
  });
  if (!product) return { ok: false, error: "Course product not found." };
  if (!product.course) {
    await prisma.course.create({ data: { productId } });
  }
  await revalidateCourse(productId);
  return { ok: true };
}

/** Split a textarea/input into a trimmed, de-blanked list. */
function splitList(raw: string | undefined, by: "comma" | "lines"): string[] {
  if (!raw) return [];
  const parts = by === "comma" ? raw.split(",") : raw.split(/\r?\n/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

const courseDetailsInput = z.object({
  productId: z.string().min(1),
  courseId: z.string().min(1),
  summary: z.string().max(2000).optional(),
  level: z.string().optional(),
  estimatedTime: z.string().max(160).optional(),
  releaseDate: z.string().max(40).optional(),
  prerequisites: z.string().max(4000).optional(),
  instructor: z.string().max(200).optional(),
  instructorTitle: z.string().max(200).optional(),
  software: z.string().max(1000).optional(), // comma-separated
  outcomes: z.string().max(8000).optional(), // one per line
  expectedRoi: z.string().max(4000).optional(),
});

/**
 * Save the course-level syllabus metadata (level, instructor, prerequisites,
 * software, outcomes, expected ROI, …). These power the public course page and,
 * later, the course filters. Free-form lists are parsed from comma- or
 * newline-separated input so the admin form stays simple.
 */
export async function updateCourseDetails(
  input: unknown,
): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = courseDetailsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid course details." };
  const d = parsed.data;

  const level =
    d.level && (Object.values(CourseLevel) as string[]).includes(d.level)
      ? (d.level as CourseLevel)
      : null;

  let releaseDate: Date | null = null;
  if (d.releaseDate?.trim()) {
    const parsedDate = new Date(d.releaseDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return { ok: false, error: "Invalid release date." };
    }
    releaseDate = parsedDate;
  }

  await prisma.course.update({
    where: { id: d.courseId },
    data: {
      summary: d.summary?.trim() || null,
      level,
      estimatedTime: d.estimatedTime?.trim() || null,
      releaseDate,
      prerequisites: d.prerequisites?.trim() || null,
      instructor: d.instructor?.trim() || null,
      instructorTitle: d.instructorTitle?.trim() || null,
      software: splitList(d.software, "comma"),
      outcomes: splitList(d.outcomes, "lines"),
      expectedRoi: d.expectedRoi?.trim() || null,
    },
  });
  await revalidateCourse(d.productId);
  return { ok: true };
}

const chapterInput = z.object({
  productId: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1).max(200),
});

export async function addChapter(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = chapterInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid chapter." };
  const last = await prisma.chapter.findFirst({
    where: { courseId: parsed.data.courseId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.chapter.create({
    data: {
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await revalidateCourse(parsed.data.productId);
  return { ok: true };
}

export async function deleteChapter(
  productId: string,
  chapterId: string,
): Promise<ActionResult> {
  await requireRole("EDITOR");
  await prisma.chapter.delete({ where: { id: chapterId } });
  await revalidateCourse(productId);
  return { ok: true };
}

const lessonInput = z.object({
  productId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1).max(200),
  youtubeVideoId: z.string().max(40).optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});

export async function addLesson(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = lessonInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid lesson." };
  const { productId, chapterId, title } = parsed.data;
  const videoId = parsed.data.youtubeVideoId?.trim() || null;

  // Prefer an explicit duration; otherwise try the Data API (no-op without a key).
  let durationSeconds = parsed.data.durationSeconds ?? null;
  if (!durationSeconds && videoId) {
    durationSeconds = await fetchYoutubeDurationSeconds(videoId);
  }

  const last = await prisma.lesson.findFirst({
    where: { chapterId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.lesson.create({
    data: {
      chapterId,
      title,
      youtubeVideoId: videoId,
      durationSeconds,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await revalidateCourse(productId);
  return { ok: true };
}

export async function deleteLesson(
  productId: string,
  lessonId: string,
): Promise<ActionResult> {
  await requireRole("EDITOR");
  await prisma.lesson.delete({ where: { id: lessonId } });
  await revalidateCourse(productId);
  return { ok: true };
}

const quizInput = z.object({
  productId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1).max(200),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  requiredToContinue: z.coerce.boolean().default(false),
});

export async function addQuiz(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = quizInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quiz." };
  await prisma.quiz.create({
    data: {
      chapterId: parsed.data.chapterId,
      title: parsed.data.title,
      passingScore: parsed.data.passingScore,
      requiredToContinue: parsed.data.requiredToContinue,
    },
  });
  await revalidateCourse(parsed.data.productId);
  return { ok: true };
}

export async function deleteQuiz(
  productId: string,
  quizId: string,
): Promise<ActionResult> {
  await requireRole("EDITOR");
  await prisma.quiz.delete({ where: { id: quizId } });
  await revalidateCourse(productId);
  return { ok: true };
}

const QUESTION_TYPES = [
  "MULTIPLE_CHOICE_SINGLE",
  "MULTIPLE_CHOICE_MULTI",
  "TRUE_FALSE",
  "SHORT_ANSWER",
] as const;

const questionInput = z.object({
  productId: z.string().min(1),
  quizId: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1).max(500),
  options: z
    .array(z.object({ text: z.string().min(1).max(300), isCorrect: z.boolean() }))
    .min(1)
    .max(8),
});

export async function addQuestion(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = questionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid question." };
  const { productId, quizId, type, prompt, options } = parsed.data;

  if (!options.some((o) => o.isCorrect)) {
    return { ok: false, error: "Mark at least one correct answer." };
  }

  const last = await prisma.question.findFirst({
    where: { quizId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.question.create({
    data: {
      quizId,
      type: type as QuestionType,
      prompt,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      options: {
        create: options.map((o, i) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          sortOrder: i,
        })),
      },
    },
  });
  await revalidateCourse(productId);
  return { ok: true };
}

export async function deleteQuestion(
  productId: string,
  questionId: string,
): Promise<ActionResult> {
  await requireRole("EDITOR");
  await prisma.question.delete({ where: { id: questionId } });
  await revalidateCourse(productId);
  return { ok: true };
}
