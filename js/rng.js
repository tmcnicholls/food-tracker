// Small deterministic PRNG (mulberry32) so a given seed always produces the
// same week. Regeneration picks a fresh seed explicitly; nothing re-rolls on
// a plain page refresh.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, non-deterministic seed for a brand-new generation. */
export function freshSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

/** Pick a random element from a plain array using the given rng(). */
export function pickFromArray(arr, rng) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/**
 * Weighted pick: `weightFn(item)` returns a non-negative weight for each
 * item. Falls back to a uniform pick if all weights are zero.
 */
export function weightedPick(items, rng, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pickFromArray(items, rng);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
