// Actors: the player, drivable cars, traffic, pedestrians, police and
// pickups. Movement is plain 2D physics with circle-vs-building collision.
import { WORLD, ROADS, ROAD_W, CAR_DEFS, PLAYER, PED_SHIRTS, COP_COUNT } from './config.js';
import { makeRng, clamp, dist, angleTo, angleDiff } from './random.js';
import { resolveCircle, isOnRoad, randomRoadPoint } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.healthMax, armor: 0,
    money: 0, inCar: null, onFoot: true,
    punchCd: 0, shootCd: 0, ammo: 24, hasGun: true,
    bustedT: 0, speed: 0, moving: false,
  };
}

export function createCar(defIndex, x, y, angle) {
  const def = CAR_DEFS[defIndex];
  return {
    defIndex, def, x, y, angle, speed: 0,
    vx: 0, vy: 0, health: 100, color: def.color,
    traffic: false, cop: false, target: null, stuckT: 0,
    smokeT: 0, dead: false, driver: null,
  };
}

// A car drives with simple arcade physics: velocity follows heading with
// lateral grip, so it drifts a little at speed.
export function driveCar(car, throttle, steer, dt, handbrake) {
  const def = car.def;
  const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
  const accel = def.accel * (throttle !== 0 ? Math.abs(throttle) : 0);
  car.speed += forward * accel * dt;
  if (throttle === 0) car.speed *= Math.pow(0.4, dt);
  if (handbrake) car.speed *= Math.pow(0.05, dt);
  const max = def.max * (car.health < 30 ? 0.55 : 1);
  car.speed = clamp(car.speed, -max * 0.45, max);
  const spd = Math.abs(car.speed);
  const turnRate = def.turn * clamp(spd / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * turnRate * dt * (handbrake ? 1.5 : 1);
  const nx = Math.cos(car.angle), ny = Math.sin(car.angle);
  // Blend velocity toward heading for grip, keep a little slide.
  const grip = handbrake ? 2.2 : 7.0;
  const k = 1 - Math.exp(-grip * dt);
  car.vx += (nx * car.speed - car.vx) * k;
  car.vy += (ny * car.speed - car.vy) * k;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  return Math.hypot(car.vx, car.vy);
}

export function collideCarWorld(car, city, dt) {
  const r = 20;
  const before = { x: car.x, y: car.y };
  const res = resolveCircle(car.x, car.y, r, city);
  car.x = res.x; car.y = res.y;
  if (res.hit) {
    const impact = Math.hypot(car.vx, car.vy);
    car.vx *= -0.25; car.vy *= -0.25;
    car.speed *= 0.4;
    if (impact > 180) {
      car.health -= impact * 0.03;
      return impact;
    }
  }
  car.x = clamp(car.x, 20, WORLD - 20);
  car.y = clamp(car.y, 20, WORLD - 20);
  return 0;
}

export function carsCollide(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = 34;
  if (d < min && d > 0.01) {
    const push = (min - d) / 2;
    const nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
    a.x += nx * push; a.y += ny * push;
    b.x -= nx * push; b.y -= ny * push;
    const swap = a.speed; a.speed = b.speed * 0.5; b.speed = swap * 0.5;
    return true;
  }
  return false;
}

// --- traffic -----------------------------------------------------------
export function spawnTrafficCar(rng, city, player) {
  const p = randomRoadPoint(rng);
  if (dist(p.x, p.y, player.x, player.y) < 500) return null;
  const vertical = rng.chance(0.5);
  const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
    : (rng.chance(0.5) ? 0 : Math.PI);
  const car = createCar(Math.floor(rng.range(0, 4)), p.x, p.y, angle);
  car.traffic = true;
  car.speed = rng.range(90, 150);
  car.target = pickNextTarget(car, rng);
  return car;
}

function pickNextTarget(car, rng) {
  // Drive along the current road to a random intersection, then turn.
  const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
  const road = vertical
    ? ROADS.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a)
    : ROADS.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
  const dest = ROADS[Math.floor(rng.next() * ROADS.length)];
  return { vertical, road, dest, axis: vertical ? car.x : car.y };
}

