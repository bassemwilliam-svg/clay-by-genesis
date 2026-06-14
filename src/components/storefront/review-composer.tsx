"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  submitReview,
  deleteReview,
  loadMyReview,
  type MyReviewState,
} from "@/lib/reviews/actions";

/*
 * Personalized review island. The product page is statically rendered (ISR), so
 * the "can this viewer review, and what have they written" question is resolved
 * here at request time: we call loadMyReview() on mount and branch on the
 * result. Owners get an editable form; everyone else gets the relevant nudge.
 *
 * Submission goes through a transition (not useActionState) so state updates
 * happen in the event handler rather than synchronously inside an effect. On a
 * successful write we update local state and call router.refresh() so the
 * server-rendered list/average above re-fetches.
 */

function StarButton({
  index,
  active,
  onSelect,
  onHover,
}: {
  index: number;
  active: boolean;
  onSelect: (v: number) => void;
  onHover: (v: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      onMouseEnter={() => onHover(index)}
      onFocus={() => onHover(index)}
      aria-label={`${index} star${index === 1 ? "" : "s"}`}
      className="p-0.5 transition-transform hover:scale-110"
    >
      <svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={active ? "text-primary" : "text-border"}
      >
        <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 18.4l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95z" />
      </svg>
    </button>
  );
}

export function ReviewComposer({ productId }: { productId: string }) {
  const router = useRouter();
  const [my, setMy] = useState<MyReviewState | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();
  const [removing, startRemove] = useTransition();

  // Resolve the viewer's review state once on mount (async — not a sync setState).
  useEffect(() => {
    let active = true;
    loadMyReview(productId).then((s) => {
      if (!active) return;
      setMy(s);
      setRating(s.review?.rating ?? 0);
      setBody(s.review?.body ?? "");
    });
    return () => {
      active = false;
    };
  }, [productId]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("body", body);
    startSubmit(async () => {
      const result = await submitReview(productId, { ok: false }, formData);
      if (result.ok) {
        setMy((prev) =>
          prev ? { ...prev, review: result.review ?? null } : prev,
        );
        router.refresh();
      } else {
        setError(result.error ?? "That review wasn't saved.");
      }
    });
  };

  const onRemove = () => {
    setError(null);
    startRemove(async () => {
      const result = await deleteReview(productId);
      if (result.ok) {
        setMy((prev) => (prev ? { ...prev, review: null } : prev));
        setRating(0);
        setBody("");
        router.refresh();
      } else {
        setError(result.error ?? "Couldn't remove your review.");
      }
    });
  };

  if (my === null) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">Loading your review…</p>
    );
  }

  if (!my.authed) {
    return (
      <div className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        to leave a review. Reviews are open to verified owners.
      </div>
    );
  }

  if (!my.canReview) {
    return (
      <div className="mt-4 border border-dashed border-border p-4 text-sm text-muted-foreground">
        Reviews are open to verified owners. Add this to your library to share
        how it worked for you.
      </div>
    );
  }

  const editing = my.review !== null;
  const shown = hover || rating;

  return (
    <form onSubmit={onSubmit} className="mt-4 border border-border p-4">
      <span className="mono-label">
        {editing ? "Edit your review" : "Write a review"}
      </span>

      <div
        className="mt-3 flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <StarButton
            key={i}
            index={i}
            active={i <= shown}
            onSelect={setRating}
            onHover={setHover}
          />
        ))}
        <span className="ml-2 font-mono text-sm text-muted-foreground">
          {rating > 0 ? `${rating}/5` : "Tap to rate"}
        </span>
      </div>

      <textarea
        name="body"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you build with it? How was the topology, the textures, the fit in your engine?"
        maxLength={2000}
        className="mt-3 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || rating === 0}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : editing ? "Update review" : "Submit review"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="text-sm text-muted-foreground transition hover:text-destructive disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
