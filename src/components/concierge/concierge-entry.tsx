"use client";

import { useState } from "react";

/*
 * The landing-page concierge entry. Submitting opens the persistent
 * ConciergeWidget (mounted in the layout) and auto-sends the brief via a window
 * event, no shared context/provider plumbing needed.
 */
export function ConciergeEntry() {
  const [brief, setBrief] = useState("");

  const open = (text: string) => {
    window.dispatchEvent(
      new CustomEvent("open-concierge", { detail: { brief: text } }),
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        open(brief);
      }}
      className="mx-auto mt-6 flex max-w-xl gap-2"
    >
      <input
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="e.g. a WW2 French village for an Unreal POC"
        className="w-full rounded-md border border-border bg-input/40 px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
      />
      <button
        type="submit"
        className="inline-flex h-[42px] shrink-0 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        Find assets
      </button>
    </form>
  );
}
