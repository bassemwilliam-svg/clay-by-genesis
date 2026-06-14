"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ensureCourse,
  updateCourseDetails,
  addChapter,
  deleteChapter,
  addLesson,
  deleteLesson,
  addQuiz,
  deleteQuiz,
  addQuestion,
  deleteQuestion,
} from "@/lib/courses/admin-actions";
import type { CourseBuilderData } from "@/lib/courses/admin";
import { formatDuration } from "@/lib/video/youtube";

/*
 * Course builder (client). Mirrors the curriculum tree, chapters → lessons +
 * quizzes → questions → options, and wires each node to its server action.
 * After every mutation we router.refresh() so the server-rendered tree reflects
 * the new state. Answer correctness is editable here (and only here); the player
 * never receives it.
 */

type ActionResult = { ok: true } | { ok: false; error: string };
type Course = NonNullable<CourseBuilderData["course"]>;
type Chapter = Course["chapters"][number];
type Quiz = Chapter["quizzes"][number];

const inputCls =
  "w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";
const textareaCls = `${inputCls} min-h-[5rem] resize-y leading-relaxed`;
const btnPrimary =
  "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60";
const btnGhost =
  "inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm transition hover:bg-muted/40 disabled:opacity-60";

const LEVEL_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All levels" },
] as const;

/** A labelled field wrapper so the details form stays consistent. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="mono-label">{label}</span>
      {children}
      {hint ? (
        <span className="block font-mono text-[0.625rem] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE_SINGLE", label: "Multiple choice (single)" },
  { value: "MULTIPLE_CHOICE_MULTI", label: "Multiple choice (multiple)" },
  { value: "TRUE_FALSE", label: "True / False" },
  { value: "SHORT_ANSWER", label: "Short answer" },
] as const;

const TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: "single",
  MULTIPLE_CHOICE_MULTI: "multi",
  TRUE_FALSE: "true/false",
  SHORT_ANSWER: "short answer",
};

/** Shared runner: run an action in a transition, surface errors, then refresh. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  };
  return { run, pending, error };
}

export function CourseBuilder({ data }: { data: CourseBuilderData }) {
  if (!data.course) return <InitPanel productId={data.id} />;
  return (
    <div className="space-y-8">
      <CourseDetailsForm productId={data.id} course={data.course} />
      <div>
        <div className="mb-4 flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary/60">02</span>
          <h2 className="text-lg font-medium tracking-tight">Curriculum</h2>
        </div>
        <ChapterList productId={data.id} course={data.course} />
      </div>
    </div>
  );
}

/** Build the YYYY-MM-DD value a date input expects from a stored Date. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Course-level syllabus metadata (level, instructor, prerequisites, software,
 * outcomes, expected ROI). These power the public course page. Multi-value
 * fields are edited as plain text (comma list for software, one-per-line for
 * outcomes) and parsed server-side.
 */
