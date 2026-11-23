// Solmar Bay — bootstrap, the game loop, menus, busted/wasted flow, saving,
// and the debug hooks the play-test uses. This is the only file index.html
// loads; everything else is a module it wires together.
import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, DISTRICTS,
  clamp, makeRng, fmtCash,
} from './config.js';
import { buildCity, districtAt } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createPlayer, updatePlayer } from './player.js';
import {
  makeCar, spawnParkedCar, spawnTrafficCar, drivePlayerCar,
  updateTraffic, updateTargetCar, enterCar, exitCar,
} from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { createPolice, updatePolice } from './police.js';
import {
  MISSIONS, SAFEHOUSE, startMission, updateMission,
  currentObjective, currentTarget,
} from './missions.js';
import { createActivities } from './activities.js';
import { createHud, drawHud } from './hud.js';
import { createCamera, render } from './render.js';
import { loadSave, writeSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newGameState(fromSave) {
  const rng = makeRng(20261123);
  const city = buildCity(20261123);
  const S = {
    rng, city,
    cityDistricts: DISTRICTS,
    mode: 'title', // title | play | paused | busted | wasted | storydone
    time: 0,
    clock: { minutes: 540, isNight: false }, // 09:00
    camera: createCamera(),
    input: createInput(canvas),
    audio: createAudio(),
    particles: createParticles(),
    hud: createHud(),
    player: createPlayer(ROAD_XS[0] + 60, ROAD_YS[4]),
    cars: [], peds: [], cops: [], enemies: [],
    targetCar: null,
    police: createPolice(),
    missions: { done: 0, index: -1, def: null, state: 'idle', passTimer: 0, objectiveText: '', target: null },
    mission: {},
    stats: { fares: 0, missionsPassed: 0 },
    dangerPulse: 0, dangerX: 0, dangerY: 0,
    playerDistrict: DISTRICTS[0],
    menuIndex: 0,
    titleBlink: 0,
  };
  S.activities = createActivities(S);
  S.main = {
    busted(st) { busted(st); },
    wasted(st) { wasted(st); },
  };
  // Parked cars worth stealing, spread over the city.
  for (let i = 0; i < 10; i++) S.cars.push(spawnParkedCar(city, rng));
  for (let i = 0; i < 12; i++) S.cars.push(spawnTrafficCar(city, rng));
  spawnPeds(S, 46);
  if (fromSave) {
    S.player.cash = fromSave.cash ?? 250;
    S.missions.done = fromSave.missionsDone ?? 0;
    S.player.kills = fromSave.kills ?? 0;
    S.stats.fares = fromSave.fares ?? 0;
    S.clock.minutes = fromSave.timeMinutes ?? 540;
    if (fromSave.px) { S.player.x = fromSave.px; S.player.y = fromSave.py; }
    for (let i = 0; i < (fromSave.packages ?? 0); i++) {
      const p = S.city.packages[i];
      if (p) p.taken = true;
    }
  }
  return S;
}

let S = newGameState(loadSave());
let save = loadSave();

// --- flow helpers -------------------------------------------------------------
function startStory() {
  S.audio.unlock();
  S.mode = 'play';
  S.missions.done = 0;
  startMission(S, 0);
  writeSave(S);
}

function continueGame() {
  S.audio.unlock();
  S.mode = 'play';
  if (S.missions.done < MISSIONS.length) {
    startMission(S, S.missions.done);
  } else {
    S.hud.flash('Story complete — free roam');
  }
}

function freeRoam() {
  S.audio.unlock();
  S.mode = 'play';
  S.hud.flash('Free roam — P pauses, jobs are in the pause menu');
}

function respawn(st) {
  st.player.health = 100;
  st.player.armor = 0;
  st.player.inCar = null;
  st.player.x = SAFEHOUSE.x; st.player.y = SAFEHOUSE.y;
  st.police.wanted = 0; st.police.heat = 0;
  for (const c of st.cops) c.gone = true;
  st.enemies = [];
  st.missions.state = 'idle';
  st.mode = 'play';
  st.hud.flash('Back on your feet — the city is still yours');
  writeSave(st);
}

function busted(st) {
  if (st.mode !== 'play') return;
  st.mode = 'busted';
  const bail = Math.min(st.player.cash, 200);
  st.player.cash -= bail;
  st.audio.busted();
  st.bustedBail = bail;
  writeSave(st);
}

function wasted(st) {
  if (st.mode !== 'play') return;
  st.mode = 'wasted';
  const bill = Math.min(st.player.cash, 150);
  st.player.cash -= bill;
  st.audio.missionFail();
  st.wastedBill = bill;
  writeSave(st);
}

// --- menus ----------------------------------------------------------------------
const TITLE_MENU = [
  { label: 'New Story', action: () => startStory() },
  { label: 'Continue', action: () => continueGame(), when: () => !!save && save.missionsDone > 0 },
  { label: 'Free Roam', action: () => freeRoam() },
  { label: 'How to play', action: () => { S.showHelp = !S.showHelp; } },
];

function visibleMenu() {
  return TITLE_MENU.filter((m) => !m.when || m.when());
}

function drawTitle(now) {
  // Backdrop: the city at dusk, slow pan.
  const t = now / 1000;
  S.camera.x = 1800 + Math.sin(t / 24) * 500;
  S.camera.y = 1400 + Math.cos(t / 31) * 300;
  S.camera.zoom = 0.62;
  const keepMode = S.mode;
  S.mode = 'play';
  render(S, ctx, now);
  S.mode = keepMode;

  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW_W / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('an open-city crime story', VIEW_W / 2, 228);
  ctx.fillStyle = '#7dff6a';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Steal cars · Outrun the SCPD · Run 7 jobs for Marisol Vega · Find all 10 hidden packages', VIEW_W / 2, 262);

  const menu = visibleMenu();
  const bx = VIEW_W / 2 - 190; const bw = 380; const bh = 46;
  menu.forEach((item, i) => {
    const y = 310 + i * 58;
    const sel = i === S.menuIndex;
    ctx.fillStyle = sel ? '#ffd24d' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, y, bw, bh, 10); ctx.fill();
    ctx.fillStyle = sel ? '#1a1a1a' : '#ffffff';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(item.label, VIEW_W / 2, y + 30);
    item._rect = { x: bx, y, w: bw, h: bh };
  });
  ctx.textAlign = 'left';

  if (S.showHelp) {
    ctx.fillStyle = 'rgba(10,10,20,0.88)';
    roundRect(ctx, 290, 560, 700, 130, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD walk / drive · E enter or steal a car · F punch · Mouse aim, click to shoot', VIEW_W / 2, 592);
    ctx.fillText('Shift sprint / handbrake · P pause · M mute · Stars rise with crime — stay unseen to cool off', VIEW_W / 2, 618);
    ctx.fillText('Taxi fares pay cash · Green crates give ammo · Your progress autosaves', VIEW_W / 2, 644);
    ctx.fillText('Click a menu item or use ↑ ↓ + Enter', VIEW_W / 2, 670);
    ctx.textAlign = 'left';
  } else if (Math.floor(now / 500) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click a menu item or press Enter', VIEW_W / 2, 600);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Solmar Bay is an original game. No real city, person or brand appears in it.', VIEW_W / 2, 706);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  const next = S.missions.done < MISSIONS.length ? MISSIONS[S.missions.done].title : 'Story complete';
  ctx.fillText(`Jobs done: ${S.missions.done}/7 · Next job: ${next}`, VIEW_W / 2, 210);
  ctx.fillText(`Cash ${fmtCash(S.player.cash)} · Fares ${S.stats.fares} · Packages ${S.city.packages.filter((p) => p.taken).length}/10`, VIEW_W / 2, 238);
  const items = [
    { label: 'Resume  (P)', action: () => { S.mode = 'play'; } },
    { label: 'Start next job', action: () => { if (S.missions.done < MISSIONS.length) { S.mode = 'play'; startMission(S, S.missions.done); } } },
    { label: S.audio.muted ? 'Unmute  (M)' : 'Mute  (M)', action: () => S.audio.toggleMute() },
    { label: 'Save & back to title', action: () => { writeSave(S); save = loadSave(); S.mode = 'title'; S.menuIndex = 0; } },
  ];
  const bx = VIEW_W / 2 - 190; const bw = 380; const bh = 46;
  items.forEach((item, i) => {
    const y = 290 + i * 58;
    const sel = i === S.menuIndex;
    ctx.fillStyle = sel ? '#ffd24d' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, y, bw, bh, 10); ctx.fill();
    ctx.fillStyle = sel ? '#1a1a1a' : '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(item.label, VIEW_W / 2, y + 30);
    item._rect = { x: bx, y, w: bw, h: bh };
  });
  S._pauseItems = items;
  ctx.textAlign = 'left';
}

