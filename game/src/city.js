// Solmar Bay — city generation: road grid, building blocks, parks, the beach
// and the docks. Deterministic from a fixed seed. Exports the static city
// data plus collision and road helpers used by every other system.
import {
  WORLD_W, WORLD_H, ROAD_W, BLOCK_W, BLOCK_H, PITCH_X, PITCH_Y,
  COLS, ROWS, ROAD_XS, ROAD_YS, DISTRICTS, makeRng, pick, range, irange, clamp,
} from './config.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[1];
}

// A building: axis-aligned box with a height (for shading), a palette and
// a lit-window seed so nights glow.
export function buildCity(seed = 20261123) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const lamps = [];
  const crates = []; // dock crates, also solid
  const packages = []; // hidden package pickups (10)

  // Beach strip along the west edge (x < ROAD_W/2 is sand + water).
  const beach = { x: 0, y: 0, w: ROAD_W / 2 + 26, h: WORLD_H };

  for (let ci = 0; ci < COLS; ci++) {
    for (let ri = 0; ri < ROWS; ri++) {
      const bx = ROAD_XS[ci] + ROAD_W / 2;
      const by = ROAD_YS[ri] + ROAD_W / 2;
      const cx = bx + BLOCK_W / 2;
      const cy = by + BLOCK_H / 2;
      const district = districtAt(cx, cy);
      const roll = rng();

      // Central park in the middle of Downtown, and a park in Palms East.
      if ((ci === 3 && ri === 3) || (ci === 7 && ri === 2)) {
        parks.push({ x: bx, y: by, w: BLOCK_W, h: BLOCK_H, trees: irange(rng, 9, 14), seed: irange(rng, 1, 9999) });
        continue;
      }
      // The Docks: open container yard, no tall buildings.
      if (district.name === 'The Docks' && roll < 0.55) {
        for (let k = 0; k < irange(rng, 4, 8); k++) {
          crates.push({
            x: bx + range(rng, 0, BLOCK_W - 70), y: by + range(rng, 0, BLOCK_H - 34),
            w: irange(rng, 46, 70), h: 30, color: pick(rng, ['#b0562f', '#3f6f8e', '#7a8a3a', '#8e3f5a']),
          });
        }
        continue;
      }
      // Casino Strip: one big casino per block, glowing front.
      if (district.name === 'Casino Strip' && roll < 0.5) {
        buildings.push({
          x: bx + 18, y: by + 26, w: BLOCK_W - 36, h: BLOCK_H - 52,
          tall: false, casino: true, color: '#5a2f5e', roof: '#7a3f7e',
          windows: irange(rng, 1, 9999), district: district.name,
        });
        continue;
      }
      if (roll < 0.12) { // empty lot / parking
        for (let k = 0; k < irange(rng, 2, 4); k++) {
          palms.push({ x: bx + range(rng, 20, BLOCK_W - 20), y: by + range(rng, 20, BLOCK_H - 20) });
        }
        continue;
      }
      // Normal block: 1-3 buildings.
      const n = district.name === 'Downtown' ? irange(rng, 2, 3) : irange(rng, 1, 2);
      const tall = district.name === 'Downtown' ? rng() < 0.75 : rng() < 0.18;
      for (let k = 0; k < n; k++) {
        const w = range(rng, 70, Math.min(150, BLOCK_W - 24));
        const h = range(rng, 60, Math.min(130, BLOCK_H - 24));
        const x = bx + 12 + (k === 0 ? 0 : range(rng, 0, BLOCK_W - w - 24));
        const y = by + 12 + (k === 0 ? 0 : range(rng, 0, BLOCK_H - h - 24));
        buildings.push({
          x, y, w, h, tall, casino: false,
          color: pick(rng, ['#6b5a49', '#7a6a58', '#5a6a7a', '#8a7a6a', '#4a5a6a', '#9a8a7a', '#6a5a6e']),
          roof: pick(rng, ['#3a3230', '#4a3a34', '#2f3a44']),
          windows: irange(rng, 1, 99999), district: district.name,
        });
      }
      // Palms along the sidewalks of Marina / Palms East.
      if (district.name === 'Marina' || district.name === 'Palms East') {
        for (let k = 0; k < 3; k++) palms.push({ x: bx + range(rng, 0, BLOCK_W), y: by + (rng() < 0.5 ? 6 : BLOCK_H - 6) });
      }
    }
  }

  // Street lamps at every intersection corner.
  for (const x of ROAD_XS) for (const y of ROAD_YS) lamps.push({ x: x + ROAD_W / 2 - 6, y: y - ROAD_W / 2 + 6 });

  // Hidden packages: 10, on sidewalks spread across the city.
  const pkgSpots = [
    [ROAD_XS[0] + 60, ROAD_YS[0] + 60], [ROAD_XS[4] + 60, ROAD_YS[1] - 60],
    [ROAD_XS[8] - 60, ROAD_YS[0] + 60], [ROAD_XS[2] + 60, ROAD_YS[4] + 60],
    [ROAD_XS[5] - 60, ROAD_YS[5] - 60], [ROAD_XS[9] - 60, ROAD_YS[4] + 60],
    [ROAD_XS[1] - 60, ROAD_YS[7] + 60], [ROAD_XS[6] + 60, ROAD_YS[7] - 60],
    [ROAD_XS[3] - 60, ROAD_YS[8] + 60], [ROAD_XS[8] + 60, ROAD_YS[8] - 60],
  ];
  for (const [x, y] of pkgSpots) packages.push({ x, y, taken: false });

  const solids = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  for (const c of crates) solids.push({ x: c.x, y: c.y, w: c.w, h: c.h });

  return { buildings, parks, palms, lamps, crates, packages, beach, solids };
}

