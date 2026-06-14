import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ProductType } from "@prisma/client";
import { requireEnv } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { searchCatalog, getProductForConcierge } from "./catalog-search";
import type { ConciergeEvent, ConciergeProduct, ConciergeTurn } from "./types";

/*
 * The AI concierge: a Claude tool-use agent that turns a project brief into a
 * curated shortlist drawn ONLY from the published Genesis catalog.
 *
 * - Internal-first: every recommendation must be a real catalog item returned
 *   by `search_catalog`. Web search is allowed only to understand the brief's
 *   domain (what a scene typically needs), never to surface outside products.
 * - Streaming: exposed as an async generator of ConciergeEvents so the route
 *   can pipe text + inline product cards to the client as they're produced.
 * - History is replayed as plain text (not tool_use/tool_result pairs), so each
 *   user turn runs a fresh, self-contained tool loop.
 */

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const MAX_STEPS = 5;
const WEB_CONTEXT_ENABLED = true;

const SYSTEM_PROMPT = `You are the Clay concierge, a builder-to-builder guide for Clay, a Genesis-studio marketplace of procedural 3D game assets, environment kits, procedural tools, and courses. Your job: turn a developer's project brief into a curated shortlist of real Clay catalog items.

Rules:
- Recommend ONLY products returned by the search_catalog tool. Never invent products, prices, slugs, or links. Never point the user to any store or asset outside the Clay catalog.
- If the brief is underspecified, ask ONE concise clarifying question (target engine? scale/scope? style or era? modular vs. baked?) before searching. Don't interrogate, one good question, then act.
- Once you have enough to go on, call search_catalog (and get_product_details when you need specifics). Then present a short, confident shortlist: for each pick, one line on why it fits the brief. Keep prose tight.
- If the catalog can't satisfy the brief, say so plainly and offer the closest kits/bundles rather than padding with weak matches.
- You may use web_search ONLY to understand what a given kind of project needs (reference vocabulary, typical components) so you search the catalog better. Never present web results as things to buy.
- Tone: technically credible, concise, no marketing fluff. Speak the audience's language (engines, polycount, formats, modularity).`;

const filtersSchema = z
  .object({
    type: z.enum(ProductType).optional(),
    categorySlug: z.string().optional(),
    engine: z.string().optional(),
    maxPriceCents: z.number().int().positive().optional(),
  })
  .optional();

const searchInputSchema = z.object({
  query: z.string().optional(),
  filters: filtersSchema,
  limit: z.number().int().min(1).max(12).optional(),
});

const detailsInputSchema = z.object({ id: z.string().min(1) });

const tools: Anthropic.ToolUnion[] = [
  {
    name: "search_catalog",
    description:
      "Search the published Genesis catalog. Combine a natural-language `query` with optional structured `filters` (type, categorySlug, engine, maxPriceCents). Returns real products only.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language description of what the buyer needs.",
        },
        filters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: Object.values(ProductType),
              description: "Restrict to one product type.",
            },
            categorySlug: { type: "string" },
            engine: {
              type: "string",
              description: "Target engine, e.g. Unreal, Unity, Godot.",
            },
            maxPriceCents: {
              type: "integer",
              description: "Price ceiling in integer cents.",
            },
          },
        },
        limit: { type: "integer", description: "Max results (1–12)." },
      },
    },
  },
  {
    name: "get_product_details",
    description:
      "Fetch full specs for one product id (from a prior search_catalog result) to make a precise recommendation.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

if (WEB_CONTEXT_ENABLED) {
  tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 3 });
}

type ToolOutcome = { text: string; products?: ConciergeProduct[] };

function priceLine(p: ConciergeProduct): string {
  const cents =
    p.discountCents != null && p.discountCents < p.priceCents
      ? p.discountCents
      : p.priceCents;
  return formatMoney(cents, p.currency);
}

async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
  if (name === "search_catalog") {
    const parsed = searchInputSchema.safeParse(input);
    if (!parsed.success) return { text: "Invalid search arguments." };
    const items = await searchCatalog(parsed.data);
    if (items.length === 0) {
      return { text: "No published catalog products matched." };
    }
    const summary = items.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      type: p.type,
      category: p.category?.name ?? null,
      price: priceLine(p),
      shortDesc: p.shortDesc,
    }));
    return { text: JSON.stringify(summary), products: items };
  }

  if (name === "get_product_details") {
    const parsed = detailsInputSchema.safeParse(input);
    if (!parsed.success) return { text: "Invalid product id." };
    const product = await getProductForConcierge(parsed.data.id);
    if (!product) return { text: "Product not found or not published." };
    return { text: JSON.stringify(product) };
  }

  return { text: `Unknown tool: ${name}` };
}

export async function* runConcierge(
  history: ConciergeTurn[],
  brief: string,
): AsyncGenerator<ConciergeEvent> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: brief },
  ];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          event.delta.text
        ) {
          yield { type: "text", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      messages.push({ role: "assistant", content: final.content });

      if (final.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.ContentBlockParam[] = [];
      for (const block of final.content) {
        if (block.type !== "tool_use") continue;
        const outcome = await runTool(block.name, block.input);
        if (outcome.products?.length) {
          yield { type: "products", items: outcome.products };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.text,
        });
      }
      if (toolResults.length === 0) break;
      messages.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    console.error("[concierge] run failed", e);
    yield { type: "error", message: "The concierge hit a snag. Please try again." };
  }

  yield { type: "done" };
}

/*
 * Offline mode: used when ANTHROPIC_API_KEY isn't configured. Atlas can't reason
 * conversationally without a key, but it can still do its core job, turn a brief
 * into real catalog matches, by running the same hybrid catalog search the
 * Claude agent calls as its `search_catalog` tool. Setting the key upgrades this
 * to the full clarifying-question, tool-use agent above with zero UI changes.
 */
export async function* runConciergeOffline(
  brief: string,
): AsyncGenerator<ConciergeEvent> {
  try {
    const items = await searchCatalog({ query: brief, limit: 6 });
    if (items.length === 0) {
      yield {
        type: "text",
        text: "I couldn't find a catalog match for that yet. Try naming an engine, a setting or era, or a kind of asset, or browse the full catalog.",
      };
      yield { type: "done" };
      return;
    }
    yield {
      type: "text",
      text: "Here are the closest matches from the Clay catalog for your brief:",
    };
    yield { type: "products", items };
  } catch (e) {
    console.error("[concierge] offline run failed", e);
    yield { type: "error", message: "Atlas hit a snag searching the catalog. Please try again." };
  }
  yield { type: "done" };
}
