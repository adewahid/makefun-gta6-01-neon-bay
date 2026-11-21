// main.js — Neon Bay's game loop and state machine.
// Screens: title → play ⇄ paused, with busted / wasted interludes and an
// end screen when the five-job campaign is done. This file owns the wanted
// meter, mission progression, police contact and the save points; the
// systems it wires together live in their own files.

import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createTraffic } from './traffic.js';
import { createPolice, MAX_WANTED } from './police.js';
import { createPlayer, updatePlayer } from './player.js';
import { createMissionState, currentMission, currentStage, activeTarget, advanceStage, showBanner, showToast, missionDone, MISSIONS } from './missions.js';
import { writeSave, readSave, clearSave } from './save.js';
import { createCamera, updateCamera, drawWorld, drawHUD, drawTitle, drawEnd, drawOverlay, drawPaused } from './render.js';
import { setupShot } from './shots.js';

const SEED = 7;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const city = buildCity(SEED);
const input = createInput();
const audio = createAudio();
const traffic = createTraffic(city, SEED);
const police = createPolice(city, SEED);
const player = createPlayer(city);
const camera = createCamera();

const game = {
  screen: 'title',
  city, traffic, police, player, camera, audio,
  missionState: createMissionState(),
  state: {
    money: 120,
    moneyEarned: 0,
    jobsDone: 0,
    missionIndex: 0,
    wanted: 0,
    timePlayed: 0,
  },
  floatingTexts: [],
  shakeAmount: 0,
  endTimer: 0,
  bustedTimer: 0,
  crimeTimer: 0, // seconds since the last crime; drives wanted decay
  hasSave: false,
  shotMode: null,
};

function addWanted(amount) {
  game.state.wanted = Math.min(MAX_WANTED, game.state.wanted + amount);
  game.crimeTimer = 0;
  if (game.state.wanted >= 1) audio.sirenSting();
}

function addFloatingText(x, y, text, color) {
  game.floatingTexts.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
}

function shake(amount) {
  game.shakeAmount = Math.max(game.shakeAmount, amount);
}

function syncMissionIndex() {
  game.state.missionIndex = game.missionState.missionIndex;
}

function startMission(index) {
  const mission = MISSIONS[index];
  if (!mission) return;
  if (mission.wantedOnStart) addWanted(mission.wantedOnStart);
  showBanner(game.missionState, mission.title, mission.giver, game.state.timePlayed, 3.5);
  audio.blip();
}

function completeStage(result) {
  const mission = currentMission(game.missionState);
  if (result === 'mission' && mission) {
    game.state.money += mission.reward;
    game.state.moneyEarned += mission.reward;
    game.state.jobsDone++;
    showBanner(game.missionState, 'JOB COMPLETE  +$' + mission.reward, mission.title + ' — nicely done.', game.state.timePlayed, 3.5);
    audio.missionDone();
    writeSave(game);
    syncMissionIndex();
    const next = currentMission(game.missionState);
    if (next) {
      startMission(game.missionState.missionIndex);
    } else {
      game.endTimer = 2.6; // let the banner land, then the end screen
    }
  } else if (result === 'stage') {
    audio.cash();
    const stage = currentStage(game.missionState);
    if (stage) showToast(game.missionState, stage.text, game.state.timePlayed, 2.5);
  }
}

function onStealCar() {
  const stage = currentStage(game.missionState);
  if (stage && stage.type === 'inCar') completeStage(advanceStage(game.missionState));
}

function resetRun(fromSave) {
  const save = fromSave ? readSave() : null;
  game.missionState = createMissionState();
  game.state.money = 120;
  game.state.moneyEarned = 0;
  game.state.jobsDone = 0;
  game.state.wanted = 0;
  game.state.timePlayed = 0;
  game.floatingTexts = [];
  game.endTimer = 0;
  police.clear();
  player.x = 650;
  player.y = 780;
  player.angle = 0;
  player.onFoot = true;
  player.health = 100;
  player.car = null;
  player.speed = 0;
  if (save) {
    game.state.money = save.money;
    game.state.moneyEarned = save.moneyEarned;
    game.state.jobsDone = save.jobsDone;
    game.state.timePlayed = save.timePlayed || 0;
    game.missionState.missionIndex = save.missionIndex;
    player.x = save.x;
    player.y = save.y;
    showToast(game.missionState, 'Welcome back — progress restored.', 0, 3);
  }
  camera.x = player.x - 640;
  camera.y = player.y - 360;
  syncMissionIndex();
  if (game.missionState.missionIndex < MISSIONS.length) startMission(game.missionState.missionIndex);
}

function respawnAfterTrouble(kind) {
  const fine = kind === 'busted' ? 150 : 200;
  const lost = Math.min(game.state.money, fine);
  game.state.money -= lost;
  game.state.wanted = 0;
  game.crimeTimer = 0;
  police.clear();
  player.health = 100;
  player.onFoot = true;
  if (player.car) {
    traffic.dropCar(player.car);
    player.car = null;
  }
  player.x = city.landmarks.hospital.x;
  player.y = city.landmarks.hospital.y + 60;
  player.speed = 0;
  camera.x = player.x - 640;
  camera.y = player.y - 360;
  game.screen = 'play';
  showToast(game.missionState, kind === 'busted' ? 'BUSTED — fined $' + lost + '. The crew bailed you out.' : 'WASTED — hospital bill $' + lost + '.', game.state.timePlayed, 3.5);
}

const world = {
  traffic, police, city, audio,
  state: game.state,
  addWanted, addFloatingText, shake, onStealCar,
};

