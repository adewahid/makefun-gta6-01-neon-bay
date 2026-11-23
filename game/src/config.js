// Solmar Bay — shared constants, tuning and small helpers.
// Everything the other modules need lives here: world size, colours, car
// specs, wanted rules and a seeded RNG so the city is the same every run.

// World: a coastal city of 10 x 9 blocks on a road grid.
export const WORLD_W = 3600;
export const WORLD_H = 2880;
export const ROAD_W = 96;            // road width in px
export const BLOCK_W = 264;           // block width between roads
export const BLOCK_H = 224;           // block height between roads
export const PITCH_X = ROAD_W + BLOCK_W; // 360
export const PITCH_Y = ROAD_W + BLOCK_H; // 320
export const COLS = 10;
export const ROWS = 9;

// Road centre lines (world coords).
export const ROAD_XS = Array.from({ length: COLS }, (_, i) => ROAD_W / 2 + i * PITCH_X);
export const ROAD_YS = Array.from({ length: ROWS }, (_, i) => ROAD_W / 2 + i * PITCH_Y);

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 720, y1: 2880, tint: '#2e6f8e' },
  { name: 'Old Town', x0: 720, y0: 0, x1: 2160, y1: 960, tint: '#8a6f4d' },
  { name: 'Downtown', x0: 720, y0: 960, x1: 2160, y1: 1920, tint: '#4d5a7a' },
  { name: 'Casino Strip', x0: 720, y0: 1920, x1: 2160, y1: 2880, tint: '#7a4d6e' },
  { name: 'The Docks', x0: 2160, y0: 1920, x1: 3600, y1: 2880, tint: '#5a5a52' },
  { name: 'Palms East', x0: 2160, y0: 0, x1: 3600, y1: 1920, tint: '#4d7a52' },
];

export const CAR_TYPES = {
  compact: { name: 'Pipit Compact', accel: 260, top: 300, grip: 3.4, len: 44, wid: 22, colors: ['#c94f4f', '#4f7ac9', '#e0d060'] },
  sedan:   { name: 'Meridian Sedan', accel: 300, top: 340, grip: 3.0, len: 50, wid: 24, colors: ['#3a3f4a', '#7a8a9a', '#b0893a'] },
  sports:  { name: 'Vortex GT', accel: 430, top: 470, grip: 4.2, len: 48, wid: 24, colors: ['#d21f3c', '#f2a007', '#22b8a6'] },
  taxi:    { name: 'Bay Cab', accel: 290, top: 330, grip: 3.1, len: 50, wid: 24, colors: ['#f2c200'] },
  van:     { name: 'Hauler Van', accel: 210, top: 260, grip: 2.6, len: 58, wid: 26, colors: ['#e8e8e8', '#5a7a5a'] },
  police:  { name: 'SCPD Interceptor', accel: 380, top: 430, grip: 3.8, len: 50, wid: 24, colors: ['#1c2f6e'] },
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 9,      // seconds unseen before stars start to fall
  decayStep: 7,       // seconds per star lost while unseen
  copsPerStar: [0, 1, 2, 3, 4, 5],
  copSpeed: [0, 330, 350, 375, 400, 430],
};

export const MISSION_REWARDS = [500, 800, 1200, 1500, 2000, 1800, 5000];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
export const angleDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Deterministic RNG (mulberry32) so the city, traffic and peds are stable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, a, b) { return a + rng() * (b - a); }
export function irange(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
