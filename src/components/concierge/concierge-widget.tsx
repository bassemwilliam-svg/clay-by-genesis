"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/storefront/product-card";
import type { ConciergeEvent, ConciergeProduct } from "@/lib/ai/types";

/*
 * Persistent concierge: a floating launcher + slide-over chat panel, mounted in
 * the marketing and storefront layouts. The landing-page entry input opens it
 * (and auto-sends the brief) via a window `open-concierge` event, so there's a
 * single chat surface across the store.
 */

type Msg = {
  role: "user" | "assistant";
  text: string;
  products?: ConciergeProduct[];
  pending?: boolean;
};

const SUGGESTIONS = [
  "A WW2 French village for an Unreal POC",
  "Modular sci-fi corridors for Unity",
  "I want to learn the procedural workflow",
];

export function ConciergeWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const messagesRef = useRef<Msg[]>([]);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const applyEvent = useCallback((ev: ConciergeEvent) => {
    setMessages((prev) => {
      const copy = prev.slice();
      const last = copy[copy.length - 1];
      if (!last || last.role !== "assistant") return prev;
      if (ev.type === "text") {
        copy[copy.length - 1] = { ...last, text: last.text + ev.text };
      } else if (ev.type === "products") {
        copy[copy.length - 1] = {
          ...last,
          products: [...(last.products ?? []), ...ev.items],
        };
      } else if (ev.type === "error") {
        copy[copy.length - 1] = {
          ...last,
          text: last.text || ev.message,
          pending: false,
        };
      } else if (ev.type === "done") {
        copy[copy.length - 1] = { ...last, pending: false };
      }
      return copy;
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loadingRef.current) return;

      const history = messagesRef.current;
      const payload = [...history, { role: "user" as const, text }].map((m) => ({
        role: m.role,
        content: m.text,
      }));

      setInput("");
      setMessages([
        ...history,
        { role: "user", text },
        { role: "assistant", text: "", pending: true },
      ]);
      setLoading(true);
      loadingRef.current = true;

      try {
        const res = await fetch("/api/concierge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: payload }),
        });

        if (res.status === 503) {
          const data = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          applyEvent({
            type: "error",
            message:
              data?.message ?? "Atlas isn't available right now.",
          });
          applyEvent({ type: "done" });
          return;
        }
        if (!res.ok || !res.body) {
          applyEvent({ type: "error", message: "Something went wrong." });
          applyEvent({ type: "done" });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) applyEvent(JSON.parse(line) as ConciergeEvent);
          }
        }
      } catch {
        applyEvent({ type: "error", message: "Connection lost. Please retry." });
        applyEvent({ type: "done" });
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [applyEvent],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const brief = (e as CustomEvent<{ brief?: string }>).detail?.brief;
      setOpen(true);
      if (brief?.trim()) void send(brief);
    };
    window.addEventListener("open-concierge", handler);
    return () => window.removeEventListener("open-concierge", handler);
  }, [send]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Atlas, your project guide"
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
      >
        <span className="h-2 w-2 rounded-full bg-primary-foreground/80" />
        Ask Atlas
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close Atlas"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Atlas</h2>
                <p className="text-xs text-muted-foreground">
                  Your project guide. Describe what you&apos;re building and
                  Atlas maps it to the catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted/50"
              >
                Close
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Tell me what you&apos;re building and I&apos;ll pull a
                    curated set of assets, kits, and tools from the Clay
                    catalog.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-muted/40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m, i) => (
                <div key={i} className="space-y-3">
                  <div
                    className={
                      m.role === "user"
                        ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "w-fit max-w-[90%] rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    }
                  >
                    {m.text || (m.pending ? "Thinking…" : "")}
                  </div>
                  {m.products?.length ? (
                    <div className="grid gap-3">
                      {m.products.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex gap-2 border-t border-border p-4"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. a derelict space station for Unreal"
                className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
