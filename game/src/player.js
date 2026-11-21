// player.js — the player on foot and behind the wheel.
// On foot: WASD/arrows walk, F punches, E steals the nearest car.
// In a car: arcade driving — W accelerates, S brakes/reverses, A/D steer
// (steering scales with speed), E steps out. The car has health; a wreck
// strands the player on foot. The player has health too; at 0 they wake
// up at the hospital, poorer and clean.

import { HEAT } from './police.js';

export function createPlayer(city) {
  return {
    x: 650, y: 780, // Palm Plaza kerb, a car parked nearby
    angle: 0,
    speed: 0,
    onFoot: true,
    health: 100,
    car: null, // { x, y, angle, speed, health, color, w, h }
    punchTimer: 0,
    punchCooldown: 0,
    bustTimer: 0,
    invulnerableUntil: 0,
  };
}

const WALK_SPEED = 175;
const CAR_ACCEL = 320;
const CAR_MAX_SPEED = 430;
const CAR_REVERSE_MAX = 150;
const CAR_DRAG = 0.55;

export function updatePlayer(player, input, dt, world) {
  const { traffic, police, city, state } = world;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);

  if (player.onFoot) {
    let mx = 0;
    let my = 0;
    if (input.isDown('w', 'arrowup')) my -= 1;
    if (input.isDown('s', 'arrowdown')) my += 1;
    if (input.isDown('a', 'arrowleft')) mx -= 1;
    if (input.isDown('d', 'arrowright')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      player.angle = Math.atan2(my / len, mx / len);
      player.x += (mx / len) * WALK_SPEED * dt;
      player.y += (my / len) * WALK_SPEED * dt;
      player.speed = WALK_SPEED;
    } else {
      player.speed = 0;
    }
    player.x = Math.max(24, Math.min(2576, player.x));
    player.y = Math.max(24, Math.min(2576, player.y));

    // Punch: F hits the nearest pedestrian or cruiser in front of the player.
    if (input.wasPressed('f') && player.punchCooldown <= 0) {
      player.punchTimer = 0.22;
      player.punchCooldown = 0.45;
      let hit = false;
      for (const ped of traffic.peds) {
        const d = Math.hypot(ped.x - player.x, ped.y - player.y);
        if (d < 46) {
          ped.x += Math.cos(player.angle) * 60;
          ped.y += Math.sin(player.angle) * 60;
          ped.angle = player.angle;
          ped.changeIn = 3;
          hit = true;
        }
      }
      for (const c of police.cruisers) {
        if (Math.hypot(c.x - player.x, c.y - player.y) < 50) hit = true;
      }
      if (hit) {
        world.addWanted(HEAT.punchPed);
        world.audio.thud();
        world.addFloatingText(player.x, player.y - 24, 'WHAM!', '#ffe600');
      }
    }

    // E: steal the nearest car.
    if (input.wasPressed('e')) {
      const car = traffic.nearestCar(player.x, player.y, 52);
      if (car) {
        traffic.takeCar(car);
        player.car = {
          x: car.x, y: car.y, angle: car.angle, speed: 0,
          health: 100, color: car.color, w: 34, h: 18,
        };
        player.onFoot = false;
        player.x = car.x;
        player.y = car.y;
        player.angle = car.angle;
        world.addWanted(HEAT.stealCar);
        world.audio.blip();
        world.addFloatingText(car.x, car.y - 30, 'CAR JACKED!', '#ff2e88');
        world.onStealCar();
      }
    }
  } else {
    const car = player.car;
    const forward = input.isDown('w', 'arrowup') ? 1 : 0;
    const back = input.isDown('s', 'arrowdown') ? 1 : 0;
    const steer = (input.isDown('a', 'arrowleft') ? -1 : 0) + (input.isDown('d', 'arrowright') ? 1 : 0);

    if (forward) car.speed += CAR_ACCEL * dt;
    if (back) car.speed -= (car.speed > 0 ? CAR_ACCEL * 1.2 : CAR_ACCEL * 0.6) * dt;
    if (!forward && !back) car.speed -= car.speed * CAR_DRAG * dt;
    car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));

    // Steering bites harder with speed, and flips when reversing.
    const steerFactor = Math.min(1, Math.abs(car.speed) / 140);
    car.angle += steer * 2.5 * steerFactor * Math.sign(car.speed || 1) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);

    // Buildings stop the car hard; roads and sand do not.
    if (hitBuilding(city, car.x, car.y)) {
      car.x -= Math.cos(car.angle) * car.speed * dt;
      car.y -= Math.sin(car.angle) * car.speed * dt;
      if (Math.abs(car.speed) > 160) {
        car.health -= 12;
        world.audio.crash();
        world.addFloatingText(car.x, car.y - 30, 'CRASH!', '#ff6b35');
        world.shake(6);
      }
      car.speed *= -0.25;
    }
    car.x = Math.max(24, Math.min(2576, car.x));
    car.y = Math.max(24, Math.min(2576, car.y));

    // Hitting a pedestrian with the car is a crime and slows the car.
    for (const ped of traffic.peds) {
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26 && Math.abs(car.speed) > 60) {
        ped.x += Math.cos(car.angle) * 90;
        ped.y += Math.sin(car.angle) * 90;
        ped.angle = car.angle;
        ped.changeIn = 4;
        car.speed *= 0.6;
        world.addWanted(HEAT.hitPed);
        world.audio.thud();
        world.addFloatingText(ped.x, ped.y - 24, 'OUCH!', '#ffe600');
      }
    }

    // E: step out, leaving the car parked where it stands.
    if (input.wasPressed('e')) {
      traffic.dropCar(car);
      player.onFoot = true;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      player.car = null;
      player.speed = 0;
    }

    // Wrecked car: the player is thrown out on foot.
    if (car.health <= 0) {
      traffic.dropCar({ ...car, health: 100 });
      player.onFoot = true;
      player.x = car.x + 34;
      player.y = car.y;
      player.car = null;
      player.speed = 0;
      world.audio.crash();
      world.addFloatingText(player.x, player.y - 30, 'CAR WRECKED!', '#ff2e88');
      world.shake(10);
    }
  }
}

// True when the point is inside any building footprint.
export function hitBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) return true;
  }
  return false;
}
