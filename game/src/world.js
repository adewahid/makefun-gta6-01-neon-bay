// Procedural city generation for Neon Bay: a road grid, building blocks,
// a park, a beach along the south edge, a marina on the east, and a set of
// props (trees, lamps, hydrants). All derived from a seed, so the city is
// identical every run with the same seed.
import { WORLD, ROAD_W, ROAD_STEP, ROADS, COLORS } from './config.js';
import { makeRng, clamp } from './random.js';

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const pickups = [];

  const roadHalf = ROAD_W / 2;

  // Blocks sit between neighbouring roads.
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = ROADS[i] + roadHalf + 8;
      const y0 = ROADS[j] + roadHalf + 8;
      const x1 = ROADS[i + 1] - roadHalf - 8;
      const y1 = ROADS[j + 1] - roadHalf - 8;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // South strip is the beach; east strip is the marina.
      if (cy > 2080) continue;
      if (cx > 2080) continue;
      // One park block near the middle of the map.
      if (i === 3 && j === 3) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(7, 12) });
        }
        continue;
      }
      const downtown = cx > 850 && cx < 1850 && cy > 250 && cy < 950;
      const palette = downtown ? COLORS.downtown : COLORS.buildingRoof;
      // 1-4 buildings per block, or a parking lot with parked cars.
      if (rng.chance(0.16)) {
        for (let p = 0; p < 3; p++) {
          pickups.push({
            kind: 'parked', x: x0 + 30 + p * 52, y: y0 + 34,
            angle: Math.PI / 2, def: Math.floor(rng.range(0, 4)),
          });
        }
        continue;
      }
      const n = rng.int(1, 2);
      if (n === 1) {
        const w = rng.range(90, x1 - x0 - 20);
        const h = rng.range(80, y1 - y0 - 20);
        buildings.push(makeBuilding(cx, cy, w, h, downtown, palette, rng));
      } else {
        const bw = (x1 - x0) / 2 - 14;
        const bh = (y1 - y0) / 2 - 14;
        buildings.push(makeBuilding(x0 + bw / 2 + 4, y0 + bh / 2 + 4, bw, bh, downtown, palette, rng));
        buildings.push(makeBuilding(x1 - bw / 2 - 4, y1 - bh / 2 - 4, bw, bh, downtown, palette, rng));
      }
      for (let t = 0; t < 2; t++) {
        trees.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), r: rng.range(6, 10) });
      }
    }
  }

  // Street lamps along the roads.
  for (const r of ROADS) {
    for (let d = 120; d < WORLD - 100; d += 300) {
      lamps.push({ x: d, y: r - roadHalf - 6 });
      lamps.push({ x: r - roadHalf - 6, y: d });
    }
  }

  // Beach strip (south) and water below it; marina docks (east).
  const beach = { x: 0, y: 2130, w: WORLD, h: 130 };
  const water = { x: 0, y: 2260, w: WORLD, h: 140 };
  const marina = { x: 2130, y: 1500, w: 270, h: 560 };

  // Landmark positions used by missions (fixed so the story reads the same).
  const landmarks = {
    chopShop: { x: 300, y: 300, label: 'Chop Shop' },
    docks: { x: 2250, y: 1650, label: 'Docks' },
    delia: { x: 1050, y: 1050, label: "Delia's" },
    industrial: { x: 300, y: 600, label: 'Yard' },
    bank: { x: 1350, y: 450, label: 'Marina Bank' },
    hideout: { x: 600, y: 1950, label: 'Hideout' },
    start: { x: 1050, y: 1350, label: 'Start' },
  };

  return { buildings, trees, lamps, parks, pickups, beach, water, marina, landmarks, rng };
}

function makeBuilding(cx, cy, w, h, downtown, palette, rng) {
  return {
    x: cx - w / 2, y: cy - h / 2, w, h,
    color: palette[Math.floor(rng.next() * palette.length)],
    tall: downtown ? rng.chance(0.7) : rng.chance(0.15),
    windows: rng.int(2, 5),
  };
}

// --- collision helpers -------------------------------------------------
export function circleHitsBuildings(x, y, r, buildings) {
  for (const b of buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings and water; returns true if it hit something.
export function resolveCircle(x, y, r, city) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    let dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 < 0.0001) { dx = 0; dy = -1; }
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const push = r - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  // Water blocks movement (except the marina dock strip).
  if (y + r > city.water.y && !(x > city.marina.x && y > city.marina.y)) {
    y = city.water.y - r;
    hit = true;
  }
  x = clamp(x, r, WORLD - r);
  y = clamp(y, r, WORLD - r);
  return { x, y, hit };
}

export function isOnRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) < ROAD_W / 2 + 6 || Math.abs(y - r) < ROAD_W / 2 + 6) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const rx of ROADS) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const road = ROADS[Math.floor(rng.next() * ROADS.length)];
  const along = rng.range(120, WORLD - 120);
  return vertical ? { x: road, y: along } : { x: along, y: road };
}
