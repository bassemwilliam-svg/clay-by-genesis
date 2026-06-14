"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  DEFAULT_PARAMS,
  FINISHES,
  LIMITS,
  type ConfiguratorParams,
  type Finish,
} from "./types";

const sliderCls = "w-full accent-primary";

// WebGL is browser-only, load the Canvas client-side only to avoid any SSR
// attempt and guarantee a clean, deterministic first paint.
const SceneCanvas = dynamic(() => import("./scene-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading live demo…
    </div>
  ),
});

export function Configurator() {
  const [params, setParams] = useState<ConfiguratorParams>(DEFAULT_PARAMS);

  const set = <K extends keyof ConfiguratorParams>(
    key: K,
    value: ConfiguratorParams[K],
  ) => setParams((p) => ({ ...p, [key]: value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/30 to-background">
        <SceneCanvas params={params} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/70 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
          Live demo · drag to orbit
        </span>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card/40 p-5">
        <div>
          <h3 className="text-sm font-semibold">Construction tank system</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Every control is a live parameter on the real Houdini asset.
            Reshape it here, then export it engine-ready, the same manifest
            drives per-asset customization.
          </p>
        </div>

        {/* HDA: t3, Overall_height */}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Overall height</span>
            <span className="text-muted-foreground">{params.overallHeight} m</span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.overallHeight.min}
            max={LIMITS.overallHeight.max}
            step={1}
            value={params.overallHeight}
            onChange={(e) => set("overallHeight", Number(e.target.value))}
          />
        </label>

        {/* HDA: is_floor, Has Floors */}
        <label className="flex items-center justify-between text-sm">
          <span className="font-medium">Platforms</span>
          <button
            type="button"
            role="switch"
            aria-checked={params.hasFloors}
            onClick={() => set("hasFloors", !params.hasFloors)}
            className={`relative h-5 w-9 rounded-full transition ${
              params.hasFloors ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition ${
                params.hasFloors ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </label>

        {/* HDA: floor_num, Floor Numbers */}
        <label className={`flex flex-col gap-1.5 ${params.hasFloors ? "" : "opacity-40"}`}>
          <span className="flex justify-between text-sm">
            <span className="font-medium">Floors</span>
            <span className="text-muted-foreground">{params.floors} levels</span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.floors.min}
            max={LIMITS.floors.max}
            step={1}
            value={params.floors}
            disabled={!params.hasFloors}
            onChange={(e) => set("floors", Number(e.target.value))}
          />
        </label>

        {/* HDA: side_rails, Side Rails */}
        <label className={`flex flex-col gap-1.5 ${params.hasFloors ? "" : "opacity-40"}`}>
          <span className="flex justify-between text-sm">
            <span className="font-medium">Side rails</span>
            <span className="text-muted-foreground">
              {params.sideRails === 0 ? "none" : `${params.sideRails} bands`}
            </span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.sideRails.min}
            max={LIMITS.sideRails.max}
            step={1}
            value={params.sideRails}
            disabled={!params.hasFloors}
            onChange={(e) => set("sideRails", Number(e.target.value))}
          />
        </label>

        {/* HDA: segs, Ladder Seg */}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Ladder rungs</span>
            <span className="text-muted-foreground">{params.ladderSegs}</span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.ladderSegs.min}
            max={LIMITS.ladderSegs.max}
            step={1}
            value={params.ladderSegs}
            onChange={(e) => set("ladderSegs", Number(e.target.value))}
          />
        </label>

        {/* HDA: tilt / tilt2, Tilt */}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Ladder tilt</span>
            <span className="text-muted-foreground">
              {params.ladderTilt === 0 ? "vertical" : `${params.ladderTilt}°`}
            </span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.ladderTilt.min}
            max={LIMITS.ladderTilt.max}
            step={1}
            value={params.ladderTilt}
            onChange={(e) => set("ladderTilt", Number(e.target.value))}
          />
        </label>

        {/* HDA: weathering, surface roughness + grime */}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm">
            <span className="font-medium">Weathering</span>
            <span className="text-muted-foreground">
              {Math.round(params.weathering * 100)}%
            </span>
          </span>
          <input
            type="range"
            className={sliderCls}
            min={LIMITS.weathering.min}
            max={LIMITS.weathering.max}
            step={0.05}
            value={params.weathering}
            onChange={(e) => set("weathering", Number(e.target.value))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Finish</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FINISHES) as Finish[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => set("finish", f)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition ${
                  params.finish === f
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/20"
                  style={{ background: FINISHES[f].hex }}
                />
                {FINISHES[f].label}
              </button>
            ))}
          </div>
        </div>

        <Link
          href="/browse"
          className="mt-1 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Start building
        </Link>
      </div>
    </div>
  );
}
