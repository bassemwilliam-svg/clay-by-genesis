"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HomeSlideView } from "@/lib/homepage/queries";

/*
 * Full-bleed homepage hero carousel. Rotating service backgrounds sit behind the
 * fixed hero copy (passed as children), replacing the old boxed render tile.
 * Slides are admin-managed (with built-in defaults). Auto-advances, pauses on
 * hover, and honours prefers-reduced-motion by not auto-rotating.
 */
export function HeroCarousel({
  slides,
  children,
}: {
  slides: HomeSlideView[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 6000);
    return () => window.clearInterval(id);
  }, [count, paused]);

  const active = slides[index] ?? slides[0];

  return (
    <section
      className="relative isolate overflow-hidden border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Rotating backgrounds. */}
      <div className="absolute inset-0 -z-10">
        {slides.map((s, i) => (
          <div
            key={s.id}
            aria-hidden={i !== index}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-out"
            style={{
              backgroundImage: `url(${s.imageUrl})`,
              opacity: i === index ? 1 : 0,
            }}
          />
        ))}
        {/* Legibility overlays: darken toward the copy side + bottom. */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        <div className="bp-grid absolute inset-0 opacity-30" />
      </div>

      <div className="mx-auto flex min-h-[78vh] w-full max-w-[1600px] flex-col justify-center px-6 py-20 md:px-10 md:py-28">
        <div className="max-w-2xl">{children}</div>

        {/* Slide caption + controls. */}
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-8 bg-primary"
                    : "w-3 bg-border hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
          {active ? (
            <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
              <span className="text-primary/80">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(count).padStart(2, "0")}
              </span>
              {active.ctaHref ? (
                <Link
                  href={active.ctaHref}
                  className="border-b border-transparent uppercase tracking-widest transition-colors hover:border-primary hover:text-foreground"
                >
                  {active.ctaLabel ?? active.title} →
                </Link>
              ) : (
                <span className="uppercase tracking-widest">{active.title}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
