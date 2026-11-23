// Solmar Bay — the wanted system and the SCPD. Stars rise with crime and
// fall when the player stays unseen; police cars spawn, chase and ram, and
// at higher stars officers get out on foot and try to make the arrest.
// At five stars a police helicopter keeps the heat on.
import {
  WANTED, WORLD_W, WORLD_H, clamp, dist, angleDiff, angleTo,
} from './config.js';
import { makeCar } from './vehicles.js';
import { collideCircle, nearestRoadPoint } from './city.js';

export function createPolice() {
  return {
    wanted: 0,
    heat: 0,            // fractional heat feeding star changes
    unseenTimer: 0,
    decayTimer: 0,
    sirenTimer: 0,
    heli: null,
    addHeat(S, stars, reason) {
      if (S.mode !== 'play') return;
      this.heat = clamp(this.heat + stars, 0, WANTED.maxStars);
      const nw = Math.floor(this.heat);
      if (nw > this.wanted) {
        this.wanted = nw;
        S.hud.flash(`WANTED LEVEL ${nw} — ${reason}`);
        if (nw >= 1) S.audio.siren(true);
      }
      this.unseenTimer = 0;
    },
  };
}

export function updatePolice(S, dt) {
  const P = S.police;
  const playerPos = S.player.inCar || S.player;

  // Wanted decay: lose stars only while no cop can see the player.
  const nearestCop = S.cops.reduce((m, c) => Math.min(m, dist(c.x, c.y, playerPos.x, playerPos.y)), Infinity);
  const seen = nearestCop < 560;
  if (P.wanted > 0) {
    if (seen) { P.unseenTimer = 0; P.decayTimer = 0; }
    else {
      P.unseenTimer += dt;
      if (P.unseenTimer > WANTED.decayDelay) {
        P.decayTimer += dt;
        if (P.decayTimer >= WANTED.decayStep) {
          P.decayTimer = 0;
          P.wanted = Math.max(0, P.wanted - 1);
          P.heat = P.wanted;
          S.hud.flash(P.wanted === 0 ? 'CLEAN — heat is off' : `Wanted down to ${P.wanted} star${P.wanted > 1 ? 's' : ''}`);
        }
      }
    }
  }

  // Spawn cops to match the wanted level.
  const want = WANTED.copsPerStar[P.wanted];
  const live = S.cops.filter((c) => !c.leaving).length;
  if (live < want) {
    const rp = nearestRoadPoint(playerPos.x + (Math.random() < 0.5 ? -700 : 700), playerPos.y + (Math.random() < 0.5 ? -500 : 500));
    const car = makeCar('police', clamp(rp.x, 60, WORLD_W - 60), clamp(rp.y, 60, WORLD_H - 60), 0, { driver: 'police' });
    car.siren = true;
    car.speed = 200;
    S.cops.push(car);
    S.cars.push(car);
  }
  // Cops leave when the heat is off.
  if (P.wanted === 0) for (const c of S.cops) c.leaving = true;

  // Siren wail.
  P.sirenTimer -= dt;
  if (S.cops.length > 0 && P.sirenTimer <= 0) {
    P.sirenTimer = 1.1;
    S.audio.siren(Math.random() < 0.5);
  }

  // Helicopter at 5 stars.
  if (P.wanted >= 5 && !P.heli) P.heli = { x: playerPos.x, y: playerPos.y - 260, rotor: 0 };
  if (P.wanted < 5) P.heli = null;
  if (P.heli) {
    P.heli.rotor += dt * 22;
    P.heli.x += (playerPos.x - P.heli.x) * Math.min(1, dt * 0.8);
    P.heli.y += (playerPos.y - P.heli.y) * Math.min(1, dt * 0.8);
  }

  // Police car pursuit.
  for (const cop of S.cops) {
    if (cop.leaving) {
      // Drive away and despawn.
      cop.angle += 0.5 * dt;
      cop.x += Math.cos(cop.angle) * 260 * dt;
      cop.y += Math.sin(cop.angle) * 260 * dt;
      if (dist(cop.x, cop.y, playerPos.x, playerPos.y) > 1500) cop.gone = true;
      continue;
    }
    const d = dist(cop.x, cop.y, playerPos.x, playerPos.y);
    const wantAngle = angleTo(cop.x, cop.y, playerPos.x, playerPos.y);
    const top = WANTED.copSpeed[P.wanted] || 330;
    cop.angle += clamp(angleDiff(cop.angle, wantAngle), -2.6 * dt, 2.6 * dt);
    cop.speed = Math.min(top, cop.speed + 240 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const hit = collideCircle(S.city, cop.x, cop.y, 16);
    if (Math.abs(hit.x - cop.x) > 0.5 || Math.abs(hit.y - cop.y) > 0.5) {
      cop.speed *= 0.5;
      cop.angle += 0.9 * dt;
    }
    cop.x = hit.x; cop.y = hit.y;

    // Ram the player's car; batter the player on foot.
    if (d < 34) {
      if (S.player.inCar) {
        const pc = S.player.inCar;
        pc.health -= 14 * dt;
        pc.speed *= 0.92;
        cop.speed *= 0.7;
        if (Math.random() < dt * 2) { S.audio.crash(); S.particles.burst(cop.x, cop.y, 6, '#ffb347'); }
        if (pc.health <= 0 && !pc.dead) { pc.dead = true; S.particles.explosion(pc.x, pc.y); S.audio.explosion(); }
      } else if (P.wanted >= 3 && !cop._footCop) {
        // An officer gets out and chases on foot.
        cop._footCop = { x: cop.x, y: cop.y, arrest: 0 };
      }
    }
    // On-foot arrest attempt.
    if (cop._footCop) {
      const f = cop._footCop;
      const fd = dist(f.x, f.y, S.player.x, S.player.y);
      const fa = angleTo(f.x, f.y, S.player.x, S.player.y);
      f.x += Math.cos(fa) * 150 * dt;
      f.y += Math.sin(fa) * 150 * dt;
      if (fd < 26) {
        f.arrest += dt;
        if (f.arrest > 1.6) { S.main.busted(S); return; }
      } else f.arrest = Math.max(0, f.arrest - dt);
      if (fd > 700) cop._footCop = null;
    }
    // Despawn far cops when wanted drops.
    if (d > 1700 && P.wanted <= 2) cop.gone = true;
  }
  // Remove gone cops (and their cars).
  for (let i = S.cops.length - 1; i >= 0; i--) {
    if (S.cops[i].gone) {
      const idx = S.cars.indexOf(S.cops[i]);
      if (idx >= 0) S.cars.splice(idx, 1);
      S.cops.splice(i, 1);
    }
  }
}
