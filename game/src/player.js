// Solmar Bay — the player on foot: walking, sprinting, punching, shooting,
// health/armor/ammo, and the enter/exit-car interaction.
import { clamp, dist } from './config.js';
import { collideCircle } from './city.js';
import { enterCar, exitCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: 100, armor: 0, cash: 250, ammo: 24,
    inCar: null,
    punchCd: 0, shootCd: 0, hurtCd: 0,
    walkBob: 0, moving: false,
    kills: 0,
  };
}

export function updatePlayer(S, dt, input) {
  const p = S.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);

  if (p.inCar) return; // driving is handled by vehicles.drivePlayerCar

  // Aim at the mouse.
  const wx = S.camera.x + (input.mouseX - 640) / S.camera.zoom;
  const wy = S.camera.y + (input.mouseY - 360) / S.camera.zoom;
  p.angle = Math.atan2(wy - p.y, wx - p.x);

  const ax = input.axisX();
  const ay = input.axisY();
  const sprint = input.held('shift');
  const speed = sprint ? 235 : 150;
  p.moving = ax !== 0 || ay !== 0;
  if (p.moving) {
    p.walkBob += dt * 11;
    const len = Math.hypot(ax, ay) || 1;
    const nx = p.x + (ax / len) * speed * dt;
    const ny = p.y + (ay / len) * speed * dt;
    const pos = collideCircle(S.city, nx, ny, 12);
    p.x = pos.x; p.y = pos.y;
  }

  // Enter / exit car.
  if (input.wasPressed('interact')) {
    let best = null; let bd = 70;
    for (const car of S.cars) {
      if (car.driver === 'traffic' || car.driver === 'police') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      if (best.driver === 'parked' && !best._gift) best._parkedSteal = true;
      enterCar(S, best);
      S.hud.flash(best.spec.name);
    }
  }

  // Punch: short-range, knocks peds and rivals down.
  if (input.wasPressed('punch') && p.punchCd <= 0) {
    p.punchCd = 0.38;
    S.audio.punch();
    const hx = p.x + Math.cos(p.angle) * 26;
    const hy = p.y + Math.sin(p.angle) * 26;
    S.particles.punch(hx, hy, p.angle);
    for (const ped of S.peds) {
      if (ped.state !== 'down' && dist(hx, hy, ped.x, ped.y) < 26) {
        ped.state = 'down'; S.police.addHeat(S, 1, 'Assault');
      }
    }
    for (const e of S.enemies) {
      if (!e.dead && dist(hx, hy, e.x, e.y) < 28) {
        e.hp -= 34;
        S.particles.burst(e.x, e.y, 6, '#ffd24d');
        if (e.hp <= 0) killEnemy(S, e);
      }
    }
  }

  // Shoot toward the mouse.
  if ((input.mouseDown || input.mouseClicked) && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = 0.22;
    p.ammo--;
    S.audio.shot();
    S.dangerPulse = 0.6; S.dangerX = p.x; S.dangerY = p.y;
    const mx = p.x + Math.cos(p.angle) * 340;
    const my = p.y + Math.sin(p.angle) * 340;
    S.particles.tracer(p.x, p.y, mx, my);
    // Hit the first enemy / ped / cop along the line.
    const targets = [];
    for (const e of S.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
    for (const ped of S.peds) if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, kind: 'ped', ref: ped });
    for (const c of S.cops) if (c._footCop) targets.push({ x: c._footCop.x, y: c._footCop.y, kind: 'cop', ref: c });
    let bestT = null; let bestD = 360;
    for (const t of targets) {
      const dx = t.x - p.x; const dy = t.y - p.y;
      const along = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
      const perp = Math.abs(-dx * Math.sin(p.angle) + dy * Math.cos(p.angle));
      if (along > 0 && along < bestD && perp < 20) { bestD = along; bestT = t; }
    }
    if (bestT) {
      S.particles.burst(bestT.x, bestT.y, 8, '#ff5a4d');
      if (bestT.kind === 'enemy') {
        bestT.ref.hp -= 34;
        if (bestT.ref.hp <= 0) killEnemy(S, bestT.ref);
      } else if (bestT.kind === 'ped') {
        bestT.ref.state = 'down';
        S.police.addHeat(S, 1, 'Shooting');
      } else if (bestT.kind === 'cop') {
        bestT.ref._footCop = null;
        S.police.addHeat(S, 1, 'Officer down');
      }
    }
    if (p.ammo === 0) S.hud.flash('OUT OF AMMO — find ammo (green crates)');
  }
}

export function killEnemy(S, e) {
  e.dead = true;
  S.player.kills++;
  S.particles.burst(e.x, e.y, 14, '#ff5a4d');
  S.player.cash += 50;
  S.hud.floatText(e.x, e.y, '+$50');
}

export function hurtPlayer(S, dmg) {
  const p = S.player;
  if (p.hurtCd > 0 || S.mode !== 'play') return;
  p.hurtCd = 0.5;
  let left = dmg;
  if (p.armor > 0) { const ab = Math.min(p.armor, left); p.armor -= ab; left -= ab; }
  p.health -= left;
  S.particles.burst(p.x, p.y, 6, '#ff5a4d');
  if (p.health <= 0) {
    p.health = 0;
    S.main.wasted(S);
  }
}
