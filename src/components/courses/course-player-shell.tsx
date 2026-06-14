"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { LessonPlayer } from "./lesson-player";
import { QuizRunner, type QuizForRunner } from "./quiz-runner";
import { formatDuration } from "@/lib/video/youtube";

/*
 * The LMS player. A two-pane layout: a curriculum rail (chapters → lessons +
 * quizzes, each showing completion) and the active surface (video or quiz).
 *
 * Completion is driven by the LessonPlayer (≥95% watched) and QuizRunner (pass)
 * callbacks, kept in local state so checkmarks and the progress bar update live
 * without a round-trip. A quiz marked requiredToContinue locks everything after
 * it until passed, the gate the course author set in the builder.
 */

type Lesson = {
  id: string;
  title: string;
  youtubeVideoId: string | null;
  durationSeconds: number | null;
};
type Quiz = QuizForRunner & { requiredToContinue: boolean };
type Chapter = { id: string; title: string; lessons: Lesson[]; quizzes: Quiz[] };

type LessonProgress = {
  completed: boolean;
  lastPositionSeconds: number;
  maxPositionSeconds: number;
};

type Item =
  | { key: string; kind: "lesson"; chapterIndex: number; lesson: Lesson }
  | { key: string; kind: "quiz"; chapterIndex: number; quiz: Quiz };

