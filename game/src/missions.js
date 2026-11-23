// Solmar Bay — the story: seven jobs for fixer Marisol Vega, each a different
// kind of mission. A mission is a small state machine: start() sets it up,
// update() advances it and returns 'done' | 'failed' | null, and
// objective()/target() feed the HUD and the minimap.
import {
  ROAD_XS, ROAD_YS, MISSION_REWARDS, clamp, dist, fmtCash,
} from './config.js';
import { makeCar } from './vehicles.js';
import { randomRoadPoint } from './city.js';
import { hurtPlayer } from './player.js';

export const SAFEHOUSE = { x: ROAD_XS[1] + 180, y: ROAD_YS[7] };
export const CASINO = { x: ROAD_XS[2] + 180, y: ROAD_YS[7] };
export const DOCKS = { x: ROAD_XS[8] + 180, y: ROAD_YS[7] };
export const GARAGE = { x: ROAD_XS[3] + 180, y: ROAD_YS[2] };

function stopPoints(S, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(S.rng);
    pts.push({ x: p.x, y: p.y });
  }
  return pts;
}

function spawnEnemy(S, x, y) {
  return { x, y, hp: 100, shootCd: 1 + Math.random(), dead: false, angle: 0, speed: 95 };
}

export const MISSIONS = [
  {
    id: 'first-wheels', title: '1 — First Wheels',
    brief: 'Marisol needs a driver. Steal the red Vortex GT by the marina and bring it to the garage on Palm Row.',
    start(S) {
      const car = makeCar('sports', ROAD_XS[0] + 130, ROAD_YS[4] + 40, Math.PI / 2, { driver: 'parked', color: '#d21f3c' });
      car._gift = true; // M1's car is a gift from Marisol: no heat for taking it.
      S.cars.push(car);
      S.mission.car = car;
      S.mission.stage = 0;
    },
    objective(S) { return S.mission.stage === 0 ? 'Get in the red Vortex GT (press E)' : 'Drive the Vortex to the garage'; },
    target(S) { return S.mission.stage === 0 ? { x: S.mission.car.x, y: S.mission.car.y } : GARAGE; },
    update(S) {
      if (S.mission.stage === 0 && S.player.inCar === S.mission.car) S.mission.stage = 1;
      else if (S.mission.stage === 1 && S.player.inCar === S.mission.car && dist(S.player.x, S.player.y, GARAGE.x, GARAGE.y) < 90) return 'done';
      return null;
    },
  },
  {
    id: 'hot-delivery', title: '2 — Hot Delivery',
    brief: 'Three packages, three corners of the city, one very impatient clock. 150 seconds. Don\'t scratch the paint.',
    start(S) {
      S.mission.stops = stopPoints(S, 3);
      S.mission.stopIndex = 0;
      S.mission.timer = 150;
    },
    objective(S) {
      const left = Math.max(0, Math.ceil(S.mission.timer));
      return `Deliver package ${S.mission.stopIndex + 1} of 3 — ${left}s left`;
    },
    target(S) { return S.mission.stops[S.mission.stopIndex]; },
    update(S, dt) {
      S.mission.timer -= dt;
      if (S.mission.timer <= 0) return 'failed';
      const t = S.mission.stops[S.mission.stopIndex];
      if (dist(S.player.x, S.player.y, t.x, t.y) < 70) {
        S.audio.cash();
        S.player.cash += 100;
        S.mission.stopIndex++;
        if (S.mission.stopIndex >= S.mission.stops.length) return 'done';
        S.hud.flash('Package delivered — next stop marked');
      }
      return null;
    },
  },
  {
    id: 'cash-run', title: '3 — Cash Run',
    brief: 'Six drops of Marisol\'s money are stashed around Solmar. Scoop them all up. The cops already know your face — 1 star from the start.',
    start(S) {
      S.mission.drops = stopPoints(S, 6).map((p) => ({ ...p, taken: false }));
      S.mission.left = 6;
      S.police.addHeat(S, 1, 'Known associate');
    },
    objective(S) { return `Collect the cash drops — ${S.mission.left} left`; },
    target(S) { const d = S.mission.drops.find((x) => !x.taken); return d || null; },
    update(S) {
      for (const d of S.mission.drops) {
        if (!d.taken && dist(S.player.x, S.player.y, d.x, d.y) < 46) {
          d.taken = true; S.mission.left--;
          S.audio.cash(); S.player.cash += 200;
          S.particles.burst(d.x, d.y, 10, '#7dff6a');
          if (S.mission.left <= 0) return 'done';
        }
      }
      return null;
    },
  },
  {
    id: 'the-getaway', title: '4 — The Getaway',
    brief: 'You lifted a Gull lieutenant\'s ride and the whole SCPD is on you — 3 stars. Survive 60 seconds, then vanish into the safehouse.',
    start(S) {
      S.mission.timer = 60;
      S.mission.stage = 0;
      S.police.addHeat(S, 3, 'Stolen Gull ride');
    },
    objective(S) {
      return S.mission.stage === 0
        ? `Stay free — ${Math.max(0, Math.ceil(S.mission.timer))}s until the heat cools`
        : 'Lose them — reach the safehouse';
    },
    target(S) { return S.mission.stage === 1 ? SAFEHOUSE : null; },
    update(S, dt) {
      if (S.mission.stage === 0) {
        S.mission.timer -= dt;
        if (S.mission.timer <= 0) { S.mission.stage = 1; S.hud.flash('Now — get to the safehouse'); }
      } else if (dist(S.player.x, S.player.y, SAFEHOUSE.x, SAFEHOUSE.y) < 90) return 'done';
      return null;
    },
  },
  {
    id: 'dockside-dustup', title: '5 — Dockside Dust-Up',
    brief: 'The Gulls are moving product through the docks. Marisol wants the shipment stopped — permanently. Six armed crew. You have a pistol. Make it count.',
    start(S) {
      S.player.ammo = Math.max(S.player.ammo, 72);
      S.enemies = [];
      for (let i = 0; i < 6; i++) {
        S.enemies.push(spawnEnemy(S, DOCKS.x + (Math.random() - 0.5) * 320, DOCKS.y + (Math.random() - 0.5) * 240));
      }
      S.mission.left = 6;
    },
    objective(S) { return `Clear the docks — ${S.mission.left} Gull crew left`; },
    target(S) { const e = S.enemies.find((x) => !x.dead); return e ? { x: e.x, y: e.y } : DOCKS; },
    update(S, dt) {
      // Enemy AI: close in and shoot at the player.
      for (const e of S.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, S.player.x, S.player.y);
        const inCar = !!S.player.inCar;
        const tx = inCar ? S.player.inCar.x : S.player.x;
        const ty = inCar ? S.player.inCar.y : S.player.y;
        if (d > 260) {
          const a = Math.atan2(ty - e.y, tx - e.x);
          e.angle = a;
          e.x += Math.cos(a) * e.speed * dt;
          e.y += Math.sin(a) * e.speed * dt;
        } else {
          e.angle = Math.atan2(ty - e.y, tx - e.x);
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = 1.2 + Math.random() * 0.8;
            S.audio.shot();
            S.particles.tracer(e.x, e.y, tx, ty);
            if (Math.random() < 0.25) {
              if (inCar) {
                const pc = S.player.inCar;
                pc.health -= 6;
                if (pc.health <= 0 && !pc.dead) { pc.dead = true; S.particles.explosion(pc.x, pc.y); }
              } else hurtPlayer(S, 8);
            }
          }
        }
      }
      const left = S.enemies.filter((e) => !e.dead).length;
      if (left !== S.mission.left) { S.mission.left = left; if (left === 0) return 'done'; }
      return null;
    },
  },
  {
    id: 'tail-the-gull', title: '6 — Tail the Gull',
    brief: 'A Gull courier is running the route. Follow him for 45 seconds — close enough to see, far enough not to be seen. Closer than 90px and he burns you.',
    start(S) {
      const car = makeCar('sedan', ROAD_XS[5] + 40, ROAD_YS[2], 0, { driver: 'target', color: '#2f2a33' });
      car.waypoints = [
        { x: ROAD_XS[8], y: ROAD_YS[2] }, { x: ROAD_XS[8], y: ROAD_YS[6] },
        { x: ROAD_XS[3], y: ROAD_YS[6] }, { x: ROAD_XS[3], y: ROAD_YS[2] },
      ];
      car.wpIndex = 0;
      S.cars.push(car);
      S.targetCar = car;
      S.mission.hold = 0;
      S.mission.spotted = 0;
    },
    objective(S) {
      return `Stay on the courier — ${Math.floor(S.mission.hold)}s / 45s (don't get closer than 90px)`;
    },
    target(S) { return S.targetCar ? { x: S.targetCar.x, y: S.targetCar.y } : null; },
    update(S, dt) {
      const t = S.targetCar;
      if (!t) return 'failed';
      const d = dist(S.player.x, S.player.y, t.x, t.y);
      if (d < 90) {
        S.mission.spotted += dt;
        S.hud.flash('TOO CLOSE — he sees you!');
        if (S.mission.spotted > 2) return 'failed';
      } else if (d < 340) {
        S.mission.hold += dt;
        if (S.mission.hold >= 45) return 'done';
      } else {
        S.mission.hold = Math.max(0, S.mission.hold - dt * 0.5);
      }
      return null;
    },
  },
  {
    id: 'the-big-score', title: '7 — The Big Score',
    brief: 'The Coral Crown casino vault, Friday night. Get inside, crack the vault, grab the take — then outrun a 4-star storm to the safehouse. This is the one they\'ll tell stories about.',
    start(S) {
      S.mission.stage = 0;
      S.mission.crack = 0;
    },
    objective(S) {
      if (S.mission.stage === 0) return 'Get to the Coral Crown casino';
      if (S.mission.stage === 1) return `Crack the vault — stay in the zone ${Math.floor(S.mission.crack * 10)}%`;
      if (S.mission.stage === 2) return 'Grab the take and RUN';
      return 'Escape to the safehouse — 4 stars on you';
    },
    target(S) {
      if (S.mission.stage === 3) return SAFEHOUSE;
      return CASINO;
    },
    update(S, dt) {
      if (S.mission.stage === 0) {
        if (dist(S.player.x, S.player.y, CASINO.x, CASINO.y) < 110) { S.mission.stage = 1; S.hud.flash('Inside — hold position at the vault'); }
      } else if (S.mission.stage === 1) {
        if (dist(S.player.x, S.player.y, CASINO.x, CASINO.y) < 130) {
          S.mission.crack += dt / 10;
          if (Math.random() < dt * 4) S.audio.click();
          if (S.mission.crack >= 1) {
            S.mission.stage = 2;
            S.player.cash += 1000;
            S.audio.cash();
            S.hud.flash('Vault open — $1,000 in hand, more in the bag');
          }
        }
      } else if (S.mission.stage === 2) {
        S.mission.stage = 3;
        S.police.addHeat(S, 4, 'Casino robbery');
        S.hud.flash('ALARM — every cop in Solmar is coming');
      } else if (dist(S.player.x, S.player.y, SAFEHOUSE.x, SAFEHOUSE.y) < 90) return 'done';
      return null;
    },
  },
];

