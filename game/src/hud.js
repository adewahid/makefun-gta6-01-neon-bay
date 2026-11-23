// Solmar Bay — the HUD: cash/health/armor/ammo, wanted stars, the clock,
// the objective banner, flash messages, mission cards, and the minimap.
// Everything here is drawn on the canvas so screenshots show the full HUD.
import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_XS, ROAD_YS,
  clamp, fmtCash, fmtClock,
} from './config.js';
import { SAFEHOUSE, CASINO, DOCKS, GARAGE } from './missions.js';

export function createHud() {
  return {
    flashText: '', flashTimer: 0,
    bannerTitle: '', bannerText: '', bannerTimer: 0,
    card: null, // { kind: 'passed'|'failed', title, sub, timer }
    floats: [],
    flash(text) { this.flashText = text; this.flashTimer = 3; },
    banner(title, text) { this.bannerTitle = title; this.bannerText = text; this.bannerTimer = 6; },
    missionPassed(title, reward) {
      this.card = { kind: 'passed', title, sub: `Reward ${reward} — press Enter to continue`, timer: 4 };
    },
    missionFailed(title) {
      this.card = { kind: 'failed', title, sub: 'Press Enter to retry, or keep roaming free', timer: 4 };
    },
    floatText(x, y, text) { this.floats.push({ x, y, text, life: 1.4 }); },
    update(dt) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.card) { this.card.timer -= dt; if (this.card.timer <= 0) this.card = null; }
      for (let i = this.floats.length - 1; i >= 0; i--) {
        this.floats[i].life -= dt;
        if (this.floats[i].life <= 0) this.floats.splice(i, 1);
      }
    },
  };
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

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = color;
  const fw = Math.max(0, Math.min(1, frac)) * (w - 4);
  if (fw > 0) { roundRect(ctx, x + 2, y + 2, fw, h - 4, 3); ctx.fill(); }
}

export function drawHud(S, ctx) {
  const hud = S.hud;
  const p = S.player;
  const P = S.police;

  // --- top-left: cash, health, armor, ammo -------------------------------
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, 12, 240, 96, 10); ctx.fill();
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(fmtCash(p.cash), 26, 44);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', 26, 64);
  bar(ctx, 90, 54, 140, 10, p.health / 100, p.health > 30 ? '#4fc94f' : '#e04040');
  ctx.fillText('ARMOR', 26, 82);
  bar(ctx, 90, 72, 140, 10, p.armor / 100, '#4f9ac9');
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`AMMO ${p.ammo}   KILLS ${p.kills}`, 26, 100);

  // --- top-right: wanted stars + clock ------------------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, VIEW_W - 254, 12, 240, 64, 10); ctx.fill();
  ctx.font = 'bold 26px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < P.wanted ? '#ffd24d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 238 + i * 30, 44);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(fmtClock(S.clock.minutes) + (S.clock.isNight ? '  ☾' : '  ☀'), VIEW_W - 118, 40);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(S.missions.done + '/7 jobs done', VIEW_W - 118, 60);

  // --- objective banner (top centre) --------------------------------------
  const obj = S.missions.objectiveText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(obj).width + 32;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, (VIEW_W - ow) / 2, 12, ow, 32, 8); ctx.fill();
  ctx.fillStyle = '#ffd24d';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW_W / 2, 34);
  ctx.textAlign = 'left';

  // --- flash message -------------------------------------------------------
  if (hud.flashTimer > 0) {
    ctx.globalAlpha = Math.min(1, hud.flashTimer);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(hud.flashText, VIEW_W / 2, 92);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // --- mission intro banner ------------------------------------------------
  if (hud.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, hud.bannerTimer);
    ctx.fillStyle = 'rgba(10,10,20,0.82)';
    roundRect(ctx, 240, 170, VIEW_W - 480, 150, 12); ctx.fill();
    ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 2;
    roundRect(ctx, 240, 170, VIEW_W - 480, 150, 12); ctx.stroke();
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hud.bannerTitle, VIEW_W / 2, 212);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    wrapText(ctx, hud.bannerText, VIEW_W / 2, 242, VIEW_W - 540, 22);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // --- mission passed / failed card ---------------------------------------
  if (hud.card) {
    const ok = hud.card.kind === 'passed';
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    roundRect(ctx, 340, 260, VIEW_W - 680, 130, 12); ctx.fill();
    ctx.strokeStyle = ok ? '#7dff6a' : '#ff5a4d'; ctx.lineWidth = 3;
    roundRect(ctx, 340, 260, VIEW_W - 680, 130, 12); ctx.stroke();
    ctx.fillStyle = ok ? '#7dff6a' : '#ff5a4d';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ok ? 'MISSION PASSED' : 'MISSION FAILED', VIEW_W / 2, 308);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(hud.card.title, VIEW_W / 2, 340);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(hud.card.sub, VIEW_W / 2, 366);
    ctx.textAlign = 'left';
  }

  // --- speedometer (driving) ----------------------------------------------
  if (p.inCar) {
    const car = p.inCar;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, VIEW_W - 150, VIEW_H - 210, 136, 54, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(Math.abs(car.speed) * 0.24)), VIEW_W - 58, VIEW_H - 176);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('km/h', VIEW_W - 26, VIEW_H - 176);
    ctx.fillText(car.spec.name, VIEW_W - 26, VIEW_H - 160);
    ctx.textAlign = 'left';
    bar(ctx, VIEW_W - 138, VIEW_H - 148, 112, 8, Math.max(0, car.health) / 100, '#e07a4f');
  }

  drawMinimap(S, ctx);
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w; yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

