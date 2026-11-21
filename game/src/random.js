// random.js — deterministic seeded random numbers for Neon Bay.
// The city layout and traffic spawns are built from a fixed seed so the
// world looks the same on every load; live gameplay randomness uses the
// same generator seeded once at boot.
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

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max]
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    // pick one element of an array
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
  };
}