export function updateTraffic(car, dt, rng, city) {
  if (!car.target) car.target = pickNextTarget(car, rng);
  const t = car.target;
  const turnAt = t.dest;
  let arrived = false;
  if (t.vertical) {
    const dy = turnAt - car.y;
    if (Math.abs(dy) < 14) arrived = true;
    else {
      const want = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    }
  } else {
    const dx = turnAt - car.x;
    if (Math.abs(dx) < 14) arrived = true;
    else {
      const want = dx > 0 ? 0 : Math.PI;
      car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    }
  }
  if (arrived) car.target = pickNextTarget(car, rng);
  // Ease toward cruise speed and roll forward.
  car.speed += (130 - car.speed) * Math.min(1, dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const res = resolveCircle(car.x, car.y, 20, city);
  car.x = res.x; car.y = res.y;
  car.stuckT += dt;
}

// --- pedestrians ---------------------------------------------------------
export function spawnPed(rng, city, player) {
  const p = randomRoadPoint(rng);
  if (dist(p.x, p.y, player.x, player.y) < 350) return null;
  const vertical = rng.chance(0.5);
  return {
    x: p.x + (vertical ? 62 : 0), y: p.y + (vertical ? 0 : 62),
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    shirt: PED_SHIRTS[Math.floor(rng.next() * PED_SHIRTS.length)],
    flee: 0, dead: false, panicked: false,
    walkPhase: rng.range(0, Math.PI * 2),
  };
}

export function updatePed(ped, dt, rng, city, danger) {
  if (ped.dead) return;
  if (danger) { ped.flee = 2.5; ped.panicked = true; }
  let wantAngle = ped.angle;
  if (ped.flee > 0) {
    ped.flee -= dt;
    wantAngle = angleTo(danger.x, danger.y, ped.x, ped.y);
    ped.speed = 130;
  } else {
    ped.speed = 40;
    if (rng.chance(dt * 0.12)) {
      // Turn at random onto a crossing street.
      wantAngle = Math.floor(rng.next() * 4) * (Math.PI / 2);
    }
  }
  ped.angle += clamp(angleDiff(ped.angle, wantAngle), -3 * dt, 3 * dt);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  const res = resolveCircle(ped.x, ped.y, 9, city);
  ped.x = res.x; ped.y = res.y;
  ped.walkPhase += dt * (ped.flee > 0 ? 14 : 7);
}

// --- police --------------------------------------------------------------
export function spawnCop(rng, city, player) {
  const a = rng.range(0, Math.PI * 2);
  const x = clamp(player.x + Math.cos(a) * 700, 80, WORLD - 80);
  const y = clamp(player.y + Math.sin(a) * 700, 80, WORLD - 80);
  const near = { x, y };
  const road = (() => {
    let best = null, bd = Infinity;
    for (const rx of ROADS) for (const ry of ROADS) {
      const d = Math.hypot(rx - x, ry - y);
      if (d < bd) { bd = d; best = { x: rx, y: ry }; }
    }
    return best;
  })();
  const car = createCar(4, road.x, road.y, angleTo(road.x, road.y, player.x, player.y));
  car.cop = true;
  car.speed = 200;
  return car;
}

export function updateCop(car, player, dt, city) {
  const tx = player.inCar ? player.inCar.x : player.x;
  const ty = player.inCar ? player.inCar.y : player.y;
  const want = angleTo(car.x, car.y, tx, ty);
  const d = dist(car.x, car.y, tx, ty);
  const steer = clamp(angleDiff(car.angle, want), -1, 1);
  const throttle = d > 60 ? 1 : 0.4;
  driveCar(car, throttle, steer, dt, false);
  collideCarWorld(car, city, dt);
  return d;
}

export function wantedCopCount(level) {
  return COP_COUNT[Math.min(level, 5)];
}

// --- pickups ---------------------------------------------------------------
export function spawnPickups(rng, city) {
  const list = [];
  const kinds = ['cash', 'cash', 'cash', 'health', 'repair', 'ammo'];
  for (let i = 0; i < 26; i++) {
    const p = randomRoadPoint(rng);
    const kind = kinds[i % kinds.length];
    const off = kind === 'cash' ? 0 : 0;
    list.push({
      kind,
      x: clamp(p.x + rng.range(-70, 70), 60, WORLD - 60),
      y: clamp(p.y + rng.range(-70, 70), 60, WORLD - 60),
      value: kind === 'cash' ? rng.int(50, 300) : 0,
      taken: false, bob: rng.range(0, Math.PI * 2),
    });
  }
  return list;
}