function CourseDetailsForm({
  productId,
  course,
}: {
  productId: string;
  course: Course;
}) {
  const { run, pending, error } = useRun();
  const [saved, setSaved] = useState(false);

  const [summary, setSummary] = useState(course.summary ?? "");
  const [level, setLevel] = useState<string>(course.level ?? "");
  const [estimatedTime, setEstimatedTime] = useState(course.estimatedTime ?? "");
  const [releaseDate, setReleaseDate] = useState(toDateInput(course.releaseDate));
  const [prerequisites, setPrerequisites] = useState(course.prerequisites ?? "");
  const [instructor, setInstructor] = useState(course.instructor ?? "");
  const [instructorTitle, setInstructorTitle] = useState(
    course.instructorTitle ?? "",
  );
  const [software, setSoftware] = useState((course.software ?? []).join(", "));
  const [outcomes, setOutcomes] = useState((course.outcomes ?? []).join("\n"));
  const [expectedRoi, setExpectedRoi] = useState(course.expectedRoi ?? "");

  const save = () =>
    run(
      () =>
        updateCourseDetails({
          productId,
          courseId: course.id,
          summary,
          level,
          estimatedTime,
          releaseDate,
          prerequisites,
          instructor,
          instructorTitle,
          software,
          outcomes,
          expectedRoi,
        }),
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      },
    );

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary/60">01</span>
        <h2 className="text-lg font-medium tracking-tight">Syllabus details</h2>
        <span className="font-mono text-[0.625rem] text-muted-foreground">
          shown on the public course page
        </span>
      </div>

      <div className="space-y-4 border border-border bg-card/30 p-5">
        <Field label="Summary" hint="One or two sentences for the course header.">
          <textarea
            className={textareaCls}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What this course covers and who it is for."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Level">
            <select
              className={inputCls}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimated time" hint="Free text, e.g. 6 weeks, 5 hrs/week.">
            <input
              className={inputCls}
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="6 weeks · 5 hrs/week"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instructor">
            <input
              className={inputCls}
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Full name"
            />
          </Field>
          <Field label="Instructor title">
            <input
              className={inputCls}
              value={instructorTitle}
              onChange={(e) => setInstructorTitle(e.target.value)}
              placeholder="Senior Environment Artist"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Release date">
            <input
              type="date"
              className={inputCls}
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
            />
          </Field>
          <Field
            label="Used software"
            hint="Comma-separated, e.g. Houdini, Blender, Unreal."
          >
            <input
              className={inputCls}
              value={software}
              onChange={(e) => setSoftware(e.target.value)}
              placeholder="Houdini, Blender, Unreal Engine"
            />
          </Field>
        </div>

        <Field
          label="What you'll learn"
          hint="One outcome per line. Rendered as a checklist."
        >
          <textarea
            className={textareaCls}
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            placeholder={"Build a modular kit from scratch\nBake and optimise for real-time\nShip an engine-ready scene"}
          />
        </Field>

        <Field label="Prerequisites" hint="Free text. Leave blank if none.">
          <textarea
            className={textareaCls}
            value={prerequisites}
            onChange={(e) => setPrerequisites(e.target.value)}
            placeholder="Comfort with a 3D DCC. No procedural experience required."
          />
        </Field>

        <Field
          label="Expected ROI"
          hint="The payoff or career value of finishing the course."
        >
          <textarea
            className={textareaCls}
            value={expectedRoi}
            onChange={(e) => setExpectedRoi(e.target.value)}
            placeholder="Ship a portfolio-ready environment and a reusable pipeline."
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={btnPrimary}
          >
            {pending ? "Saving…" : "Save details"}
          </button>
          {saved ? (
            <span className="font-mono text-[0.625rem] text-primary">saved</span>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

function InitPanel({ productId }: { productId: string }) {
  const { run, pending, error } = useRun();
  return (
    <div className="border border-dashed border-border p-10 text-center">
      <p className="text-muted-foreground">
        This course product doesn&apos;t have a curriculum yet.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => ensureCourse(productId))}
        className={`${btnPrimary} mt-4`}
      >
        {pending ? "Creating…" : "Initialize curriculum"}
      </button>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ChapterList({
  productId,
  course,
}: {
  productId: string;
  course: Course;
}) {
  return (
    <div className="space-y-5">
      {course.chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No chapters yet. Add the first one below.
        </p>
      ) : (
        course.chapters.map((chapter, i) => (
          <ChapterBlock
            key={chapter.id}
            index={i}
            productId={productId}
            chapter={chapter}
          />
        ))
      )}
      <AddChapterForm productId={productId} courseId={course.id} />
    </div>
  );
}

function AddChapterForm({
  productId,
  courseId,
}: {
  productId: string;
  courseId: string;
}) {
  const { run, pending, error } = useRun();
  const [title, setTitle] = useState("");
  return (
    <div className="border border-dashed border-border p-4">
      <span className="mono-label">New chapter</span>
      <div className="mt-2 flex gap-2">
        <input
          className={inputCls}
          placeholder="Chapter title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() =>
            run(
              () => addChapter({ productId, courseId, title: title.trim() }),
              () => setTitle(""),
            )
          }
          className={btnPrimary}
        >
          {pending ? "Adding…" : "Add chapter"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ChapterBlock({
  index,
  productId,
  chapter,
}: {
  index: number;
  productId: string;
  chapter: Chapter;
}) {
  const { run, pending, error } = useRun();
  return (
    <div className="border border-border bg-card/30">
      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <span className="font-mono text-xs text-primary/60">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="font-medium tracking-tight">{chapter.title}</h3>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                `Delete chapter “${chapter.title}” and all its content?`,
              )
            )
              run(() => deleteChapter(productId, chapter.id));
          }}
          className="ml-auto font-mono text-[0.625rem] text-muted-foreground transition-colors hover:text-destructive"
        >
          DELETE
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Lessons */}
        <div>
          <span className="mono-label">Lessons</span>
          <ul className="mt-2 space-y-1">
            {chapter.lessons.length === 0 ? (
              <li className="text-sm text-muted-foreground">No lessons yet.</li>
            ) : (
              chapter.lessons.map((lesson, li) => (
                <li
                  key={lesson.id}
                  className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-[0.625rem] text-muted-foreground/60">
                    {String(li + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate">{lesson.title}</span>
                  {lesson.youtubeVideoId ? (
                    <span className="font-mono text-[0.625rem] text-primary/70">
                      ▶ {lesson.youtubeVideoId}
                    </span>
                  ) : (
                    <span className="font-mono text-[0.625rem] text-amber-600">
                      no video
                    </span>
                  )}
                  <span className="font-mono text-[0.625rem] text-muted-foreground">
                    {formatDuration(lesson.durationSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteLesson(productId, lesson.id))}
                    className="font-mono text-[0.625rem] text-muted-foreground transition-colors hover:text-destructive"
                  >
                    ✕
                  </button>
                </li>
              ))
            )}
          </ul>
          <AddLessonForm productId={productId} chapterId={chapter.id} />
        </div>

        {/* Quizzes */}
        <div>
          <span className="mono-label">Quizzes</span>
          <div className="mt-2 space-y-3">
            {chapter.quizzes.map((quiz) => (
              <QuizBlock key={quiz.id} productId={productId} quiz={quiz} />
            ))}
          </div>
          <AddQuizForm productId={productId} chapterId={chapter.id} />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function AddLessonForm({
  productId,
  chapterId,
}: {
  productId: string;
  chapterId: string;
}) {
  const { run, pending, error } = useRun();
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState("");
  const [duration, setDuration] = useState("");

  const reset = () => {
    setTitle("");
    setVideoId("");
    setDuration("");
  };

  return (
    <div className="mt-2 rounded-md border border-dashed border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_120px]">
        <input
          className={inputCls}
          placeholder="Lesson title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="YouTube video id"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Seconds"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() =>
            run(
              () =>
                addLesson({
                  productId,
                  chapterId,
                  title: title.trim(),
                  youtubeVideoId: videoId.trim() || undefined,
                  durationSeconds: duration.trim()
                    ? Number(duration)
                    : undefined,
                }),
              reset,
            )
          }
          className={btnGhost}
        >
          {pending ? "Adding…" : "+ Add lesson"}
        </button>
        <span className="font-mono text-[0.625rem] text-muted-foreground">
          unlisted id only · duration auto-fills if a Data API key is set
        </span>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function AddQuizForm({
  productId,
  chapterId,
}: {
  productId: string;
  chapterId: string;
}) {
  const { run, pending, error } = useRun();
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [required, setRequired] = useState(false);

  return (
    <div className="mt-3 rounded-md border border-dashed border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <input
          className={inputCls}
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Pass %"
          inputMode="numeric"
          value={passingScore}
          onChange={(e) => setPassingScore(e.target.value)}
        />
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="accent-primary"
        />
        Required to continue (locks later content until passed)
      </label>
      <div className="mt-2">
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() =>
            run(
              () =>
                addQuiz({
                  productId,
                  chapterId,
                  title: title.trim(),
                  passingScore: Number(passingScore) || 70,
                  requiredToContinue: required,
                }),
              () => {
                setTitle("");
                setPassingScore("70");
                setRequired(false);
              },
            )
          }
          className={btnGhost}
        >
          {pending ? "Adding…" : "+ Add quiz"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function QuizBlock({ productId, quiz }: { productId: string; quiz: Quiz }) {
  const { run, pending, error } = useRun();
  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary/40 font-mono text-[0.5rem] text-primary">
          ?
        </span>
        <span className="font-medium">{quiz.title}</span>
        <span className="font-mono text-[0.625rem] text-muted-foreground">
          pass ≥ {quiz.passingScore}%
        </span>
        {quiz.requiredToContinue ? (
          <span className="font-mono text-[0.625rem] text-primary">required</span>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete quiz “${quiz.title}”?`))
              run(() => deleteQuiz(productId, quiz.id));
          }}
          className="ml-auto font-mono text-[0.625rem] text-muted-foreground transition-colors hover:text-destructive"
        >
          DELETE
        </button>
      </div>

      <div className="space-y-2 p-3">
        {quiz.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions yet.</p>
        ) : (
          <ol className="space-y-2">
            {quiz.questions.map((q, qi) => (
              <li
                key={q.id}
                className="rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[0.625rem] text-primary/60">
                    {String(qi + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{q.prompt}</span>
                  <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                    {TYPE_BADGE[q.type] ?? q.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteQuestion(productId, q.id))}
                    className="font-mono text-[0.625rem] text-muted-foreground transition-colors hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
                <ul className="mt-1.5 space-y-0.5 pl-6">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={`font-mono text-[0.6875rem] ${
                        o.isCorrect
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {o.isCorrect ? "✓" : "·"} {o.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        <AddQuestionForm productId={productId} quizId={quiz.id} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

type OptionRow = { text: string; correct: boolean };

function AddQuestionForm({
  productId,
  quizId,
}: {
  productId: string;
  quizId: string;
}) {
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const [type, setType] =
    useState<(typeof QUESTION_TYPES)[number]["value"]>("MULTIPLE_CHOICE_SINGLE");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([
    { text: "", correct: true },
    { text: "", correct: false },
  ]);
  const [tfCorrect, setTfCorrect] = useState<"True" | "False">("True");
  const [answers, setAnswers] = useState<string[]>([""]);

  const reset = () => {
    setPrompt("");
    setOptions([
      { text: "", correct: true },
      { text: "", correct: false },
    ]);
    setTfCorrect("True");
    setAnswers([""]);
  };

  const isMulti = type === "MULTIPLE_CHOICE_MULTI";
  const isChoice = type === "MULTIPLE_CHOICE_SINGLE" || isMulti;

  const setCorrect = (idx: number) => {
    setOptions((prev) =>
      prev.map((o, i) =>
        isMulti
          ? i === idx
            ? { ...o, correct: !o.correct }
            : o
          : { ...o, correct: i === idx },
      ),
    );
  };

  const buildOptions = (): { text: string; isCorrect: boolean }[] => {
    if (type === "TRUE_FALSE") {
      return [
        { text: "True", isCorrect: tfCorrect === "True" },
        { text: "False", isCorrect: tfCorrect === "False" },
      ];
    }
    if (type === "SHORT_ANSWER") {
      return answers
        .map((a) => a.trim())
        .filter(Boolean)
        .map((text) => ({ text, isCorrect: true }));
    }
    return options
      .map((o) => ({ text: o.text.trim(), isCorrect: o.correct }))
      .filter((o) => o.text.length > 0);
  };

  const submit = () =>
    run(
      () =>
        addQuestion({
          productId,
          quizId,
          type,
          prompt: prompt.trim(),
          options: buildOptions(),
        }),
      () => {
        reset();
        setOpen(false);
      },
    );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[0.6875rem] text-primary transition-colors hover:underline"
      >
        + Add question
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <input
          className={inputCls}
          placeholder="Question prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <select
          className={inputCls}
          value={type}
          onChange={(e) =>
            setType(e.target.value as (typeof QUESTION_TYPES)[number]["value"])
          }
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Options editor, adapts to the question type. */}
      <div className="mt-3 space-y-2">
        {type === "TRUE_FALSE" ? (
          <div className="flex gap-4 text-sm">
            {(["True", "False"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${quizId}`}
                  checked={tfCorrect === v}
                  onChange={() => setTfCorrect(v)}
                  className="accent-primary"
                />
                {v}
              </label>
            ))}
            <span className="font-mono text-[0.625rem] text-muted-foreground">
              select the correct answer
            </span>
          </div>
        ) : type === "SHORT_ANSWER" ? (
          <div className="space-y-2">
            <span className="font-mono text-[0.625rem] text-muted-foreground">
              accepted answers (case-insensitive)
            </span>
            {answers.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder={`Accepted answer ${i + 1}`}
                  value={a}
                  onChange={(e) =>
                    setAnswers((prev) =>
                      prev.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
                {answers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => prev.filter((_, j) => j !== i))
                    }
                    className={btnGhost}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAnswers((prev) => [...prev, ""])}
              className="font-mono text-[0.625rem] text-primary hover:underline"
            >
              + accepted answer
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="font-mono text-[0.625rem] text-muted-foreground">
              {isMulti
                ? "check all correct answers"
                : "select the one correct answer"}
            </span>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={`opt-${quizId}`}
                  checked={o.correct}
                  onChange={() => setCorrect(i)}
                  className="accent-primary"
                  aria-label="correct"
                />
                <input
                  className={inputCls}
                  placeholder={`Option ${i + 1}`}
                  value={o.text}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
                {options.length > 2 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, j) => j !== i))
                    }
                    className={btnGhost}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            {isChoice ? (
              <button
                type="button"
                onClick={() =>
                  setOptions((prev) => [...prev, { text: "", correct: false }])
                }
                className="font-mono text-[0.625rem] text-primary hover:underline"
              >
                + option
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !prompt.trim()}
          onClick={submit}
          className={btnPrimary}
        >
          {pending ? "Saving…" : "Save question"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className={btnGhost}
        >
          Cancel
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
