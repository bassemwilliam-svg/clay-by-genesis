import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { COMPLETION_THRESHOLD } from "@/lib/video/youtube";

/*
 * Lesson watch-progress sink. The player posts the viewer's furthest position
 * and watched-seconds periodically; we persist them and flip `completed` once
 * the viewer crosses COMPLETION_THRESHOLD (~95%) of the video, which is what
 * gates the chapter quiz / next lesson. Node runtime (Prisma) and never cached.
 *
 * Access is re-checked here, not trusted from the client: the caller must hold
 * a live entitlement on the lesson's parent course product.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lessonId: z.string().min(1).max(64),
  positionSeconds: z.coerce.number().min(0).max(86400),
  watchedSeconds: z.coerce.number().min(0).max(86400).optional(),
  durationSeconds: z.coerce.number().min(0).max(86400).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { lessonId, positionSeconds } = parsed.data;

  // Resolve the lesson → course product, and confirm ownership.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      durationSeconds: true,
      chapter: { select: { course: { select: { productId: true } } } },
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const owns = await prisma.entitlement.findFirst({
    where: {
      userId: user.id,
      productId: lesson.chapter.course.productId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const duration = parsed.data.durationSeconds || lesson.durationSeconds || 0;
  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    select: { maxPositionSeconds: true, watchedSeconds: true, completed: true },
  });

  const maxPosition = Math.max(existing?.maxPositionSeconds ?? 0, positionSeconds);
  const watched = Math.max(
    existing?.watchedSeconds ?? 0,
    parsed.data.watchedSeconds ?? positionSeconds,
  );
  const completed =
    (existing?.completed ?? false) ||
    (duration > 0 && maxPosition / duration >= COMPLETION_THRESHOLD);

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    update: {
      lastPositionSeconds: Math.round(positionSeconds),
      maxPositionSeconds: Math.round(maxPosition),
      watchedSeconds: Math.round(watched),
      completed,
    },
    create: {
      userId: user.id,
      lessonId,
      lastPositionSeconds: Math.round(positionSeconds),
      maxPositionSeconds: Math.round(maxPosition),
      watchedSeconds: Math.round(watched),
      completed,
    },
  });

  const percent = duration > 0 ? Math.min(100, Math.round((maxPosition / duration) * 100)) : 0;
  return NextResponse.json({ completed, percent });
}
