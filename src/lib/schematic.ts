/*
 * Deterministic seeded randomness for the generative "schematic" cover art.
 * Pure functions of a seed string (a product slug/id), so the same product
 * always renders the same drawing, stable across server renders, hydration,
 * and ISR. No Math.random, no time, no client state.
 */

/** cyrb53, fast, well-distributed string hash → 32-bit-ish seed. */
export function hashSeed(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // Final `>>> 0` keeps the result an unsigned 32-bit int. Without it, XOR
  // yields a signed int, so negative hashes would render a "-" in toString(16)
  // (e.g. part codes like CL--35F). The RNG is unaffected, mulberry32 coerces
  // with `>>> 0` internally, so generative art stays identical.
  return ((h2 >>> 0) ^ (h1 >>> 0)) >>> 0;
}

/** mulberry32 PRNG → deterministic stream in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Deterministic element from a list. */
  pick<T>(items: readonly T[]): T;
};

export function makeRng(seed: string): Rng {
  const rand = mulberry32(hashSeed(seed));
  const range = (min: number, max: number) => min + rand() * (max - min);
  return {
    next: rand,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (items) => items[Math.floor(rand() * items.length)],
  };
}

/** Round to 2dp for compact, stable SVG path strings. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
