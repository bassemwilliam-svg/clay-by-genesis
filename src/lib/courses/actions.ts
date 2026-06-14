"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth-guards";

/*
 * Course enrollment + quiz grading.
 *
 * Enrollment: in the finished pipeline (Stage 8) a paid order's webhook grants
 * the Entitlement and creates the Enrollment. Until that's wired, this action
 * grants a demo Entitlement (source GRANT) + Enrollment directly so the full
 * LMS is exercisable end-to-end. It mirrors exactly what the webhook will do, * Entitlement is the single source of truth for ownership; Enrollment tracks
 * learning, so swapping in the purchase path later changes only *who* calls it.
 *
 * Quiz grading is server-side and authoritative: answer correctness
 * (AnswerOption.isCorrect) never reaches the client, so the score can't be
 * forged. Correct answers are only echoed back when the quiz allows it.
 */

export async function enrollInCourse(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");

  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED", type: "COURSE" },
    select: { id: true, course: { select: { id: true } } },
  });
  if (!product?.course) {
    throw new Error("Course not found.");
  }

  await prisma.$transaction([
    prisma.entitlement.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      update: { revokedAt: null },
      create: { userId: user.id, productId: product.id, source: "GRANT" },
    }),
    prisma.enrollment.upsert({
      where: {
        userId_courseId: { userId: user.id, courseId: product.course.id },
      },
      update: {},
      create: { userId: user.id, courseId: product.course.id },
    }),
  ]);

  revalidatePath(`/courses/${slug}`);
  revalidatePath("/learn");
  redirect(`/learn/${slug}`);
}

// ── Quiz grading ──────────────────────────────────────────────────────────

const answerSchema = z.object({
  quizId: z.string().min(1),
  // questionId -> selected option id(s) (choice/true-false) or free text.
  answers: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())]),
  ),
});

export type QuizQuestionResult = {
  questionId: string;
  correct: boolean;
  correctOptionIds?: string[];
};

export type QuizSubmitResult =
  | {
      ok: true;
      scorePct: number;
      passed: boolean;
      passingScore: number;
      showCorrectAnswers: boolean;
      results: QuizQuestionResult[];
    }
  | { ok: false; error: string };

function arr(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export async function submitQuiz(input: unknown): Promise<QuizSubmitResult> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };
  const { quizId, answers } = parsed.data;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      passingScore: true,
      allowRetake: true,
      showCorrectAnswers: true,
      chapter: { select: { course: { select: { productId: true } } } },
      questions: {
        select: {
          id: true,
          type: true,
          options: { select: { id: true, text: true, isCorrect: true } },
        },
      },
    },
  });
  if (!quiz) return { ok: false, error: "Quiz not found." };

  // Ownership: must hold a live entitlement on the parent course product.
  const owns = await prisma.entitlement.findFirst({
    where: {
      userId: user.id,
      productId: quiz.chapter.course.productId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!owns) return { ok: false, error: "You don't have access to this quiz." };

  if (!quiz.allowRetake) {
    const prior = await prisma.quizAttempt.findFirst({
      where: { userId: user.id, quizId },
      select: { id: true },
    });
    if (prior) {
      return { ok: false, error: "This quiz can only be attempted once." };
    }
  }

  const results: QuizQuestionResult[] = [];
  let correctCount = 0;

  for (const q of quiz.questions) {
    const correctOptionIds = q.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);
    let correct = false;

    if (q.type === "SHORT_ANSWER") {
      const submitted = arr(answers[q.id])[0]?.trim().toLowerCase() ?? "";
      const accepted = q.options
        .filter((o) => o.isCorrect)
        .map((o) => o.text.trim().toLowerCase());
      correct = submitted.length > 0 && accepted.includes(submitted);
    } else if (q.type === "MULTIPLE_CHOICE_MULTI") {
      const selected = new Set(arr(answers[q.id]));
      correct =
        selected.size === correctOptionIds.length &&
        correctOptionIds.every((id) => selected.has(id));
    } else {
      // MULTIPLE_CHOICE_SINGLE | TRUE_FALSE
      const selected = arr(answers[q.id]);
      correct =
        selected.length === 1 && correctOptionIds.includes(selected[0]);
    }

    if (correct) correctCount++;
    results.push({
      questionId: q.id,
      correct,
      correctOptionIds: quiz.showCorrectAnswers ? correctOptionIds : undefined,
    });
  }

  const total = quiz.questions.length || 1;
  const scorePct = Math.round((correctCount / total) * 100);
  const passed = scorePct >= quiz.passingScore;

  await prisma.quizAttempt.create({
    data: {
      userId: user.id,
      quizId,
      scorePct,
      passed,
      answers: answers as object,
    },
  });

  return {
    ok: true,
    scorePct,
    passed,
    passingScore: quiz.passingScore,
    showCorrectAnswers: quiz.showCorrectAnswers,
    results,
  };
}
