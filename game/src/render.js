// All drawing: the city, actors, particles, HUD, minimap and menus.
// Top-down 2D with soft shadows and a day/night tint.
import { WORLD, ROADS, ROAD_W, COLORS } from './config.js';
import { clamp, fmtMoney, fmtTime } from './random.js';
import { missionProgressText, currentMission } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const mini = document.createElement('canvas');
  mini.width = 190; mini.height = 190;
  const mctx = mini.getContext('2d');
  return { ctx, mini, mctx };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(r, g, cam) {
  const { ctx } = r;
  const { city, timeOfDay } = g;
  const night = nightFactor(timeOfDay);
  // Ground.
  ctx.fillStyle = night > 0.5 ? '#24401f' : COLORS.grass;
  ctx.fillRect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80);
  // Subtle checker for grass variation.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  const gs = 150;
  const x0 = Math.floor((cam.x - 40) / gs) * gs;
  const y0 = Math.floor((cam.y - 40) / gs) * gs;
  for (let x = x0; x < cam.x + cam.w + 40; x += gs) {
    for (let y = y0; y < cam.y + cam.h + 40; y += gs) {
      if (((x + y) / gs) % 2 === 0) ctx.fillRect(x, y, gs, gs);
    }
  }
  // Beach + water (south edge).
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(city.water.x, city.water.y, city.water.w, 6);
  // Marina (east edge): docks + moored boats.
  ctx.fillStyle = '#4a5a52';
  ctx.fillRect(city.marina.x, city.marina.y, city.marina.w, city.marina.h);
  ctx.fillStyle = '#7a6a52';
  for (let i = 0; i < 4; i++) ctx.fillRect(city.marina.x + 16, city.marina.y + 30 + i * 130, 120, 14);
  ctx.fillStyle = '#e8e4d8';
  for (let i = 0; i < 4; i++) {
    const bx = city.marina.x + 150 + (i % 2) * 60;
    const by = city.marina.y + 40 + i * 130;
    rr(ctx, bx, by, 44, 18, 8); ctx.fill();
  }
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(p.x, p.y, p.w, 8);
  }
  // Roads.
  for (const road of ROADS) {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(road - ROAD_W / 2, -20, ROAD_W, WORLD + 40);
    ctx.fillRect(-20, road - ROAD_W / 2, WORLD + 40, ROAD_W);
  }
  // Lane dashes.
  ctx.fillStyle = COLORS.lane;
  for (const road of ROADS) {
    for (let d = 0; d < WORLD; d += 64) {
      ctx.fillRect(road - 2, d, 4, 30);
      ctx.fillRect(d, road - 2, 30, 4);
    }
  }
  // Sidewalks.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (const road of ROADS) {
    ctx.fillRect(road - ROAD_W / 2 - 8, -20, 8, WORLD + 40);
    ctx.fillRect(road + ROAD_W / 2, -20, 8, WORLD + 40);
    ctx.fillRect(-20, road - ROAD_W / 2 - 8, WORLD + 40, 8);
    ctx.fillRect(-20, road + ROAD_W / 2, WORLD + 40, 8);
  }
  // Trees.
  for (const t of city.trees) {
    if (!inView(t.x, t.y, cam, 30)) continue;
    ctx.fillStyle = '#1d4a22';
    ctx.beginPath(); ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f7a35';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  }
  // Buildings with fake height: dark base offset, roof, windows.
  for (const b of city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, cam, Math.max(b.w, b.h))) continue;
    const lift = b.tall ? 14 : 6;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i + j) % 2 === 0) ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 12, 10);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    }
  }
  // Street lamps (glow at night).
  for (const l of city.lamps) {
    if (!inView(l.x, l.y, cam, 20)) continue;
    ctx.fillStyle = '#3a3d44';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (night > 0.4) {
      ctx.fillStyle = `rgba(255, 220, 120, ${0.35 * night})`;
      ctx.beginPath(); ctx.arc(l.x, l.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function inView(x, y, cam, m) {
  return x > cam.x - m && x < cam.x + cam.w + m && y > cam.y - m && y < cam.y + cam.h + m;
}

export function nightFactor(hour) {
  // 0 at noon, 1 at midnight.
  if (hour >= 20 || hour < 5) return 1;
  if (hour >= 18) return (hour - 18) / 2;
  if (hour < 7) return 1 - (hour - 5) / 2;
  return 0;
}

export function drawPickups(r, g, cam) {
  const { ctx } = r;
  for (const p of g.pickups) {
    if (p.taken || !inView(p.x, p.y, cam, 30)) continue;
    const bob = Math.sin(g.time * 3 + p.bob) * 3;
    if (p.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      rr(ctx, p.x - 11, p.y - 7 + bob, 22, 14, 3); ctx.fill();
      ctx.fillStyle = '#e8f5e9';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', p.x, p.y + bob);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#e8e4d8';
      rr(ctx, p.x - 10, p.y - 10 + bob, 20, 20, 4); ctx.fill();
      ctx.fillStyle = '#e33';
      ctx.fillRect(p.x - 2.5, p.y - 7 + bob, 5, 14);
      ctx.fillRect(p.x - 7, p.y - 2.5 + bob, 14, 5);
    } else if (p.kind === 'repair') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('W', p.x, p.y + bob);
    } else {
      ctx.fillStyle = '#d9a44f';
      rr(ctx, p.x - 9, p.y - 9 + bob, 18, 18, 4); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('A', p.x, p.y + bob);
    }
  }
}

export function drawCar(r, car, cam, isPlayer) {
  const { ctx } = r;
  if (!inView(car.x, car.y, cam, 60)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -19, -9 + 3, 40, 22, 8); ctx.fill();
  const body = car.cop ? '#1d3f8e' : car.color;
  ctx.fillStyle = body;
  rr(ctx, -21, -11, 42, 22, 8); ctx.fill();
  // Cabin + windows.
  ctx.fillStyle = car.cop ? '#dfe9ff' : '#20242e';
  rr(ctx, -6, -9, 16, 18, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-4, -8, 5, 16);
  // Police livery.
  if (car.cop) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-21, -11, 42, 5);
    ctx.fillStyle = '#e33';
    ctx.fillRect(-21, 6, 42, 5);
    ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4444' : '#4488ff';
    ctx.beginPath(); ctx.arc(0, -11, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#4488ff' : '#ff4444';
    ctx.beginPath(); ctx.arc(8, -11, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(19, -9, 3, 5);
  ctx.fillRect(19, 4, 3, 5);
  // Damage smoke.
  if (car.health < 40 && !car.dead) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath(); ctx.arc(-14, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(car.x, car.y, 30, 0, Math.PI * 2); ctx.stroke();
  }
}

export function drawPed(r, ped, cam) {
  const { ctx } = r;
  if (ped.dead || !inView(ped.x, ped.y, cam, 30)) return;
  const wob = Math.sin(ped.walkPhase) * 3;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(4, -4 + wob * 0.3, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPlayer(r, p, cam) {
  const { ctx } = r;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(1, 2, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Jacket (teal) + jeans, facing the mouse.
  ctx.fillStyle = '#12a5a5';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(5, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -3, 7, 6); // gun / fist forward
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
}

export function drawParticles(r, particles, cam) {
  const { ctx } = r;
  for (const pt of particles) {
    if (!inView(pt.x, pt.y, cam, 20)) continue;
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawSkids(r, skids, cam) {
  const { ctx } = r;
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of skids) {
    if (!inView(s.x, s.y, cam, 20)) continue;
    ctx.globalAlpha = clamp(s.life / 6, 0, 0.5);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawMarker(r, g, cam) {
  const { ctx } = r;
  const m = g.activeTarget;
  if (!m) return;
  const pulse = 1 + Math.sin(g.time * 4) * 0.12;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-10, -14); ctx.lineTo(10, -14); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Off-screen edge arrow pointing at the target.
  const px = g.player.inCar ? g.player.inCar.x : g.player.x;
  const py = g.player.inCar ? g.player.inCar.y : g.player.y;
  const sx = m.x - cam.x, sy = m.y - cam.y;
  if (sx < 30 || sx > cam.w - 30 || sy < 30 || sy > cam.h - 30) {
    const cx = clamp(sx, 40, cam.w - 40), cy = clamp(sy, 40, cam.h - 40);
    const a = Math.atan2(sy - (py - cam.y), sx - (px - cam.x));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// --- HUD -------------------------------------------------------------------
export function drawHUD(r, g, w, h) {
  const { ctx } = r;
  const p = g.player;
  // Top-left: wanted stars + cash + health.
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = i < g.wanted ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 16 + i * 30, 36);
  }
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#7CFC00';
  ctx.fillText(fmtMoney(p.money), 16, 66);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, 14, 76, 170, 16, 8); ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#37d67a' : '#e33';
  const hw = 166 * clamp(p.health / 100, 0, 1);
  if (hw > 2) { rr(ctx, 16, 78, hw, 12, 6); ctx.fill(); }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 20, 89);
  // Bottom-right: speed / weapon.
  if (p.inCar) {
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    ctx.fillText(kmh + '', w - 16, h - 52);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h  •  ' + p.inCar.def.name, w - 16, h - 32);
  } else {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(p.hasGun ? `Pistol  •  ${p.ammo} rounds` : 'Fists', w - 16, h - 40);
  }
  // Mission tracker (top-center).
  const m = currentMission(g.missions);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const line1 = m ? m.title : 'NEON BAY — free roam';
  const line2 = missionProgressText(g.missions);
  ctx.font = 'bold 16px system-ui, sans-serif';
  const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 28;
  rr(ctx, w / 2 - tw / 2, 12, tw, 52, 10); ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.fillText(line1, w / 2, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(line2, w / 2, 52);
  // Timed mission countdown.
  if (g.missions.timer > 0) {
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = g.missions.timer < 20 ? '#ff5a5a' : '#fff';
    ctx.fillText(fmtTime(g.missions.timer), w / 2, 100);
  }
  // Hint line.
  if (g.hint && g.hintT > 0) {
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(g.hint, w / 2, h - 14);
  }
  // Banner (mission complete / failed).
  if (g.missions.banner && g.missions.banner.t > 0) {
    const b = g.missions.banner;
    ctx.globalAlpha = clamp(b.t, 0, 1);
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23d';
    ctx.fillText(b.text, w / 2, h * 0.32);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(b.sub || '', w / 2, h * 0.32 + 34);
    ctx.globalAlpha = 1;
  }
  // Damage vignette.
  if (p.health < 35) {
    const a = (35 - p.health) / 35 * 0.45 * (0.7 + 0.3 * Math.sin(g.time * 6));
    ctx.fillStyle = `rgba(200,0,0,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawMinimap(r, g) {
  const { mctx, mini } = r;
  const S = 190, scale = S / WORLD;
  mctx.clearRect(0, 0, S, S);
  mctx.fillStyle = 'rgba(10,14,24,0.85)';
  mctx.fillRect(0, 0, S, S);
  mctx.fillStyle = '#2e6b34';
  mctx.fillRect(0, 0, S, S);
  mctx.fillStyle = '#1d6f8e';
  mctx.fillRect(0, 2260 * scale, S, 140 * scale);
  mctx.fillStyle = '#d9c27a';
  mctx.fillRect(0, 2130 * scale, S, 130 * scale);
  mctx.fillStyle = '#33363d';
  for (const road of ROADS) {
    mctx.fillRect(0, (road - ROAD_W / 2) * scale, S, ROAD_W * scale);
    mctx.fillRect((road - ROAD_W / 2) * scale, 0, ROAD_W * scale, S);
  }
  mctx.fillStyle = '#5a5f6e';
  for (const b of g.city.buildings) {
    mctx.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  const dot = (x, y, color, rad) => {
    mctx.fillStyle = color;
    mctx.beginPath(); mctx.arc(x * scale, y * scale, rad, 0, Math.PI * 2); mctx.fill();
  };
  if (g.activeTarget) dot(g.activeTarget.x, g.activeTarget.y, '#ffd23d', 5);
  for (const c of g.cops) dot(c.x, c.y, '#4f8dff', 3);
  for (const rv of g.rivals) if (!rv.dead) dot(rv.x, rv.y, '#ff4f4f', 3);
  const px = g.player.inCar ? g.player.inCar.x : g.player.x;
  const py = g.player.inCar ? g.player.inCar.y : g.player.y;
  dot(px, py, '#fff', 4);
  mctx.strokeStyle = '#fff';
  mctx.lineWidth = 2;
  mctx.beginPath(); mctx.arc(px * scale, py * scale, 6, 0, Math.PI * 2); mctx.stroke();
  // Blit to the main canvas, top-right.
  const { ctx } = r;
  const cw = r.canvasW, chh = r.canvasH;
  ctx.drawImage(mini, cw - S - 14, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cw - S - 14, 14, S, S);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const hh = Math.floor(g.timeOfDay) % 24;
  ctx.fillText(`NEON BAY  •  ${String(hh).padStart(2, '0')}:${String(Math.floor((g.timeOfDay % 1) * 60)).padStart(2, '0')}`, cw - S - 14, 14 + S + 18);
}

export function drawTitle(r, g, w, h) {
  const { ctx } = r;
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, w, h);
  // Neon skyline silhouette.
  ctx.fillStyle = '#12172a';
  const base = h * 0.72;
  let x = 0;
  const rngH = [0.5, 0.8, 0.4, 0.9, 0.65, 0.75, 0.45, 0.85, 0.6, 0.7, 0.55, 0.8];
  rngH.forEach((hh, i) => {
    const bw = w / rngH.length;
    ctx.fillRect(x, base - hh * h * 0.42, bw - 6, hh * h * 0.42 + h);
    ctx.fillStyle = 'rgba(255,210,61,0.5)';
    for (let wy = 0; wy < 5; wy++) {
      for (let wx = 0; wx < 3; wx++) {
        if ((i + wy + wx) % 3 === 0) ctx.fillRect(x + 8 + wx * 18, base - hh * h * 0.42 + 12 + wy * 22, 8, 10);
      }
    }
    ctx.fillStyle = '#12172a';
    x += bw;
  });
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(0, base, w, 4);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = `900 ${Math.min(96, w * 0.09)}px system-ui, sans-serif`;
  ctx.fillText('NEON BAY', w / 2, h * 0.30);
  ctx.fillStyle = '#ff2e88';
  ctx.font = `bold ${Math.min(26, w * 0.025)}px system-ui, sans-serif`;
  ctx.fillText('AN OPEN-CITY CRIME STORY', w / 2, h * 0.30 + 42);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'Jax Marlowe is broke in a city that never sleeps.',
    'Steal cars. Outrun the law. Run five jobs for Delia Voss.',
    'Take the Bay — or get buried in it.',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h * 0.48 + i * 26));
  const sel = g.menuSel || 0;
  const items = g.hasSave ? ['CONTINUE', 'NEW GAME', 'HOW TO PLAY'] : ['NEW GAME', 'HOW TO PLAY'];
  items.forEach((it, i) => {
    const y = h * 0.64 + i * 44;
    if (i === sel) {
      ctx.fillStyle = '#ffd23d';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('▶  ' + it, w / 2, y);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(it, w / 2, y);
    }
  });
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move / drive  •  E enter & exit car  •  F punch  •  Mouse aim, click to shoot  •  P pause  •  M mute', w / 2, h - 24);
  if (g.showHelp) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(w / 2 - 320, h * 0.2, 640, 420);
    ctx.strokeStyle = '#ffd23d';
    ctx.strokeRect(w / 2 - 320, h * 0.2, 640, 420);
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', w / 2, h * 0.2 + 44);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    const help = [
      'Walk with WASD / arrows. Hold Shift to run.',
      'Walk up to any car and press E to steal it. E again to get out.',
      'Drive with W/S (gas/brake), A/D to steer, Space to handbrake.',
      'Aim with the mouse, click to shoot. F throws a punch.',
      'Crimes raise your wanted stars. Cops chase — break line of',
      'sight and stay clean and the heat fades.',
      'Follow the gold marker: five story jobs, plus cash, health',
      'and repair pickups scattered around the Bay.',
      'Your progress saves automatically after each job. Good luck.',
    ];
    help.forEach((ln, i) => ctx.fillText(ln, w / 2, h * 0.2 + 84 + i * 26));
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Press any key to go back', w / 2, h * 0.2 + 380);
  }
}

export function drawPause(r, g, w, h) {
  const { ctx } = r;
  ctx.fillStyle = 'rgba(5,8,18,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume      S — save game      Q — quit to title', w / 2, h * 0.4 + 44);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Progress saves automatically after each completed job.', w / 2, h * 0.4 + 76);
}

export function drawEnd(r, g, w, h, kind) {
  const { ctx } = r;
  ctx.fillStyle = 'rgba(5,8,18,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  const title = kind === 'wasted' ? 'WASTED' : kind === 'busted' ? 'BUSTED' : 'NEON BAY IS YOURS';
  ctx.fillStyle = kind === 'complete' ? '#ffd23d' : '#ff3b30';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(title, w / 2, h * 0.42);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  const sub = kind === 'wasted'
    ? 'Jax got dropped in the Bay. The crew paid the hospital bill — this time.'
    : kind === 'busted'
      ? 'The Neon Bay PD finally caught up. Delia posted bail. Barely.'
      : 'All five jobs done. Delia Voss owns the night — and Jax owns the Bay.';
  ctx.fillText(sub, w / 2, h * 0.42 + 44);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Cash kept: ${fmtMoney(g.player.money)}   •   Jobs done: ${g.missions.done.length} / 5`, w / 2, h * 0.42 + 82);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press Enter to continue', w / 2, h * 0.42 + 130);
}

export function applyNightTint(r, g, w, h) {
  const n = nightFactor(g.timeOfDay);
  if (n <= 0.02) return;
  const { ctx } = r;
  ctx.fillStyle = `rgba(8, 12, 48, ${(n * 0.30).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
}
