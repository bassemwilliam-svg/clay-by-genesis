import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { runConcierge, runConciergeOffline } from "@/lib/ai/concierge";
import type { ConciergeEvent } from "@/lib/ai/types";

/*
 * AI concierge stream. Newline-delimited JSON (one ConciergeEvent per line) so
 * the client can render text + inline product cards as they arrive. Needs the
 * Node runtime (Prisma + the Anthropic SDK) and never caches.
 *
 * With ANTHROPIC_API_KEY set, Atlas runs the full Claude tool-use agent. Without
 * it (the default until the key is provisioned), it falls back to a catalog
 * search so the feature still returns real recommendations, no dead end.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: z.flattenError(parsed.error) },
      { status: 422 },
    );
  }

  const turns = parsed.data.messages;
  const brief = turns[turns.length - 1].content;
  const history = turns.slice(0, -1);
  const configured = Boolean(env.ANTHROPIC_API_KEY);

  const encoder = new TextEncoder();
  let assistantText = "";
  const recommendedIds = new Set<string>();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ConciergeEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        const events = configured
          ? runConcierge(history, brief)
          : runConciergeOffline(brief);
        for await (const ev of events) {
          if (ev.type === "text") assistantText += ev.text;
          if (ev.type === "products") {
            ev.items.forEach((i) => recommendedIds.add(i.id));
          }
          send(ev);
        }
      } catch (e) {
        console.error("[api/concierge]", e);
        send({ type: "error", message: "The concierge hit a snag. Please try again." });
      } finally {
        controller.close();
        void logTurn(brief, assistantText, [...recommendedIds]);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/*
 * Best-effort analytics: persist the brief, the assistant's reply, and which
 * products were recommended, so catalog gaps (briefs that returned nothing)
 * can inform future content. Never blocks or fails the response.
 */
async function logTurn(
  brief: string,
  reply: string,
  recommendedProductIds: string[],
): Promise<void> {
  try {
    await prisma.conciergeSession.create({
      data: {
        brief,
        messages: {
          create: [
            { role: "USER", content: brief, recommendedProductIds: [] },
            {
              role: "ASSISTANT",
              content: reply.slice(0, 8000),
              recommendedProductIds,
            },
          ],
        },
      },
    });
  } catch (e) {
    console.error("[api/concierge] log failed", e);
  }
}
