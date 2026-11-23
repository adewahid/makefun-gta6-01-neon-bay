// Solmar Bay — vehicles: car entities, player driving physics, and the
// traffic system. Traffic cars follow the road grid's lanes and turn at
// intersections; the player's car uses arcade physics with drift.
import {
  CAR_TYPES, ROAD_W, ROAD_XS, ROAD_YS, WORLD_W, WORLD_H,
  clamp, dist, angleDiff, pick, range, irange,
} from './config.js';
import { collideCircle, nearestRoadPoint, onRoad, randomRoadPoint } from './city.js';

let carId = 1;

export function makeCar(type, x, y, angle, opts = {}) {
  const spec = CAR_TYPES[type];
  return {
    id: carId++, type, spec,
    x, y, angle: angle || 0,
    speed: 0, steer: 0,
    color: opts.color || pick(Math.random, spec.colors),
    driver: opts.driver || 'traffic', // 'player' | 'traffic' | 'police' | 'parked' | 'target'
    health: 100,
    stuck: 0, reverse: 0,
    brakeLight: false, siren: false,
    dead: false, smoke: 0,
  };
}

// Spawn a parked car on a roadside (used for stealable cars + mission cars).
export function spawnParkedCar(city, rng, type) {
  for (let tries = 0; tries < 40; tries++) {
    const p = randomRoadPoint(rng);
    const vertical = rng() < 0.5;
    const x = vertical ? p.x + (rng() < 0.5 ? -ROAD_W / 2 - 14 : ROAD_W / 2 + 14) : p.x;
    const y = vertical ? p.y : p.y + (rng() < 0.5 ? -ROAD_W / 2 - 14 : ROAD_W / 2 + 14);
    if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20) continue;
    if (city.beach && x < city.beach.w + 10) continue;
    const ang = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(type || pick(rng, ['compact', 'sedan', 'sports', 'van']), x, y, ang, { driver: 'parked' });
    return car;
  }
  return makeCar('sedan', ROAD_XS[2], ROAD_YS[2], 0, { driver: 'parked' });
}

export function spawnTrafficCar(city, rng, near) {
  const p = near || randomRoadPoint(rng);
  const vertical = Math.abs(p.x - (ROAD_XS.reduce((a, b) => Math.abs(p.x - b) < Math.abs(p.x - a) ? b : a))) <
    Math.abs(p.y - (ROAD_YS.reduce((a, b) => Math.abs(p.y - b) < Math.abs(p.y - a) ? b : a)));
  const type = pick(rng, ['compact', 'compact', 'sedan', 'sedan', 'sports', 'van', 'taxi']);
  const car = makeCar(type, p.x, p.y, vertical ? Math.PI / 2 : 0, { driver: 'traffic' });
  car.roadVertical = vertical;
  car.roadLine = vertical ? car.x : car.y;
  car.dir = rng() < 0.5 ? 1 : -1;
  car.cruise = range(rng, 110, 170);
  car.lane = (rng() < 0.5 ? -1 : 1) * 22;
  car.speed = car.cruise;
  return car;
}

// --- player driving ----------------------------------------------------------
export function drivePlayerCar(S, car, dt, input) {
  const spec = car.spec;
  const fwd = input.held('up') ? 1 : 0;
  const rev = input.held('down') ? 1 : 0;
  const steerIn = input.axisX();
  const handbrake = input.held('handbrake') || input.held('shift');

  if (fwd) car.speed += spec.accel * dt;
  if (rev) car.speed -= (car.speed > 5 ? spec.accel * 1.4 : spec.accel * 0.6) * dt;
  if (!fwd && !rev) car.speed *= Math.pow(0.4, dt); // coast
  if (handbrake) car.speed *= Math.pow(0.08, dt);
  car.speed = clamp(car.speed, -spec.top * 0.45, spec.top);

  const steerTarget = steerIn * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turnRate = car.steer * spec.grip * clamp(Math.abs(car.speed) / 120, 0, 1) * (handbrake ? 1.5 : 1);
  car.angle += turnRate * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1) * 0.55;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideCircle(S.city, nx, ny, 16);
  if (Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5) {
    if (Math.abs(car.speed) > 160 && !car._crashCd) {
      car.health -= 8; car._crashCd = 1;
      S.audio.crash();
      S.particles.burst(car.x, car.y, 10, '#ffb347');
      S.player.health = Math.max(1, S.player.health - 2);
    }
    car.speed *= 0.55;
  }
  car.x = hit.x; car.y = hit.y;
  car._crashCd = Math.max(0, (car._crashCd || 0) - dt);
  car.brakeLight = rev || handbrake;
  // Keep the player's position in sync with the car: missions, police and
  // the HUD all read S.player.x/y.
  S.player.x = car.x; S.player.y = car.y; S.player.angle = car.angle;

  // Skid marks + smoke when damaged.
  if (handbrake && Math.abs(car.speed) > 120) S.particles.skid(car.x, car.y, car.angle);
  if (car.health < 35) {
    car.smoke += dt;
    if (car.smoke > 0.12) { car.smoke = 0; S.particles.smoke(car.x, car.y); }
  }
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    S.particles.explosion(car.x, car.y);
    S.audio.explosion();
    if (S.player.inCar === car) exitCar(S, true);
  }
}

