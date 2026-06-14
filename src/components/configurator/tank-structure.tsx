"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FINISHES, type ConfiguratorParams } from "./types";

/*
 * A real-time, parametric reproduction of the `construction_tank_sys` Houdini
 * asset, built for the browser with three.js. It is NOT a Houdini cook, it is
 * a faithful r3f rebuild driven by the *same* parameter interface the HDA
 * exposes (overall height, floors, side rails, ladder segments, tilt …), so a
 * visitor reshaping the sliders sees the asset rebuild exactly as it would in
 * Houdini. The true headless cook is a later (Phase C) server step.
 *
 * Construction mirrors the HDA node graph: a tube tank body with a coned top,
 * horizontal grid platforms, swept guard-rails distributed around each
 * platform, and a resampled-point access ladder (rungs + stringers + safety
 * cage) that can be offset and tilted.
 */

const R = 1.55; // tank body radius (scene units)
const CAP_H = R * 0.5; // coned top height
const PLATFORM_R = R + 0.55;
const PLATFORM_H = 0.06;
const RAIL_TUBE = 0.03;
const RAIL_HEIGHT = 0.5;
const STRINGER_W = 0.05;
const RUNG_R = 0.035;
const LADDER_WIDTH = 0.55; // HDA `ladder_width`, fixed for the demo
const LADDER_X = -(R + 0.5); // HDA `t2` offset, ladder sits just off the tank
const BALUSTERS = 14;

const STEEL = { hex: "#9aa0a6", metalness: 0.7, roughness: 0.5 };
const RUST = new THREE.Color("#4a3526");

type Built = {
  floorYs: number[];
  railRings: { y: number }[];
  balusterYs: number[];
  rungYs: number[];
  cageYs: number[];
  ladderLen: number;
};

function buildTank(p: ConfiguratorParams): Built {
  const H = p.overallHeight;

  const floorYs: number[] = [];
  if (p.hasFloors) {
    for (let i = 1; i <= p.floors; i++) {
      floorYs.push((H * i) / (p.floors + 1));
    }
  }

  // Guard-rail bands sit above each platform; `side_rails` controls how many.
  const railRings: { y: number }[] = [];
  if (p.hasFloors && p.sideRails > 0) {
    for (const y of floorYs) {
      for (let k = 1; k <= p.sideRails; k++) {
        railRings.push({ y: y + (RAIL_HEIGHT * k) / p.sideRails });
      }
    }
  }
  const balusterYs = p.hasFloors && p.sideRails > 0 ? floorYs : [];

  // Ladder rungs resampled evenly up the climb height (HDA `segs`).
  const ladderLen = H;
  const rungYs: number[] = [];
  const top = ladderLen - 0.2;
  const bottom = 0.4;
  for (let i = 0; i < p.ladderSegs; i++) {
    const t = p.ladderSegs === 1 ? 0.5 : i / (p.ladderSegs - 1);
    rungYs.push(bottom + (top - bottom) * t);
  }

  // Caged-ladder hoops, the flare-tower safety cage.
  const cageCount = Math.min(10, Math.max(2, Math.round(H / 1.6)));
  const cageYs: number[] = [];
  for (let i = 0; i < cageCount; i++) {
    cageYs.push(1 + ((ladderLen - 1.4) * i) / Math.max(1, cageCount - 1));
  }

  return { floorYs, railRings, balusterYs, rungYs, cageYs, ladderLen };
}

function applyFinish(
  mat: THREE.MeshStandardMaterial,
  spec: { hex: string; metalness: number; roughness: number },
  w: number,
) {
  mat.color.set(spec.hex).lerp(RUST, w * 0.55);
  mat.metalness = spec.metalness * (1 - w * 0.6);
  mat.roughness = Math.min(1, spec.roughness + w * 0.25);
}

