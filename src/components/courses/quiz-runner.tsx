"use client";

import { useState, useTransition } from "react";
import { submitQuiz, type QuizSubmitResult } from "@/lib/courses/actions";

/*
 * Quiz engine, renders all four question types and submits to the server,
 * which is the only place grading happens (correctness never reaches the
 * client). Honors passingScore, allowRetake, showCorrectAnswers, and reports a
 * pass up to the player so a requiredToContinue quiz can unlock what follows.
 */

type Option = { id: string; text: string };
export type QuizQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: Option[];
};
export type QuizForRunner = {
  id: string;
  title: string;
  passingScore: number;
  allowRetake: boolean;
  showCorrectAnswers: boolean;
  questions: QuizQuestion[];
};

type AnswerMap = Record<string, string | string[]>;

export function QuizRunner({
  quiz,
  initialPassed,
  onPassed,
}: {
  quiz: QuizForRunner;
  initialPassed?: boolean;
  onPassed?: (quizId: string) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const setSingle = (qid: string, oid: string) =>
    setAnswers((a) => ({ ...a, [qid]: oid }));
  const toggleMulti = (qid: string, oid: string) =>
    setAnswers((a) => {
      const cur = new Set(Array.isArray(a[qid]) ? (a[qid] as string[]) : []);
      if (cur.has(oid)) cur.delete(oid);
      else cur.add(oid);
      return { ...a, [qid]: [...cur] };
    });
  const setText = (qid: string, text: string) =>
    setAnswers((a) => ({ ...a, [qid]: text }));

  const submit = () => {
    startTransition(async () => {
      const res = await submitQuiz({ quizId: quiz.id, answers });
      setResult(res);
      if (res.ok && res.passed) onPassed?.(quiz.id);
    });
  };

  const resultByQuestion = new Map(
    result?.ok ? result.results.map((r) => [r.questionId, r]) : [],
  );
  const graded = result?.ok === true;

  return (
    <div className="border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <span className="mono-label">Chapter quiz</span>
          <h3 className="mt-1 font-semibold tracking-tight">{quiz.title}</h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          PASS ≥ {quiz.passingScore}%
        </span>
      </div>

      {graded && result.ok ? (
        <div
          className={`flex flex-wrap items-center gap-3 border-b px-5 py-4 ${
            result.passed
              ? "border-primary/30 bg-primary/10"
              : "border-border bg-muted/30"
          }`}
        >
          <span className="text-2xl font-semibold tracking-tight">
            {result.scorePct}%
          </span>
          <span
            className={`mono-label not-italic ${
              result.passed ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {result.passed ? "Passed" : "Not passed"}
          </span>
          {quiz.allowRetake && !result.passed ? (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="ml-auto inline-flex h-9 items-center rounded-md border border-border px-4 text-sm transition hover:bg-muted/40"
            >
              Retake
            </button>
          ) : null}
        </div>
      ) : null}

      <ol className="divide-y divide-border/60">
        {quiz.questions.map((q, qi) => {
          const r = resultByQuestion.get(q.id);
          const correctSet = new Set(r?.correctOptionIds ?? []);
          return (
            <li key={q.id} className="px-5 py-4">
              <div className="flex gap-2">
                <span className="font-mono text-xs text-primary/60">
                  {String(qi + 1).padStart(2, "0")}
                </span>
                <p className="font-medium">{q.prompt}</p>
                {graded && r ? (
                  <span
                    className={`ml-auto mono-label not-italic ${
                      r.correct ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {r.correct ? "✓" : "✗"}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2 pl-6">
                {q.type === "SHORT_ANSWER" ? (
                  <input
                    type="text"
                    disabled={graded}
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setText(q.id, e.target.value)}
                    placeholder="Type your answer"
                    className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                  />
                ) : (
                  q.options.map((o) => {
                    const multi = q.type === "MULTIPLE_CHOICE_MULTI";
                    const selected = multi
                      ? Array.isArray(answers[q.id]) &&
                        (answers[q.id] as string[]).includes(o.id)
                      : answers[q.id] === o.id;
                    const showCorrect = graded && correctSet.has(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                          showCorrect
                            ? "border-primary/50 bg-primary/10"
                            : selected
                              ? "border-primary/40 bg-primary/5"
                              : "border-border hover:bg-muted/40"
                        } ${graded ? "cursor-default" : ""}`}
                      >
                        <input
                          type={multi ? "checkbox" : "radio"}
                          name={q.id}
                          disabled={graded}
                          checked={Boolean(selected)}
                          onChange={() =>
                            multi
                              ? toggleMulti(q.id, o.id)
                              : setSingle(q.id, o.id)
                          }
                          className="accent-primary"
                        />
                        <span>{o.text}</span>
                        {showCorrect ? (
                          <span className="ml-auto font-mono text-[0.625rem] text-primary">
                            CORRECT
                          </span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!graded || (result.ok && !result.passed && !quiz.allowRetake) ? (
        <div className="border-t border-border px-5 py-4">
          {!result?.ok && result?.error ? (
            <p className="mb-3 text-sm text-destructive">{result.error}</p>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={pending || graded}
            className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Grading…" : "Submit quiz"}
          </button>
        </div>
      ) : null}

      {initialPassed && !graded ? (
        <div className="border-t border-border px-5 py-3 text-sm text-primary">
          You&apos;ve already passed this quiz.
        </div>
      ) : null}
    </div>
  );
}
