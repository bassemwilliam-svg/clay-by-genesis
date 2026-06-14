import { env } from "@/lib/env";

/*
 * YouTube helpers for the LMS.
 *
 * Course video uses *unlisted* YouTube (the Udacity model, see the plan's
 * "Course Video" section). Playback happens only inside the auth-gated,
 * entitlement-checked player via the IFrame Player API; the raw watch URL is
 * never surfaced in the UI. Completion is tracked client-side by polling the
 * player's current time against its duration.
 *
 * The IFrame Player API itself needs no key. The Data API (used here only to
 * fetch a video's duration at lesson-creation time) needs YOUTUBE_DATA_API_KEY;
 * when it's unset we degrade gracefully and rely on the manually entered
 * duration instead.
 */

/** Fraction of a video that must be watched before a lesson auto-completes. */
export const COMPLETION_THRESHOLD = 0.95;

/**
 * Privacy-enhanced embed origin. Using youtube-nocookie keeps the player from
 * dropping tracking cookies until the viewer actually plays.
 */
export function youtubeEmbedSrc(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** mm:ss / h:mm:ss for lesson and course durations. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds < 0) return "-";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Coarser "1h 20m" / "45m" label for catalog cards. */
export function formatRuntime(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "-";
  const mins = Math.round(totalSeconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Parses an ISO-8601 duration (e.g. PT1H2M10S) into whole seconds. */
function parseIsoDuration(iso: string): number | null {
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return null;
  const [, h, m, s] = match;
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0);
}

/**
 * Fetches a video's duration via the YouTube Data API v3. Returns null when the
 * key is unset or the lookup fails, so callers fall back to a manual value.
 */
export async function fetchYoutubeDurationSeconds(
  videoId: string,
): Promise<number | null> {
  if (!env.YOUTUBE_DATA_API_KEY) return null;
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", env.YOUTUBE_DATA_API_KEY);
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { contentDetails?: { duration?: string } }[];
    };
    const iso = data.items?.[0]?.contentDetails?.duration;
    return iso ? parseIsoDuration(iso) : null;
  } catch {
    return null;
  }
}
