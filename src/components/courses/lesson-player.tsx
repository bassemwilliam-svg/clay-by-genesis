"use client";

import { useEffect, useRef } from "react";

/*
 * The course video surface. Embeds the (unlisted) lesson via the YouTube IFrame
 * Player API and reports watch progress to /api/lessons/progress so the lesson
 * auto-completes near the end. The raw watch URL is never rendered, only the
 * sandboxed nocookie embed. When a lesson has no video yet, a placeholder shows
 * instead of a broken player.
 */

// ── Minimal typings for the YT IFrame API (it ships no types) ──────────────
type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTPlayerEvent = { target: YTPlayer; data: number };
type YTNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Single shared loader so multiple players don't inject the script twice.
let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const REPORT_EVERY_MS = 10_000;

export function LessonPlayer({
  lessonId,
  videoId,
  durationSeconds,
  startSeconds = 0,
  onCompleted,
}: {
  lessonId: string;
  videoId: string | null;
  durationSeconds: number | null;
  startSeconds?: number;
  onCompleted?: (lessonId: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastReportRef = useRef(0);
  const reportedCompleteRef = useRef(false);

  useEffect(() => {
    if (!videoId || !mountRef.current) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    reportedCompleteRef.current = false;
    lastReportRef.current = 0;

    const report = async (force: boolean) => {
      const player = playerRef.current;
      if (!player) return;
      const position = player.getCurrentTime?.() ?? 0;
      const duration = player.getDuration?.() || durationSeconds || 0;
      const now = Date.now();
      if (!force && now - lastReportRef.current < REPORT_EVERY_MS) return;
      lastReportRef.current = now;
      try {
        const res = await fetch("/api/lessons/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lessonId,
            positionSeconds: position,
            watchedSeconds: position,
            durationSeconds: duration,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { completed: boolean };
          if (data.completed && !reportedCompleteRef.current) {
            reportedCompleteRef.current = true;
            onCompleted?.(lessonId);
          }
        }
      } catch {
        /* best-effort; the next tick retries */
      }
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          start: Math.max(0, Math.floor(startSeconds)),
        },
        events: {
          onStateChange: (e) => {
            if (
              e.data === YT.PlayerState.PAUSED ||
              e.data === YT.PlayerState.ENDED
            ) {
              void report(true);
            }
            if (e.data === YT.PlayerState.PLAYING && !interval) {
              interval = setInterval(() => void report(false), 5000);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      void report(true);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // Re-init when the lesson changes.
  }, [lessonId, videoId, durationSeconds, startSeconds, onCompleted]);

  if (!videoId) {
    return (
      <div className="bp-ticks flex aspect-video w-full items-center justify-center border border-border bg-card/40 text-center">
        <div className="px-6">
          <span className="mono-label">No video yet</span>
          <p className="mt-2 text-sm text-muted-foreground">
            This lesson&apos;s video hasn&apos;t been attached. Add an unlisted
            YouTube id in the course builder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden border border-border bg-black">
      {/* The API replaces this node with the player iframe. */}
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