export function startMission(S, index) {
  const m = MISSIONS[index];
  if (!m) return false;
  S.missions.index = index;
  S.missions.def = m;
  S.missions.state = 'active';
  S.mission = { stage: 0 };
  m.start(S);
  S.hud.banner(m.title, m.brief);
  return true;
}

export function updateMission(S, dt) {
  if (S.missions.state !== 'active' || !S.missions.def) return;
  const res = S.missions.def.update(S, dt);
  if (res === 'done') {
    const reward = MISSION_REWARDS[S.missions.index] || 500;
    S.player.cash += reward;
    S.missions.done++;
    S.missions.state = 'passed';
    S.missions.passTimer = 4;
    S.audio.missionDone();
    S.hud.missionPassed(S.missions.def.title, fmtCash(reward));
    S.stats.missionsPassed++;
    if (S.targetCar) { const i = S.cars.indexOf(S.targetCar); if (i >= 0) S.cars.splice(i, 1); S.targetCar = null; }
    S.enemies = [];
  } else if (res === 'failed') {
    S.missions.state = 'failed';
    S.missions.passTimer = 4;
    S.audio.missionFail();
    S.hud.missionFailed(S.missions.def.title);
    if (S.targetCar) { const i = S.cars.indexOf(S.targetCar); if (i >= 0) S.cars.splice(i, 1); S.targetCar = null; }
    S.enemies = [];
  }
}

export function currentObjective(S) {
  if (S.missions.state === 'active' && S.missions.def) return S.missions.def.objective(S);
  if (S.missions.done >= MISSIONS.length) return 'Story complete — free roam Solmar Bay';
  return 'Free roam — open the pause menu (P) to start the next job';
}

export function currentTarget(S) {
  if (S.missions.state === 'active' && S.missions.def) return S.missions.def.target(S);
  return null;
}