function updatePlay(dt) {
  const now = game.state.timePlayed;
  game.state.timePlayed += dt;
  game.crimeTimer += dt;

  // Wanted decays after 12 clean seconds, one star per 8 seconds.
  if (game.state.wanted > 0 && game.crimeTimer > 12) {
    game.state.wanted = Math.max(0, game.state.wanted - dt / 8);
  }

  updatePlayer(player, input, dt, world);
  traffic.update(dt, player.car);
  police.update(dt, player, Math.ceil(game.state.wanted));

  // Police contact: ramming the player's car, or cornering the player.
  for (const c of police.cruisers) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (!player.onFoot && player.car && d < 34 && c.ramCooldown <= 0) {
      c.ramCooldown = 1.0;
      player.car.health -= 10;
      player.health -= 4;
      c.speed *= 0.4;
      player.car.speed *= 0.85;
      audio.crash();
      shake(7);
      addFloatingText(player.x, player.y - 32, 'RAMMED!', '#ff2e2e');
    }
    if (player.onFoot && d < 30) {
      game.bustedTimer += dt;
      if (game.bustedTimer > 1.2) {
        game.bustedTimer = 0;
        audio.busted();
        game.screen = 'busted';
        return;
      }
    } else {
      game.bustedTimer = Math.max(0, game.bustedTimer - dt * 2);
    }
  }

  if (player.health <= 0) {
    audio.busted();
    game.screen = 'wasted';
    return;
  }

  // Mission progression.
  const stage = currentStage(game.missionState);
  if (stage) {
    if (stage.type === 'goto') {
      const target = activeTarget(game.missionState, city);
      if (target) {
        const d = Math.hypot(target.x - player.x, target.y - player.y);
        const wantedOk = !stage.requireWantedBelow || game.state.wanted < stage.requireWantedBelow;
        if (d < 52 && wantedOk) {
          completeStage(advanceStage(game.missionState));
        } else if (d < 52 && !wantedOk) {
          showToast(game.missionState, 'Too hot — lose the cops first! (' + Math.ceil(game.state.wanted) + '★)', now, 1.5);
        }
      }
    }
  }

  // End of campaign, after the final banner.
  if (missionDone(game.missionState)) {
    game.endTimer -= dt;
    if (game.endTimer <= 0) {
      game.screen = 'end';
      writeSave(game);
    }
  }

  // Audio follows the action.
  audio.setEngine(player.onFoot ? 0 : Math.abs(player.car ? player.car.speed : 0) / 430, !player.onFoot);
  audio.setSiren(game.state.wanted >= 1);

  // Floating texts drift up and fade.
  for (const ft of game.floatingTexts) {
    ft.y -= 26 * dt;
    ft.life -= dt;
  }
  game.floatingTexts = game.floatingTexts.filter((ft) => ft.life > 0);
  game.shakeAmount = Math.max(0, game.shakeAmount - dt * 22);

  updateCamera(camera, player, dt, game.shakeAmount);
}

function render(time) {
  ctx.clearRect(0, 0, 1280, 720);
  if (game.screen === 'title') {
    drawTitle(ctx, game, time, game.hasSave);
    return;
  }
  drawWorld(ctx, game, time);
  if (game.screen === 'play' || game.screen === 'paused') {
    drawHUD(ctx, game, time);
    if (game.screen === 'paused') drawPaused(ctx);
  } else if (game.screen === 'busted') {
    drawOverlay(ctx, 'BUSTED!', 'The Bay PD caught up with you.', 'ENTER — walk out of the hospital');
  } else if (game.screen === 'wasted') {
    drawOverlay(ctx, 'WASTED', 'You woke up at St. Coral Hospital.', 'ENTER — back on the streets');
  } else if (game.screen === 'end') {
    drawHUD(ctx, game, time);
    drawEnd(ctx, game);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (input.wasPressed('m')) audio.setMuted(!audio.isMuted());

  if (game.screen === 'title') {
    audio.unlock();
    if (input.wasPressed('enter')) {
      audio.unlock();
      resetRun(false);
      game.screen = 'play';
    } else if (input.wasPressed('c') && game.hasSave) {
      audio.unlock();
      resetRun(true);
      game.screen = 'play';
    }
  } else if (game.screen === 'play') {
    if (input.wasPressed('p')) {
      game.screen = 'paused';
    } else {
      updatePlay(dt);
    }
  } else if (game.screen === 'paused') {
    if (input.wasPressed('p')) game.screen = 'play';
  } else if (game.screen === 'busted' || game.screen === 'wasted') {
    if (input.wasPressed('enter')) respawnAfterTrouble(game.screen);
  } else if (game.screen === 'end') {
    if (input.wasPressed('enter')) {
      clearSave();
      resetRun(false);
      game.screen = 'play';
    }
  }

  render(t);
  input.endFrame();
  requestAnimationFrame(loop);
}

// Boot.
game.hasSave = !!readSave();
game.shotMode = setupShot(game, { resetRun, startMission, addWanted, showBanner });
if (!game.shotMode) {
  requestAnimationFrame(loop);
} else {
  // Screenshot mode: pre-simulate so traffic, peds and police settle into
  // a lively frame, then render on demand for the shot. The chase shot
  // sims fewer frames so the cruisers are closing in, not piled on top
  // of the player yet.
  const simFrames = game.shotMode === 'chase' ? 28 : game.shotMode === 'play' ? 60 : 0;
  for (let i = 0; i < simFrames; i++) {
    if (game.screen === 'play') updatePlay(1 / 60);
  }
  render(2.5);
  // Keep rendering so the page stays live for the screenshot timer.
  requestAnimationFrame(loop);
}

window.__neonBay = game;
