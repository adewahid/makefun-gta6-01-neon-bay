// Solmar Bay — pedestrians: sidewalk walkers who stroll, chat, cross at
// intersections, and flee screaming from gunfire, fast cars and police.
import { WORLD_W, WORLD_H, ROAD_W, ROAD_XS, ROAD_YS, clamp, dist, pick, range } from './config.js';
import { collideCircle, onRoad } from './city.js';

const SKINS = ['#e8b88a', '#c98d5f', '#8a5a3a', '#f0c8a0', '#6b4a2f'];
const SHIRTS = ['#c94f4f', '#4f7ac9', '#4fc97a', '#e0d060', '#9a5fc9', '#e07ab0', '#5fc9c9', '#e8e8e8'];

export function makePed(rng, x, y) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 28, 52),
    skin: pick(rng, SKINS),
    shirt: pick(rng, SHIRTS),
    state: 'walk', // walk | flee | down
    panic: 0,
    target: null,
    bob: rng() * 10,
    fare: false, // taxi customer
    dead: false,
  };
}

export function spawnPeds(S, n) {
  for (let i = 0; i < n; i++) {
    const vertical = S.rng() < 0.5;
    let x; let y;
    if (vertical) { x = pick(S.rng, ROAD_XS) + (S.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14); y = range(S.rng, 60, WORLD_H - 60); }
    else { x = range(S.rng, 60, WORLD_W - 60); y = pick(S.rng, ROAD_YS) + (S.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14); }
    x = clamp(x, 20, WORLD_W - 20); y = clamp(y, 20, WORLD_H - 20);
    S.peds.push(makePed(S.rng, x, y));
  }
}

export function updatePeds(S, dt) {
  const px = S.player.x; const py = S.player.y;
  const playerCar = S.player.inCar;
  const danger = (x, y) => {
    // Gunfire / explosions near the ped, or a fast car bearing down.
    if (S.dangerPulse > 0 && dist(x, y, S.dangerX, S.dangerY) < 260) return true;
    if (playerCar && Math.abs(playerCar.speed) > 180 && dist(x, y, playerCar.x, playerCar.y) < 130) return true;
    for (const c of S.cops) if (c.onFoot && dist(x, y, c.x, c.y) < 90) return true;
    return false;
  };

  for (const p of S.peds) {
    if (p.state === 'down') continue;
    p.bob += dt * 8;
    if (danger(p.x, p.y)) { p.state = 'flee'; p.panic = 2.5; }
    if (p.state === 'flee') {
      p.panic -= dt;
      const away = Math.atan2(p.y - py, p.x - px);
      p.angle = away;
      p.x += Math.cos(away) * 130 * dt;
      p.y += Math.sin(away) * 130 * dt;
      if (p.panic <= 0) p.state = 'walk';
    } else {
      // Stroll along the sidewalk; at intersections sometimes turn.
      if (onRoad(p.x, p.y)) {
        // Drift back to the nearest sidewalk.
        const nx = p.x + Math.cos(p.angle) * p.speed * dt;
        const ny = p.y + Math.sin(p.angle) * p.speed * dt;
        p.x = nx; p.y = ny;
        if (Math.random() < dt * 0.08) p.angle += (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2;
      } else {
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        if (Math.random() < dt * 0.05) p.angle += (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 4);
      }
    }
    const pos = collideCircle(S.city, p.x, p.y, 10);
    p.x = pos.x; p.y = pos.y;
    // Hit by the player's car?
    if (playerCar && Math.abs(playerCar.speed) > 60 && dist(p.x, p.y, playerCar.x, playerCar.y) < 26) {
      p.state = 'down';
      S.police.addHeat(S, 1, 'Pedestrian down');
      S.particles.burst(p.x, p.y, 8, '#c94f4f');
      S.audio.crash();
      S.player.cash = Math.max(0, S.player.cash - 25);
    }
  }
  // Cull far peds, keep the streets alive near the player.
  const near = S.peds.filter((p) => p.state !== 'down' && dist(p.x, p.y, px, py) < 1500).length;
  if (near < 40) spawnPeds(S, 6);
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const p = S.peds[i];
    if (p.state === 'down') { p._downT = (p._downT || 0) + dt; if (p._downT > 12) S.peds.splice(i, 1); continue; }
    if (dist(p.x, p.y, px, py) > 1800 && !p.fare) S.peds.splice(i, 1);
  }
}