// --- minimap -----------------------------------------------------------------
function drawMinimap(S, ctx) {
  const MW = 232; const MH = 190;
  const mx = 14; const my = VIEW_H - MH - 14;
  const sx = MW / WORLD_W; const sy = MH / WORLD_H;
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  roundRect(ctx, mx - 6, my - 6, MW + 12, MH + 12, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, mx - 6, my - 6, MW + 12, MH + 12, 10); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, MW, MH); ctx.clip();
  // Water + beach.
  ctx.fillStyle = '#1c4a63';
  ctx.fillRect(mx, my, MW, MH);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(mx, my, 5, MH);
  // Roads.
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 5;
  for (const x of ROAD_XS) { ctx.beginPath(); ctx.moveTo(mx + x * sx, my); ctx.lineTo(mx + x * sx, my + MH); ctx.stroke(); }
  for (const y of ROAD_YS) { ctx.beginPath(); ctx.moveTo(mx, my + y * sy); ctx.lineTo(mx + MW, my + y * sy); ctx.stroke(); }
  // Landmarks.
  ctx.fillStyle = '#ffd24d';
  ctx.fillRect(mx + SAFEHOUSE.x * sx - 3, my + SAFEHOUSE.y * sy - 3, 6, 6);
  ctx.fillStyle = '#ff7ad9';
  ctx.fillRect(mx + CASINO.x * sx - 3, my + CASINO.y * sy - 3, 6, 6);
  ctx.fillStyle = '#7ad9ff';
  ctx.fillRect(mx + DOCKS.x * sx - 3, my + DOCKS.y * sy - 3, 6, 6);
  // Mission target.
  const t = S.missions.target;
  if (t) {
    const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Fare destination.
  if (S.activities.fare && S.activities.fare.state === 'riding') {
    const d = S.activities.fare.dest;
    ctx.fillStyle = '#7dff6a';
    ctx.fillRect(mx + d.x * sx - 3, my + d.y * sy - 3, 6, 6);
  }
  // Cops.
  ctx.fillStyle = '#4f9aff';
  for (const c of S.cops) {
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = S.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();

  // Compass + district label.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('N', mx + MW / 2 - 4, my - 12 + 6);
  const d = S.playerDistrict;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(d ? d.name : '', mx + 2, my + MH + 22);
}
