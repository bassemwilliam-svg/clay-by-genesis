import type { ProductCardData } from "@/components/storefront/product-card";

/*
 * Wire/display types shared between the server agent (concierge.ts, the route)
 * and the client chat UI. This module is deliberately runtime-free (no
 * "server-only", no SDK imports) so the client bundle can import it safely.
 */

/** How a product surfaced in a catalog search, drives a small UI affordance. */
export type MatchedVia = "semantic" | "keyword" | "filter";

/** A catalog hit, shaped for the existing ProductCard plus the agent's needs. */
export type ConciergeProduct = ProductCardData & {
  id: string;
  matchedVia: MatchedVia;
};

/** Streamed, newline-delimited events the concierge endpoint emits. */
export type ConciergeEvent =
  | { type: "text"; text: string }
  | { type: "products"; items: ConciergeProduct[] }
  | { type: "error"; message: string }
  | { type: "done" };

/** A single chat turn as sent from the client to the endpoint. */
export type ConciergeTurn = { role: "user" | "assistant"; content: string };
