// city.js — Neon Bay's world: a sun-soaked coastal city on a road grid.
// Deterministic: everything is derived from one seed, so the map is the
// same on every load. The city is 2600 x 2600 px; the east edge is a beach
// and the bay. Roads run every 260 px; blocks hold buildings, parks and
// parking lots. Named landmarks anchor the mission locations.

import { makeRng } from './random.js';

export const WORLD_W = 2600;
export const WORLD_H = 2600;
export const ROAD_STEP = 260;
export const ROAD_W = 64;
export const BEACH_X = 2280; // sand starts here; the bay is past x = 2440

const BUILDING_PALETTE = [
  '#f2a65a', '#e07856', '#f7d08a', '#c96f4a', '#8ecae6', '#7fb069',
  '#e8b4b8', '#a3b18a', '#dda15e', '#bc6c25', '#f4a261', '#90be6d',
];
const NEON_SIGNS = [
  'PIER', 'HOTEL', 'TACOS', '24H', 'BAR', 'CLUB', 'MALL', 'GYM',
  'PIZZA', 'NEON', 'BAY', 'SUN', 'DANCE', 'CAFE', 'MOTO', 'LUXE',
];
const NEON_COLORS = ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff6b35', '#b537f2'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const parkingLots = [];
  const palms = [];

  // Landmarks: fixed positions the missions point at.
  const landmarks = {
    plaza: { name: 'Palm Plaza', x: 650, y: 650 },
    mall: { name: 'Coral Mall', x: 1170, y: 910 },
    docks: { name: 'Sunset Docks', x: 390, y: 1950 },
    hotel: { name: 'Bayview Hotel', x: 1950, y: 650 },
    pier: { name: 'Neon Pier', x: 2390, y: 1300 },
    safehouse: { name: 'Safehouse', x: 910, y: 1690 },
    yacht: { name: 'Yacht Marina', x: 2400, y: 2210 },
    hospital: { name: 'St. Coral Hospital', x: 1690, y: 1690 },
  };

  // Road centre lines (vertical avenues and horizontal streets).
  const avenues = [];
  const streets = [];
  for (let x = ROAD_STEP; x < WORLD_W - 100; x += ROAD_STEP) avenues.push(x);
  for (let y = ROAD_STEP; y < WORLD_H - 100; y += ROAD_STEP) streets.push(y);

  // Fill every block between roads with a building, a park or a lot.
  for (let bx = 0; bx < avenues.length; bx++) {
    for (let by = 0; by < streets.length; by++) {
      const x0 = avenues[bx] + ROAD_W / 2 + 14;
      const y0 = streets[by] + ROAD_W / 2 + 14;
      const x1 = (avenues[bx + 1] ?? WORLD_W - 40) - ROAD_W / 2 - 14;
      const y1 = (streets[by + 1] ?? WORLD_H - 40) - ROAD_W / 2 - 14;
      if (x0 > BEACH_X - 60) continue; // beach blocks stay open
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 40 || h < 40) continue;
      const roll = rng.next();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w, h, trees: rng.int(4, 9) });
      } else if (roll < 0.24) {
        parkingLots.push({ x: x0, y: y0, w, h });
      } else {
        const cols = rng.chance(0.3) ? 2 : 1;
        const rows = rng.chance(0.3) ? 2 : 1;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const bw = w / cols - 12;
            const bh = h / rows - 12;
            const bx0 = x0 + cx * (w / cols) + 6;
            const by0 = y0 + cy * (h / rows) + 6;
            buildings.push({
              x: bx0, y: by0, w: bw, h: bh,
              color: rng.pick(BUILDING_PALETTE),
              height: rng.int(1, 4), // storeys, drives the shadow + roof tint
              sign: rng.chance(0.45) ? rng.pick(NEON_SIGNS) : null,
              signColor: rng.pick(NEON_COLORS),
              roof: rng.pick(['#5b4a68', '#3e5c76', '#6d6875', '#4a4e69']),
            });
          }
        }
      }
    }
  }

  // Palm trees along the beach and the main avenue.
  for (let y = 120; y < WORLD_H - 100; y += 90) {
    palms.push({ x: BEACH_X + 40 + rng.range(-8, 8), y });
  }
  for (let x = 300; x < 2200; x += 130) {
    if (rng.chance(0.7)) palms.push({ x, y: 260 - 52 });
  }

  // Parked cars sit in parking lots and along kerbs; traffic spawns from
  // these spots too.
  const parkedSpots = [];
  for (const lot of parkingLots) {
    const n = Math.max(2, Math.floor(lot.w / 46));
    for (let i = 0; i < n; i++) {
      parkedSpots.push({
        x: lot.x + 24 + i * 44,
        y: lot.y + lot.h / 2,
        angle: Math.PI / 2,
      });
    }
  }
  for (let i = 0; i < 26; i++) {
    const avenue = rng.pick(avenues);
    const street = rng.pick(streets);
    const horizontal = rng.chance(0.5);
    parkedSpots.push({
      x: horizontal ? avenue + rng.range(-100, 100) : avenue + ROAD_W / 2 - 16,
      y: horizontal ? street + ROAD_W / 2 - 16 : street + rng.range(-100, 100),
      angle: horizontal ? 0 : Math.PI / 2,
    });
  }

  return {
    seed, avenues, streets, buildings, parks, parkingLots, palms,
    parkedSpots, landmarks,
  };
}

// True when a point is on a road (used for traffic lanes and spawning).
export function onRoad(city, x, y) {
  const inBand = (v) => city.avenues.some((a) => Math.abs(v - a) < ROAD_W / 2);
  return inBand(x) || inBand(y);
}

// Nearest point on the road network to (x, y).
export function snapToRoad(city, x, y) {
  let bestX = city.avenues[0];
  let bestY = city.streets[0];
  for (const a of city.avenues) if (Math.abs(a - x) < Math.abs(bestX - x)) bestX = a;
  for (const s of city.streets) if (Math.abs(s - y) < Math.abs(bestY - y)) bestY = s;
  return Math.abs(bestX - x) < Math.abs(bestY - y)
    ? { x: bestX, y }
    : { x, y: bestY };
}
