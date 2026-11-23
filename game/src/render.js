// Solmar Bay — the renderer: camera, ground, roads, buildings, the beach,
// every entity, particles, markers, the day/night cycle and headlights.
// Everything is plain Canvas 2D so the game runs anywhere with no assets.
import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_W, ROAD_XS, ROAD_YS,
  clamp, lerp,
} from './config.js';
import { districtAt } from './city.js';

export function createCamera() {
  return { x: 640, y: 360, zoom: 1 };
}

// 0 = deep night, 1 = full day. Dawn 6:00, dusk 18:30.
export function daylight(minutes) {
  const h = (minutes / 60) % 24;
  if (h >= 7 && h <= 17.5) return 1;
  if (h >= 19 || h <= 5) return 0;
  if (h > 5 && h < 7) return (h - 5) / 2;
  return (19 - h) / 1.5;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(S, ctx, now) {
  const cam = S.camera;
  const p = S.player;
  const targetZoom = p.inCar ? 0.85 : 1;
  cam.zoom += (targetZoom - cam.zoom) * 0.04;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  cam.x = clamp(px, VIEW_W / 2 / cam.zoom, WORLD_W - VIEW_W / 2 / cam.zoom);
  cam.y = clamp(py, VIEW_H / 2 / cam.zoom, WORLD_H - VIEW_H / 2 / cam.zoom);

  const day = daylight(S.clock.minutes);
  S.clock.isNight = day < 0.45;

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const vx0 = cam.x - VIEW_W / 2 / cam.zoom - 60;
  const vy0 = cam.y - VIEW_H / 2 / cam.zoom - 60;
  const vx1 = cam.x + VIEW_W / 2 / cam.zoom + 60;
  const vy1 = cam.y + VIEW_H / 2 / cam.zoom + 60;
  const inView = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // --- ground -----------------------------------------------------------------
  ctx.fillStyle = '#5a7a52';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // District tints on the grass.
  for (const d of S.cityDistricts) {
    ctx.fillStyle = d.tint + '22';
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  }
  // Beach + water (west edge).
  const beachW = S.city.beach.w;
  ctx.fillStyle = '#1c4a63';
  ctx.fillRect(0, 0, beachW - 26, WORLD_H);
  ctx.fillStyle = '#2f6f8e';
  for (let y = 0; y < WORLD_H; y += 46) {
    ctx.beginPath();
    ctx.arc(26 + Math.sin(now / 900 + y / 60) * 4, y + 20, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(beachW - 26, 0, 26, WORLD_H);

  // Sidewalks (light border around every block).
  ctx.fillStyle = '#9a9a92';
  for (let ci = 0; ci < 10; ci++) {
    for (let ri = 0; ri < 9; ri++) {
      const bx = ROAD_XS[ci] + ROAD_W / 2 - 8;
      const by = ROAD_YS[ri] + ROAD_W / 2 - 8;
      ctx.fillRect(bx, by, 264 + 16, 224 + 16);
    }
  }

  // Roads.
  ctx.fillStyle = '#2f333d';
  for (const x of ROAD_XS) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of ROAD_YS) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (const x of ROAD_XS) {
    for (let y = 0; y < WORLD_H; y += 44) ctx.fillRect(x - 2, y, 4, 22);
  }
  for (const y of ROAD_YS) {
    for (let x = 0; x < WORLD_W; x += 44) ctx.fillRect(x, y - 2, 22, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const x of ROAD_XS) for (const y of ROAD_YS) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(x + i * 12 - 3, y - ROAD_W / 2 + 6, 6, 14);
      ctx.fillRect(x + i * 12 - 3, y + ROAD_W / 2 - 20, 6, 14);
    }
  }

  // Parks.
  for (const park of S.city.parks) {
    if (!inView(park.x + park.w / 2, park.y + park.h / 2, 200)) continue;
    ctx.fillStyle = '#3f7a3a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#5a9a4a';
    for (let i = 0; i < park.trees; i++) {
      const tx = park.x + ((park.seed * (i + 3) * 37) % park.w);
      const ty = park.y + ((park.seed * (i + 7) * 53) % park.h);
      ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f5a2a';
      ctx.beginPath(); ctx.arc(tx - 3, ty - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a9a4a';
    }
    ctx.fillStyle = '#7ab5d9';
    ctx.beginPath(); ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 22, 0, Math.PI * 2); ctx.fill();
  }

  // Palms.
  ctx.fillStyle = '#2f6a2a';
  for (const palm of S.city.palms) {
    if (!inView(palm.x, palm.y, 20)) continue;
    ctx.beginPath(); ctx.arc(palm.x, palm.y, 9, 0, Math.PI * 2); ctx.fill();
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.5)';
  ctx.lineWidth = 4;
  for (const s of S.particles.skids) {
    if (!inView(s.x, s.y, 20)) continue;
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
    ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Buildings.
  for (const b of S.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, 140)) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    }
    // Windows around the walls (lit at night).
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = ((b.windows + i * 7 + j * 13) % 5) < 2;
        ctx.fillStyle = day < 0.45 && lit ? '#ffd24d' : 'rgba(20,28,40,0.55)';
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 8, 10);
      }
    }
    if (b.casino) {
      ctx.fillStyle = '#ff7ad9';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ CORAL CROWN ★', b.x + b.w / 2, b.y + b.h / 2);
      ctx.textAlign = 'left';
      if (day < 0.45) {
        ctx.fillStyle = `rgba(255,122,217,${0.25 + 0.15 * Math.sin(now / 300)})`;
        ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      }
    }
  }

  // Dock crates.
  for (const c of S.city.crates) {
    if (!inView(c.x, c.y, 40)) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }

  // Street lamps (glow at night).
  if (day < 0.6) {
    for (const l of S.city.lamps) {
      if (!inView(l.x, l.y, 30)) continue;
      ctx.fillStyle = 'rgba(255,220,120,0.18)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 34, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#3a3a3a';
  for (const l of S.city.lamps) {
    if (!inView(l.x, l.y, 10)) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }

  // Hidden packages.
  for (const pkg of S.city.packages) {
    if (pkg.taken || !inView(pkg.x, pkg.y, 30)) continue;
    const bob = Math.sin(now / 300 + pkg.x) * 3;
    ctx.fillStyle = '#ffd24d';
    ctx.fillRect(pkg.x - 9, pkg.y - 9 + bob, 18, 18);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', pkg.x, pkg.y + 4 + bob);
    ctx.textAlign = 'left';
  }

  // Ammo crates.
  for (const c of S.activities.ammoCrates) {
    if (c.taken || !inView(c.x, c.y, 30)) continue;
    ctx.fillStyle = '#2f8a4a';
    ctx.fillRect(c.x - 11, c.y - 11, 22, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', c.x, c.y + 4);
    ctx.textAlign = 'left';
  }

  // Cash drops (mission 3).
  if (S.missions.state === 'active' && S.mission.drops) {
    for (const d of S.mission.drops) {
      if (d.taken || !inView(d.x, d.y, 30)) continue;
      const bob = Math.sin(now / 250 + d.x) * 3;
      ctx.fillStyle = '#7dff6a';
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a3a0a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', d.x, d.y + 5 + bob);
      ctx.textAlign = 'left';
    }
  }

  // Safehouse / casino / docks are marked on the minimap; the mission beam
  // marks the live target in the world (drawn below).

  // Mission target beam + marker.
  const target = S.missions.target;
  if (target && S.missions.state === 'active') {
    const pulse = 1 + Math.sin(now / 200) * 0.15;
    ctx.fillStyle = 'rgba(255,210,77,0.25)';
    ctx.fillRect(target.x - 14, target.y - 70, 28, 70);
    ctx.fillStyle = '#ffd24d';
    ctx.save();
    ctx.translate(target.x, target.y - 30 * pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(target.x, target.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Cars.
  for (const car of S.cars) {
    if (!inView(car.x, car.y, 60) || car.dead) continue;
    drawCar(S, ctx, car, now, day);
  }

  // Pedestrians.
  for (const ped of S.peds) {
    if (!inView(ped.x, ped.y, 30)) continue;
    drawPed(S, ctx, ped, now);
  }

  // Enemies.
  for (const e of S.enemies) {
    if (e.dead || !inView(e.x, e.y, 40)) continue;
    drawEnemy(S, ctx, e, now);
  }

  // On-foot cops.
  for (const c of S.cops) {
    if (c._footCop && inView(c._footCop.x, c._footCop.y, 30)) {
      const f = c._footCop;
      ctx.fillStyle = '#1c2f6e';
      ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c8a0';
      ctx.beginPath(); ctx.arc(f.x, f.y - 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24d';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCPD', f.x, f.y - 16);
      ctx.textAlign = 'left';
      if (f.arrest > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(f.x - 16, f.y - 28, 32, 5);
        ctx.fillStyle = '#ff5a4d';
        ctx.fillRect(f.x - 16, f.y - 28, 32 * (f.arrest / 1.6), 5);
      }
    }
  }

  // Player (on foot).
  if (!p.inCar) drawPlayerOnFoot(S, ctx, p, now);

  // Particles.
  for (const part of S.particles.parts) {
    ctx.globalAlpha = Math.max(0, part.life / part.max);
    ctx.fillStyle = part.color;
    ctx.beginPath(); ctx.arc(part.x, part.y, part.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const t of S.particles.tracers) {
    ctx.globalAlpha = Math.max(0, t.life / 0.09);
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of S.particles.floats) {
    ctx.globalAlpha = Math.max(0, f.life / 1.4);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Helicopter spotlight at 5 stars.
  if (S.police.heli) {
    const h = S.police.heli;
    ctx.fillStyle = 'rgba(255,255,200,0.13)';
    ctx.beginPath(); ctx.arc(px, py, 150, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f333d';
    ctx.beginPath(); ctx.ellipse(h.x, h.y, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x - 26, h.y); ctx.lineTo(h.x + 26, h.y);
    ctx.stroke();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotor);
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
    ctx.restore();
  }

  // Headlights at night.
  if (day < 0.45 && p.inCar) {
    const car = p.inCar;
    const hx = car.x + Math.cos(car.angle) * 30;
    const hy = car.y + Math.sin(car.angle) * 30;
    const grad = ctx.createRadialGradient(hx, hy, 10, hx + Math.cos(car.angle) * 120, hy + Math.sin(car.angle) * 120, 190);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.arc(hx + Math.cos(car.angle) * 120, hy + Math.sin(car.angle) * 120, 190, car.angle - 0.5, car.angle + 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // Night overlay.
  if (day < 1) {
    ctx.fillStyle = `rgba(6,10,34,${(1 - day) * 0.42})`;
    ctx.fillRect(cam.x - VIEW_W / 2 / cam.zoom - 80, cam.y - VIEW_H / 2 / cam.zoom - 80, VIEW_W / cam.zoom + 160, VIEW_H / cam.zoom + 160);
  }

  ctx.restore();

  // Off-screen target arrow (screen space).
  if (target && S.missions.state === 'active') {
    const sx = (target.x - cam.x) * cam.zoom + VIEW_W / 2;
    const sy = (target.y - cam.y) * cam.zoom + VIEW_H / 2;
    if (sx < 60 || sx > VIEW_W - 60 || sy < 60 || sy > VIEW_H - 60) {
      const cx = clamp(sx, 70, VIEW_W - 70);
      const cy = clamp(sy, 110, VIEW_H - 70);
      const ang = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      const d = Math.round(Math.hypot(target.x - px, target.y - py));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd24d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${d}m`, cx, cy + 26);
      ctx.textAlign = 'left';
    }
  }
}

function drawCar(S, ctx, car, now, day) {
  const spec = car.spec;
  const w = spec.len; const h = spec.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 6); ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  // Roof + windows.
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  roundRect(ctx, -w / 6, -h / 2 + 4, w / 3, h - 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w / 6, -h / 2 + 5, w / 5, h - 10);
  // Headlights.
  ctx.fillStyle = day < 0.45 ? '#fff6c9' : '#e8e8c9';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 8, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 5);
    ctx.fillRect(-w / 2 - 1, h / 2 - 8, 3, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -h / 2 - 4);
    ctx.textAlign = 'left';
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, -h / 2 - 4);
    ctx.textAlign = 'left';
    // Flashing light bar.
    const on = Math.floor(now / 280) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a1a' : '#2a6aff';
    ctx.fillRect(-6, -h / 2 - 2, 6, 4);
    ctx.fillStyle = on ? '#2a6aff' : '#ff2a1a';
    ctx.fillRect(0, -h / 2 - 2, 6, 4);
  }
  ctx.restore();
  // Damage smoke is spawned by the vehicle update, not drawn here.
  if (car.health < 50) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath(); ctx.arc(car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14, 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPed(S, ctx, ped, now) {
  const bob = ped.state === 'walk' ? Math.sin(ped.bob) * 2 : 0;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  if (ped.state === 'down') {
    ctx.rotate(1.4);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.fare) {
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 18 + Math.sin(now / 300) * 2);
    ctx.textAlign = 'left';
  }
}

function drawEnemy(S, ctx, e, now) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = '#8e1f2f';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath(); ctx.arc(3, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Gun barrel.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
  ctx.fillStyle = '#ff5a4d';
  ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.hp) / 100, 5);
}

function drawPlayerOnFoot(S, ctx, p, now) {
  const bob = p.moving ? Math.sin(p.walkBob) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Body — teal jacket, the player's signature look.
  ctx.fillStyle = '#22b8a6';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 6, 0, Math.PI * 2); ctx.fill();
  // Gun in hand when armed.
  if (p.ammo > 0) {
    ctx.rotate(p.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
  // Hurt flash.
  if (p.hurtCd > 0.35) {
    ctx.fillStyle = 'rgba(255,40,40,0.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
  }
}
