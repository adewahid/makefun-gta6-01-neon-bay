// police.js — the wanted system and the Bay PD.
// Wanted runs 0–5 stars. Crimes add heat; heat decays when the player
// keeps clean. Police cruisers spawn at the city edge and chase the
// player; on foot, officers close in and can bust the player. A cruiser
// that rams the player's car hard damages it; a wrecked car strands the
// player on foot.

import { makeRng } from './random.js';

const MAX_WANTED = 5;

export function createPolice(city, seed) {
  const rng = makeRng(seed + 303);
  const cruisers = [];
  let spawnTimer = 0;

  function spawnCruiserNear(x, y) {
    // Spawn on a road 500–700 px away so the chase arrives, not teleports.
    for (let tries = 0; tries < 12; tries++) {
      const angle = rng.range(0, Math.PI * 2);
      const px = x + Math.cos(angle) * rng.range(480, 680);
      const py = y + Math.sin(angle) * rng.range(480, 680);
      if (px < 60 || px > 2240 || py < 60 || py > 2540) continue;
      const avenue = city.avenues.reduce((best, a) => (Math.abs(a - px) < Math.abs(best - px) ? a : best), city.avenues[0]);
      const street = city.streets.reduce((best, s) => (Math.abs(s - py) < Math.abs(best - py) ? s : best), city.streets[0]);
      const sx = Math.abs(avenue - px) < Math.abs(street - py) ? avenue : px;
      const sy = Math.abs(avenue - px) < Math.abs(street - py) ? py : street;
      cruisers.push({
        x: sx, y: sy, angle: rng.range(0, Math.PI * 2),
        speed: 0,
        color: '#1d3557', w: 34, h: 18, siren: true,
        ramCooldown: 0,
      });
      return;
    }
  }

  return {
    cruisers,
    // wanted count for this many stars: more cruisers on the street
    // (none at all while the player is clean)
    wantedCruisers(wanted) {
      if (wanted <= 0) return 0;
      return Math.min(wanted + 1, 6);
    },
    update(dt, player, wanted) {
      const want = this.wantedCruisers(wanted);
      spawnTimer -= dt;
      if (cruisers.length < want && spawnTimer <= 0) {
        spawnCruiserNear(player.x, player.y);
        spawnTimer = 1.2;
      }
      // Extra cruisers leave when the heat dies down.
      while (cruisers.length > want) cruisers.pop();

      for (const c of cruisers) {
        c.ramCooldown -= dt;
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - c.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
        const desired = dist > 320 ? 330 : 250;
        c.speed += (desired - c.speed) * Math.min(1, dt * 1.4);
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
      }
    },
    clear() {
      cruisers.length = 0;
    },
  };
}

export { MAX_WANTED };

// Heat added by each crime, in stars (fractional, shown rounded up).
export const HEAT = {
  stealCar: 1,
  punchPed: 1,
  hitPed: 1,
  ramPolice: 1,
  speedNearCop: 0, // driving fast alone is not a crime
};