export function CoursePlayerShell({
  courseTitle,
  slug,
  chapters,
  progressByLesson,
  passedQuizIds,
}: {
  courseTitle: string;
  slug: string;
  chapters: Chapter[];
  progressByLesson: Record<string, LessonProgress>;
  passedQuizIds: string[];
}) {
  // Flatten to an ordered playlist: each chapter's lessons then its quizzes.
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    chapters.forEach((c, ci) => {
      c.lessons.forEach((l) =>
        out.push({ key: `l:${l.id}`, kind: "lesson", chapterIndex: ci, lesson: l }),
      );
      c.quizzes.forEach((q) =>
        out.push({ key: `q:${q.id}`, kind: "quiz", chapterIndex: ci, quiz: q }),
      );
    });
    return out;
  }, [chapters]);

  const totalLessons = useMemo(
    () => chapters.reduce((n, c) => n + c.lessons.length, 0),
    [chapters],
  );

  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    () =>
      new Set(
        Object.entries(progressByLesson)
          .filter(([, p]) => p.completed)
          .map(([id]) => id),
      ),
  );
  const [passedQuizzes, setPassedQuizzes] = useState<Set<string>>(
    () => new Set(passedQuizIds),
  );

  // First incomplete item, else the first item.
  const initialIndex = useMemo(() => {
    const idx = items.findIndex((it) =>
      it.kind === "lesson"
        ? !progressByLesson[it.lesson.id]?.completed
        : !passedQuizIds.includes(it.quiz.id),
    );
    return idx === -1 ? 0 : idx;
  }, [items, progressByLesson, passedQuizIds]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // An item is locked if a *preceding* requiredToContinue quiz isn't passed.
  const lockedFrom = useMemo(() => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "quiz" && it.quiz.requiredToContinue && !passedQuizzes.has(it.quiz.id)) {
        return i + 1; // everything after this gate is locked
      }
    }
    return items.length;
  }, [items, passedQuizzes]);

  const onLessonCompleted = useCallback((lessonId: string) => {
    setCompletedLessons((prev) => {
      if (prev.has(lessonId)) return prev;
      const next = new Set(prev);
      next.add(lessonId);
      return next;
    });
  }, []);

  const onQuizPassed = useCallback((quizId: string) => {
    setPassedQuizzes((prev) => {
      if (prev.has(quizId)) return prev;
      const next = new Set(prev);
      next.add(quizId);
      return next;
    });
  }, []);

  const active = items[activeIndex];
  const percent =
    totalLessons === 0
      ? 0
      : Math.round((completedLessons.size / totalLessons) * 100);
  const hasNext = activeIndex < items.length - 1 && activeIndex + 1 < lockedFrom;

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[20rem_1fr]">
      {/* Curriculum rail */}
      <aside className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="border-b border-border px-5 py-4">
          <Link
            href={`/courses/${slug}`}
            className="mono-label transition-colors hover:text-foreground"
          >
            ← Course overview
          </Link>
          <h1 className="mt-2 text-balance font-semibold leading-tight tracking-tight">
            {courseTitle}
          </h1>
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-[0.625rem] text-muted-foreground">
              <span>PROGRESS</span>
              <span className="text-primary">{percent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="max-h-[60vh] overflow-y-auto lg:max-h-none">
          {chapters.map((c, ci) => (
            <div key={c.id} className="border-b border-border/60 last:border-0">
              <div className="bg-muted/20 px-5 py-2.5">
                <span className="mono-label">
                  {String(ci + 1).padStart(2, "0")} · {c.title}
                </span>
              </div>
              <ul>
                {c.lessons.map((l) => {
                  const idx = items.findIndex((it) => it.key === `l:${l.id}`);
                  const done = completedLessons.has(l.id);
                  const locked = idx >= lockedFrom;
                  return (
                    <RailRow
                      key={l.id}
                      active={idx === activeIndex}
                      done={done}
                      locked={locked}
                      label={l.title}
                      meta={formatDuration(l.durationSeconds)}
                      kind="lesson"
                      onClick={() => !locked && setActiveIndex(idx)}
                    />
                  );
                })}
                {c.quizzes.map((q) => {
                  const idx = items.findIndex((it) => it.key === `q:${q.id}`);
                  const done = passedQuizzes.has(q.id);
                  const locked = idx >= lockedFrom;
                  return (
                    <RailRow
                      key={q.id}
                      active={idx === activeIndex}
                      done={done}
                      locked={locked}
                      label={q.title}
                      meta={q.requiredToContinue ? "required" : "quiz"}
                      kind="quiz"
                      onClick={() => !locked && setActiveIndex(idx)}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Active surface */}
      <section className="px-5 py-6 md:px-8">
        {active?.kind === "lesson" ? (
          <div>
            <span className="mono-label">
              Chapter {active.chapterIndex + 1}
            </span>
            <h2 className="mb-4 mt-1 text-xl font-semibold tracking-tight">
              {active.lesson.title}
            </h2>
            <LessonPlayer
              key={active.lesson.id}
              lessonId={active.lesson.id}
              videoId={active.lesson.youtubeVideoId}
              durationSeconds={active.lesson.durationSeconds}
              startSeconds={
                progressByLesson[active.lesson.id]?.lastPositionSeconds ?? 0
              }
              onCompleted={onLessonCompleted}
            />
            <div className="mt-4 flex items-center gap-3">
              {completedLessons.has(active.lesson.id) ? (
                <span className="mono-label not-italic text-primary">
                  ✓ Completed
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Watch to ~95% to complete this lesson.
                </span>
              )}
              {hasNext ? (
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => i + 1)}
                  className="ml-auto inline-flex h-10 items-center rounded-md border border-border px-5 text-sm transition hover:bg-muted/40"
                >
                  Next →
                </button>
              ) : null}
            </div>
          </div>
        ) : active?.kind === "quiz" ? (
          <div className="mx-auto max-w-2xl">
            <QuizRunner
              key={active.quiz.id}
              quiz={active.quiz}
              initialPassed={passedQuizzes.has(active.quiz.id)}
              onPassed={onQuizPassed}
            />
            {hasNext ? (
              <div className="mt-4 flex">
                <button
                  type="button"
                  onClick={() => setActiveIndex((i) => i + 1)}
                  disabled={activeIndex + 1 >= lockedFrom}
                  className="ml-auto inline-flex h-10 items-center rounded-md border border-border px-5 text-sm transition hover:bg-muted/40 disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            This course has no content yet.
          </p>
        )}
      </section>
    </div>
  );
}

function RailRow({
  active,
  done,
  locked,
  label,
  meta,
  kind,
  onClick,
}: {
  active: boolean;
  done: boolean;
  locked: boolean;
  label: string;
  meta: string;
  kind: "lesson" | "quiz";
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={locked}
        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition ${
          active
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.5rem] ${
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border"
          }`}
        >
          {done ? "✓" : locked ? "🔒" : kind === "quiz" ? "?" : ""}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <span className="font-mono text-[0.625rem] text-muted-foreground/70">
          {meta}
        </span>
      </button>
    </li>
  );
}
