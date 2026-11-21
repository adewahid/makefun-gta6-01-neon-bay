// traffic.js — the city's moving life: traffic cars that follow the road
// grid and pedestrians strolling the sidewalks. Traffic cars drive along
// one road at a time and pick a new direction at each intersection; they
// slow for the car ahead so the streets never jam into one pile.

import { makeRng } from './random.js';

const CAR_COLORS = ['#e63946', '#f4d35e', '#2a9d8f', '#457b9d', '#ff8fa3', '#adb5bd', '#f77f00', '#80ed99', '#b5179e', '#ffbe0b'];
const PED_COLORS = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fffffc'];
const CAR_W = 34;
const CAR_H = 18;

export function createTraffic(city, seed) {
  const rng = makeRng(seed + 101);
  const cars = [];
  const peds = [];

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      const avenue = rng.pick(city.avenues);
      return { x: avenue + (rng.chance(0.5) ? -16 : 16), y: rng.range(60, 2500), horizontal: false };
    }
    const street = rng.pick(city.streets);
    return { x: rng.range(60, 2200), y: street + (rng.chance(0.5) ? -16 : 16), horizontal: true };
  }

  function spawnCar() {
    const spot = randomRoadPoint();
    const dir = rng.chance(0.5) ? 1 : -1;
    cars.push({
      x: spot.x, y: spot.y,
      angle: spot.horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: rng.range(70, 130),
      cruise: rng.range(70, 130),
      color: rng.pick(CAR_COLORS),
      w: CAR_W, h: CAR_H,
      stolen: false,
    });
  }

  function spawnPed() {
    const onAvenue = rng.chance(0.5);
    const road = onAvenue ? rng.pick(city.avenues) : rng.pick(city.streets);
    const along = rng.range(80, 2400);
    peds.push({
      x: onAvenue ? road + rng.pick([-46, 46]) : along,
      y: onAvenue ? along : road + rng.pick([-46, 46]),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      color: rng.pick(PED_COLORS),
      changeIn: rng.range(2, 6),
      r: 7,
    });
  }

  for (let i = 0; i < 22; i++) spawnCar();
  for (let i = 0; i < 42; i++) spawnPed();

  // Parked cars the player can steal, placed from the city's spots.
  const parked = city.parkedSpots.map((spot, i) => ({
    x: spot.x, y: spot.y, angle: spot.angle,
    color: CAR_COLORS[i % CAR_COLORS.length],
    w: CAR_W, h: CAR_H,
    parked: true,
  }));

  function atIntersection(car) {
    const nearAvenue = city.avenues.some((a) => Math.abs(car.x - a) < 10);
    const nearStreet = city.streets.some((s) => Math.abs(car.y - s) < 10);
    return nearAvenue && nearStreet;
  }

  function turnAtIntersection(car) {
    // At an intersection, keep going, turn left or turn right.
    const roll = rng.next();
    const horizontal = Math.abs(Math.sin(car.angle)) < 0.5;
    let newAngle = car.angle;
    if (roll < 0.3) newAngle = car.angle + Math.PI / 2;
    else if (roll < 0.6) newAngle = car.angle - Math.PI / 2;
    // Snap to the centre of the new road.
    if (Math.abs(Math.sin(newAngle)) < 0.5) {
      car.y = city.streets.reduce((best, s) => (Math.abs(s - car.y) < Math.abs(best - car.y) ? s : best), city.streets[0])
        + (Math.cos(newAngle) > 0 ? 16 : -16);
    } else {
      car.x = city.avenues.reduce((best, a) => (Math.abs(a - car.x) < Math.abs(best - a) ? a : best), city.avenues[0])
        + (Math.sin(newAngle) > 0 ? 16 : -16);
    }
    car.angle = newAngle;
  }

  return {
    cars, peds, parked,
    update(dt, playerCar) {
      for (const car of cars) {
        // Slow down for the car ahead in the same lane.
        let ahead = null;
        for (const other of cars) {
          if (other === car) continue;
          const dx = other.x - car.x;
          const dy = other.y - car.y;
          const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
          const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
          if (forward > 0 && forward < 70 && side < 20) { ahead = other; break; }
        }
        const target = ahead ? 0 : car.cruise;
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (atIntersection(car) && rng.chance(dt * 1.2)) turnAtIntersection(car);
        // Wrap around the city edge instead of vanishing.
        if (car.x < 20) car.x = 2240;
        if (car.x > 2260) car.x = 40;
        if (car.y < 20) car.y = 2540;
        if (car.y > 2560) car.y = 40;
      }
      for (const ped of peds) {
        ped.changeIn -= dt;
        if (ped.changeIn <= 0) {
          ped.changeIn = rng.range(2, 7);
          ped.angle = rng.range(0, Math.PI * 2);
        }
        const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
        const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
        if (nx > 40 && nx < 2260 && ny > 40 && ny < 2560) {
          ped.x = nx;
          ped.y = ny;
        } else {
          ped.angle += Math.PI;
        }
      }
      // Parked cars never move; traffic keeps its distance from the
      // player's car by simply not steering into it (collision is handled
      // by the main loop).
    },
    // Nearest stealable car (traffic or parked) within reach of a point.
    nearestCar(x, y, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        const d = Math.hypot(car.x - x, car.y - y);
        if (d < bestD) { best = car; bestD = d; }
      }
      for (const car of parked) {
        const d = Math.hypot(car.x - x, car.y - y);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },
    // Remove a car from traffic/parking once the player takes it.
    takeCar(car) {
      const ti = cars.indexOf(car);
      if (ti >= 0) cars.splice(ti, 1);
      const pi = parked.indexOf(car);
      if (pi >= 0) parked.splice(pi, 1);
    },
    // Put the player's abandoned car back into the world as a parked car.
    dropCar(car) {
      parked.push({ x: car.x, y: car.y, angle: car.angle, color: car.color, w: CAR_W, h: CAR_H, parked: true });
    },
  };
}