export function enterCar(S, car) {
  S.player.inCar = car;
  car.driver = 'player';
  S.player.x = car.x; S.player.y = car.y;
  S.audio.click();
  if (car._parkedSteal) { car._parkedSteal = false; S.police.addHeat(S, 1, 'Grand theft auto'); }
}

export function exitCar(S, wrecked) {
  const car = S.player.inCar;
  if (!car) return;
  car.driver = wrecked ? 'parked' : 'parked';
  car.speed = 0;
  const px = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  const py = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  const pos = collideCircle(S.city, px, py, 12);
  S.player.x = pos.x; S.player.y = pos.y;
  S.player.inCar = null;
}

// --- traffic AI ---------------------------------------------------------------
export function updateTraffic(S, dt) {
  const cars = S.cars;
  const playerPos = S.player.inCar || S.player;
  for (const car of cars) {
    if (car.driver !== 'traffic') continue;
    // Pick a road line to follow.
    if (car.roadVertical) {
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.y += car.dir * car.speed * dt;
      car.x += ((car.roadLine + car.lane) - car.x) * Math.min(1, dt * 3);
      // At an intersection, maybe turn onto a cross street.
      for (const ry of ROAD_YS) {
        if (Math.abs(car.y - ry) < car.speed * dt * 0.6 && Math.random() < 0.3) {
          car.roadVertical = false; car.roadLine = ry;
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.lane = (Math.random() < 0.5 ? -1 : 1) * 22;
          break;
        }
      }
      if (car.y > WORLD_H - 60) { car.dir = -1; }
      if (car.y < 60) { car.dir = 1; }
    } else {
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.x += car.dir * car.speed * dt;
      car.y += ((car.roadLine + car.lane) - car.y) * Math.min(1, dt * 3);
      for (const rx of ROAD_XS) {
        if (Math.abs(car.x - rx) < car.speed * dt * 0.6 && Math.random() < 0.3) {
          car.roadVertical = true; car.roadLine = rx;
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.lane = (Math.random() < 0.5 ? -1 : 1) * 22;
          break;
        }
      }
      if (car.x > WORLD_W - 60) { car.dir = -1; }
      if (car.x < 60) { car.dir = 1; }
    }
    // Slow down for the car ahead and for the player.
    let target = car.cruise;
    for (const other of cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = Math.cos(angleDiff(car.angle, Math.atan2(other.y - car.y, other.x - car.x))) > 0.5;
        if (ahead) target = Math.min(target, 40);
      }
    }
    const pd = dist(car.x, car.y, playerPos.x, playerPos.y);
    if (pd < 60) target = Math.min(target, 30);
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    // Keep traffic inside the world and out of buildings (roads are clear).
    car.x = clamp(car.x, 30, WORLD_W - 30);
    car.y = clamp(car.y, 30, WORLD_H - 30);
  }
  // Keep traffic density up near the player, cull far cars.
  const near = cars.filter((c) => c.driver === 'traffic' && dist(c.x, c.y, playerPos.x, playerPos.y) < 1600).length;
  if (near < 14) {
    const p = randomRoadPoint(S.rng);
    // Spawn off-screen relative to the player when possible.
    const c = spawnTrafficCar(S.city, S.rng, p);
    if (dist(c.x, c.y, playerPos.x, playerPos.y) > 500) cars.push(c);
  }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.driver === 'traffic' && dist(c.x, c.y, playerPos.x, playerPos.y) > 1900) cars.splice(i, 1);
    if (c.dead && c.driver !== 'player') cars.splice(i, 1);
  }
}

// The mission target car (mission 6): drives a loop around the city.
export function updateTargetCar(S, dt) {
  const car = S.targetCar;
  if (!car) return;
  car.speed = 150;
  // Follow a rectangular loop: waypoints around Downtown.
  const wp = car.waypoints;
  const t = wp[car.wpIndex];
  const d = dist(car.x, car.y, t.x, t.y);
  if (d < 60) { car.wpIndex = (car.wpIndex + 1) % wp.length; return; }
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  car.angle += clamp(angleDiff(car.angle, want), -1.8 * dt, 1.8 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}