// ---- geometry helpers -------------------------------------------------------

export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2 + 4) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2 + 4) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = ROAD_XS[0]; let bd = Infinity;
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } }
  let by = ROAD_YS[0]; bd = Infinity;
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d < bd) { bd = d; by = ry; } }
  // Return the closest point on the closest road centre line.
  if (Math.abs(x - bx) <= Math.abs(y - by)) return { x: bx, y: clamp(y, ROAD_YS[0], ROAD_YS[ROWS - 1]), vertical: true };
  return { x: clamp(x, ROAD_XS[0], ROAD_XS[COLS - 1]), y: by, vertical: false };
}

export function nearestIntersection(x, y) {
  let bx = ROAD_XS[0]; let bd = Infinity;
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } }
  let by = ROAD_YS[0]; bd = Infinity;
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d < bd) { bd = d; by = ry; } }
  return { x: bx, y: by };
}

// Push a circle (x, y, r) out of every solid it overlaps. Returns corrected pos.
export function collideCircle(city, x, y, r) {
  let nx = x; let ny = y;
  for (const s of city.solids) {
    const cx = clamp(nx, s.x, s.x + s.w);
    const cy = clamp(ny, s.y, s.y + s.h);
    const dx = nx - cx; const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = nx - s.x; const pr = s.x + s.w - nx;
      const pt = ny - s.y; const pb = s.y + s.h - ny;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) nx = s.x - r; else if (m === pr) nx = s.x + s.w + r;
      else if (m === pt) ny = s.y - r; else ny = s.y + s.h + r;
    }
  }
  nx = clamp(nx, 8, WORLD_W - 8);
  ny = clamp(ny, 8, WORLD_H - 8);
  return { x: nx, y: ny };
}

// Is a point inside any solid (used for spawn validation)?
export function insideSolid(city, x, y) {
  for (const s of city.solids) if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
  return false;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: pick(rng, ROAD_XS) + (rng() < 0.5 ? -24 : 24), y: range(rng, ROAD_YS[0], ROAD_YS[ROWS - 1]) };
  return { x: range(rng, ROAD_XS[0], ROAD_XS[COLS - 1]), y: pick(rng, ROAD_YS) + (rng() < 0.5 ? -24 : 24) };
}