function drawEndScreen(kind) {
  ctx.fillStyle = 'rgba(8,10,24,0.8)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#4f9aff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('BUSTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`The SCPD took you in. Bail cost ${fmtCash(S.bustedBail || 0)}.`, VIEW_W / 2, 350);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('WASTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`You wake up at St. Coral General. Hospital bill ${fmtCash(S.wastedBill || 0)}.`, VIEW_W / 2, 350);
  } else {
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('STORY COMPLETE', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('All seven jobs done. Solmar Bay is yours — keep roaming, keep earning.', VIEW_W / 2, 350);
  }
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 18px system-ui, sans-serif';
  if (Math.floor(performance.now() / 500) % 2 === 0) ctx.fillText('Press Enter to continue', VIEW_W / 2, 420);
  ctx.textAlign = 'left';
}

function roundRect(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.arcTo(x + w, y, x + w, y + h, r);
  ctx2.arcTo(x + w, y + h, x, y + h, r);
  ctx2.arcTo(x, y + h, x, y, r);
  ctx2.arcTo(x, y, x + w, y, r);
  ctx2.closePath();
}

// --- main loop ------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = S.input;

  if (input.wasPressed('mute')) S.audio.toggleMute();

  if (S.mode === 'title') {
    const menu = visibleMenu();
    if (input.wasPressed('down')) S.menuIndex = (S.menuIndex + 1) % menu.length;
    if (input.wasPressed('up')) S.menuIndex = (S.menuIndex - 1 + menu.length) % menu.length;
    if (input.wasPressed('enter')) menu[S.menuIndex].action();
    if (input.mouseClicked) {
      for (let i = 0; i < menu.length; i++) {
        const r = menu[i]._rect;
        if (r && input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
          S.menuIndex = i;
          menu[i].action();
        }
      }
    }
    S.audio.unlock();
    drawTitle(now);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (S.mode === 'paused') {
    if (input.wasPressed('pause') || input.wasPressed('enter') && S.menuIndex === 0) { S.mode = 'play'; }
    if (input.wasPressed('down')) S.menuIndex = (S.menuIndex + 1) % 4;
    if (input.wasPressed('up')) S.menuIndex = (S.menuIndex - 1 + 4) % 4;
    if (input.wasPressed('enter') && S._pauseItems) S._pauseItems[S.menuIndex].action();
    if (input.mouseClicked && S._pauseItems) {
      for (let i = 0; i < S._pauseItems.length; i++) {
        const r = S._pauseItems[i]._rect;
        if (r && input.mouseX >= r.x && input.mouseX <= r.x + r.w && input.mouseY >= r.y && input.mouseY <= r.y + r.h) {
          S.menuIndex = i;
          S._pauseItems[i].action();
        }
      }
    }
    render(S, ctx, now);
    drawPause();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (S.mode === 'busted' || S.mode === 'wasted' || S.mode === 'storydone') {
    if (input.wasPressed('enter')) {
      if (S.mode === 'storydone') { S.mode = 'play'; S.hud.flash('Free roam — Solmar Bay is yours'); }
      else respawn(S);
    }
    render(S, ctx, now);
    drawEndScreen(S.mode);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  // --- play ---------------------------------------------------------------------
  if (input.wasPressed('pause')) {
    S.mode = 'paused';
    S.menuIndex = 0;
    writeSave(S);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  S.time += dt;
  S.clock.minutes += dt; // 1 game minute per real second: a full day in 24 min
  if (S.clock.minutes >= 1440) S.clock.minutes -= 1440;

  // Mission card advance.
  if (S.missions.state === 'passed' || S.missions.state === 'failed') {
    S.missions.passTimer -= dt;
    const done = S.missions.state === 'passed';
    if (input.wasPressed('enter') || S.missions.passTimer <= 0) {
      S.missions.state = 'idle';
      writeSave(S);
      if (done && S.missions.done >= MISSIONS.length) {
        S.mode = 'storydone';
      } else if (done) {
        startMission(S, S.missions.done);
      } else {
        // Failed: retry the same mission on Enter, else free roam.
        if (input.wasPressed('enter')) startMission(S, S.missions.index);
      }
    }
  }

  // Driving vs on foot. E while driving gets out of the car.
  if (S.player.inCar) {
    if (input.wasPressed('interact')) exitCar(S);
    else drivePlayerCar(S, S.player.inCar, dt, input);
  } else updatePlayer(S, dt, input);

  updateTraffic(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateTargetCar(S, dt);
  updateMission(S, dt);
  S.activities.update(dt);
  S.particles.update(dt);
  S.hud.update(dt);
  S.dangerPulse = Math.max(0, S.dangerPulse - dt);
  S.missions.objectiveText = currentObjective(S);
  S.missions.target = currentTarget(S);
  S.playerDistrict = districtAt(S.player.x, S.player.y);
  S.audio.setEngine(!!S.player.inCar, S.player.inCar ? Math.abs(S.player.inCar.speed) / 470 : 0);

  render(S, ctx, now);
  drawHud(S, ctx);
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// --- debug hooks for the play-test (window.__SOLMAR) ----------------------------
window.__SOLMAR = {
  S,
  version: 'solmar-bay-v6',
  startMission(i) { if (S.mode !== 'play') S.mode = 'play'; return startMission(S, i); },
  setWanted(n) { S.police.wanted = n; S.police.heat = n; },
  setTime(h) { S.clock.minutes = h * 60; },
  teleport(x, y) {
    if (S.player.inCar) { S.player.inCar.x = x; S.player.inCar.y = y; }
    S.player.x = x; S.player.y = y;
  },
  spawnAndEnter(type, x, y, color) {
    const car = makeCar(type, x, y, 0, { driver: 'parked', color });
    S.cars.push(car);
    enterCar(S, car);
    return car.id;
  },
  play() { S.mode = 'play'; },
  title() { S.mode = 'title'; },
  clearBanner() { S.hud.bannerTimer = 0; S.hud.card = null; },
  state() {
    return {
      mode: S.mode,
      cash: S.player.cash, health: Math.round(S.player.health), ammo: S.player.ammo,
      x: Math.round(S.player.x), y: Math.round(S.player.y),
      inCar: !!S.player.inCar,
      wanted: S.police.wanted,
      missionState: S.missions.state, missionIndex: S.missions.index,
      missionsDone: S.missions.done,
      cars: S.cars.length, peds: S.peds.length, cops: S.cops.length,
      enemies: S.enemies.filter((e) => !e.dead).length,
      clock: S.clock.minutes,
      objective: S.missions.objectiveText,
    };
  },
};
window.__gameReady = true;