export function TankStructure({ params }: { params: ConfiguratorParams }) {
  const H = params.overallHeight;
  const built = useMemo(() => buildTank(params), [params]);

  // Shared, constant geometries, instanced by reference across many meshes so
  // reshaping a slider only changes transforms, never reallocates geometry.
  const geo = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(R, R, 1, 40),
      cap: new THREE.ConeGeometry(R, CAP_H, 40),
      pad: new THREE.CylinderGeometry(R + 0.85, R + 0.95, 0.18, 48),
      platform: new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R, PLATFORM_H, 48),
      railRing: new THREE.TorusGeometry(PLATFORM_R, RAIL_TUBE, 8, 56),
      baluster: new THREE.CylinderGeometry(0.022, 0.022, RAIL_HEIGHT, 6),
      rung: new THREE.CylinderGeometry(RUNG_R, RUNG_R, LADDER_WIDTH, 8),
      stringer: new THREE.BoxGeometry(STRINGER_W, 1, STRINGER_W),
      cage: new THREE.TorusGeometry(0.5, 0.022, 6, 28),
    }),
    [],
  );

  // Stable materials, mutated in place each render (no per-change allocation).
  const tankMat = useMemo(() => new THREE.MeshStandardMaterial(), []);
  const steelMat = useMemo(() => new THREE.MeshStandardMaterial(), []);
  applyFinish(tankMat, FINISHES[params.finish], params.weathering);
  applyFinish(steelMat, STEEL, params.weathering);

  const tiltRad = THREE.MathUtils.degToRad(params.ladderTilt);
  const halfW = LADDER_WIDTH / 2;

  return (
    <group>
      {/* Ground pad */}
      <mesh
        geometry={geo.pad}
        material={steelMat}
        position={[0, 0.09, 0]}
        receiveShadow
      />

      {/* Tank body + coned top */}
      <mesh
        geometry={geo.body}
        material={tankMat}
        position={[0, H / 2, 0]}
        scale={[1, H, 1]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={geo.cap}
        material={tankMat}
        position={[0, H + CAP_H / 2, 0]}
        castShadow
      />

      {/* Platforms */}
      {built.floorYs.map((y, i) => (
        <mesh
          key={`f${i}`}
          geometry={geo.platform}
          material={steelMat}
          position={[0, y, 0]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Guard-rail bands */}
      {built.railRings.map((r, i) => (
        <mesh
          key={`r${i}`}
          geometry={geo.railRing}
          material={steelMat}
          position={[0, r.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      {/* Rail balusters around each platform */}
      {built.balusterYs.map((y, fi) =>
        Array.from({ length: BALUSTERS }).map((_, bi) => {
          const a = (bi / BALUSTERS) * Math.PI * 2;
          return (
            <mesh
              key={`b${fi}-${bi}`}
              geometry={geo.baluster}
              material={steelMat}
              position={[
                Math.cos(a) * PLATFORM_R,
                y + RAIL_HEIGHT / 2,
                Math.sin(a) * PLATFORM_R,
              ]}
            />
          );
        }),
      )}

      {/* Access ladder, offset off the tank and tilted from vertical */}
      <group position={[LADDER_X, 0, 0]} rotation={[0, 0, tiltRad]}>
        {/* Stringers */}
        {[-halfW, halfW].map((z, i) => (
          <mesh
            key={`s${i}`}
            geometry={geo.stringer}
            material={steelMat}
            position={[0, built.ladderLen / 2, z]}
            scale={[1, built.ladderLen, 1]}
            castShadow
          />
        ))}
        {/* Rungs */}
        {built.rungYs.map((y, i) => (
          <mesh
            key={`rung${i}`}
            geometry={geo.rung}
            material={steelMat}
            position={[0, y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        ))}
        {/* Safety cage hoops */}
        {built.cageYs.map((y, i) => (
          <mesh
            key={`c${i}`}
            geometry={geo.cage}
            material={steelMat}
            position={[-0.15, y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
}
