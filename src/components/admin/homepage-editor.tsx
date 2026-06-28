"use client";

import { useActionState } from "react";
import {
  saveHomeVideo,
  addHomeSlide,
  removeHomeSlide,
  toggleHomeSlide,
  type HomeActionState,
} from "@/lib/homepage/actions";
import type { HomeVideo } from "@/lib/homepage/queries";

const HOME_ACTION_INITIAL: HomeActionState = { ok: false };

type SlideRow = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
  isActive: boolean;
};

const field =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm";
const label = "mono-label";

export function HomepageEditor({
  video,
  slides,
  usingDefaultSlides,
}: {
  video: HomeVideo;
  slides: SlideRow[];
  usingDefaultSlides: boolean;
}) {
  const [videoState, videoAction, videoPending] = useActionState<
    HomeActionState,
    FormData
  >(saveHomeVideo, HOME_ACTION_INITIAL);
  const [slideState, slideAction, slidePending] = useActionState<
    HomeActionState,
    FormData
  >(addHomeSlide, HOME_ACTION_INITIAL);

  return (
    <div className="space-y-12">
      {/* Video separator */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Video separator
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The full-width band above the featured courses. Paste an MP4 URL to
          play it as a looping background; leave it blank to show the poster
          image. Heading and subtext sit on top.
        </p>
        <form action={videoAction} className="mt-4 grid max-w-2xl gap-4">
          <label className="grid gap-1">
            <span className={label}>Video URL (MP4, optional)</span>
            <input
              name="url"
              defaultValue={video.url ?? ""}
              placeholder="https://… .mp4  or  /media/clay.mp4"
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>Poster / fallback image</span>
            <input
              name="poster"
              defaultValue={video.poster}
              placeholder="/landing/clay-shipped-after.jpg"
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>Heading</span>
            <input name="heading" defaultValue={video.heading} className={field} />
          </label>
          <label className="grid gap-1">
            <span className={label}>Subtext</span>
            <textarea
              name="subtext"
              defaultValue={video.subtext}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={videoPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {videoPending ? "Saving…" : "Save video band"}
            </button>
            {videoState.ok ? (
              <span className="text-sm text-primary">Saved.</span>
            ) : null}
            {videoState.error ? (
              <span role="alert" className="text-sm text-destructive">
                {videoState.error}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {/* Hero slides */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Hero carousel slides
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full-width rotating backgrounds behind the homepage headline.
          {usingDefaultSlides
            ? " No custom slides yet — the homepage is showing the built-in service slides. Add one below to take over."
            : ""}
        </p>

        <div className="mt-4 space-y-px overflow-hidden rounded-lg border border-border bg-border">
          {slides.length === 0 ? (
            <div className="bg-background px-4 py-8 text-center text-sm text-muted-foreground">
              No custom slides. Built-in defaults are live on the homepage.
            </div>
          ) : (
            slides.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 bg-background px-4 py-3"
              >
                <div
                  className="h-12 w-20 shrink-0 rounded border border-border bg-cover bg-center"
                  style={{ backgroundImage: `url(${s.imageUrl})` }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.title}{" "}
                    {!s.isActive ? (
                      <span className="ml-1 font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">
                        (hidden)
                      </span>
                    ) : null}
                  </p>
                  {s.subtitle ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {s.subtitle}
                    </p>
                  ) : null}
                  <p className="truncate font-mono text-[0.625rem] text-muted-foreground">
                    #{s.sortOrder} · {s.imageUrl}
                  </p>
                </div>
                <form action={toggleHomeSlide.bind(null, s.id, !s.isActive)}>
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {s.isActive ? "Hide" : "Show"}
                  </button>
                </form>
                <form action={removeHomeSlide.bind(null, s.id)}>
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground transition hover:text-destructive"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        {/* Add a slide */}
        <form
          action={slideAction}
          className="mt-5 grid max-w-2xl gap-4 border-t border-border pt-5"
        >
          <h3 className="text-sm font-medium">Add a slide</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className={label}>Title</span>
              <input name="title" required className={field} />
            </label>
            <label className="grid gap-1">
              <span className={label}>Sort order</span>
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={slides.length}
                className={field}
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className={label}>Background image URL</span>
            <input
              name="imageUrl"
              required
              placeholder="https://…  or  /landing/clay-family-game-asset.jpg"
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>Subtitle (optional)</span>
            <input name="subtitle" className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className={label}>CTA label (optional)</span>
              <input name="ctaLabel" placeholder="Explore kits" className={field} />
            </label>
            <label className="grid gap-1">
              <span className={label}>CTA link (optional)</span>
              <input
                name="ctaHref"
                placeholder="/browse?type=ENVIRONMENT_KIT"
                className={field}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={slidePending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {slidePending ? "Adding…" : "Add slide"}
            </button>
            {slideState.ok ? (
              <span className="text-sm text-primary">Added.</span>
            ) : null}
            {slideState.error ? (
              <span role="alert" className="text-sm text-destructive">
                {slideState.error}
              </span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
