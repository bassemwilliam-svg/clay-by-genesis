"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * A draggable before/after wipe. Caller passes any two layers, the brand uses
 * it to wipe between the procedural "clay" blueprint (the schematic) and the
 * finished, shipped render of the same environment, the literal "start with
 * clay, ship a world" promise made interactive.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Clay",
  afterLabel = "Shipped",
  className,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) setFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={containerRef}
      className={`relative cursor-ew-resize select-none overflow-hidden ${className ?? ""}`}
      onPointerDown={(e) => {
        draggingRef.current = true;
        setFromClientX(e.clientX);
      }}
    >
      {/* After (finished render) sits underneath, full width. */}
      <div className="absolute inset-0">{after}</div>
      <span className="mono-label pointer-events-none absolute right-3 top-3 z-10 border border-border bg-background/70 px-2 py-0.5 text-[0.5625rem] backdrop-blur">
        {afterLabel}
      </span>

      {/* Before (clay blueprint) clipped from the left to the handle. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {before}
      </div>
      <span className="mono-label pointer-events-none absolute left-3 top-3 z-10 border border-primary/40 bg-background/70 px-2 py-0.5 text-[0.5625rem] text-primary backdrop-blur">
        {beforeLabel}
      </span>

      {/* Divider + handle. */}
      <div
        className="absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-primary"
        style={{ left: `${pos}%` }}
      >
        <button
          type="button"
          role="slider"
          aria-label="Reveal the clay blueprint and the finished render"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-orientation="horizontal"
          onPointerDown={(e) => {
            e.stopPropagation();
            draggingRef.current = true;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setPos((p) => Math.max(0, p - 4));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setPos((p) => Math.min(100, p + 4));
            }
          }}
          className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-background text-primary shadow-lg shadow-primary/20 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
