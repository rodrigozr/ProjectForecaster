import type { RandomSource } from '../../src/lib/monteCarlo';

/** Deterministic PRNG (mulberry32) so simulations are reproducible in tests. */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random source that returns the given values in order, cycling when exhausted. */
export function sequenceRandom(...values: number[]): RandomSource {
  let i = 0;
  return () => values[i++ % values.length];
}
