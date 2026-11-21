// shots.js — deterministic screenshot states for the four required shots.
// ?shot=start  → title screen
// ?shot=play   → driving with the HUD, minimap and a mission active
// ?shot=chase  → wanted level 3, police cruisers closing in
// ?shot=end    → campaign-complete end screen with jobs and money
// The page is only ever run inside this screenshot flow, and the states
// are staged from the live game (a real car, real cruisers, real HUD)
// so the shots are honest renders of the game itself.

import { showBanner, showToast } from './missions.js';

export function setupShot(game, hooks) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  game.shotMode = shot;

  const { player, traffic, police, city, state } = game;
  const avenue = city.avenues[4]; // 1300 — downtown, buildings both sides
  const street = city.streets[2]; // 780

  if (shot === 'start') {
    game.screen = 'title';
    game.hasSave = false;
    return shot;
  }

  if (shot === 'play') {
    // Mid-campaign: job 2, the pickup, driving downtown.
    hooks.resetRun(false);
    const missionState = game.missionState; // resetRun builds a fresh one
    missionState.missionIndex = 1;
    missionState.stageIndex = 0;
    state.missionIndex = 1;
    state.money = 640;
    state.moneyEarned = 390;
    state.jobsDone = 1;
    state.wanted = 0;
    state.timePlayed = 420;
    player.onFoot = false;
    player.car = { x: avenue, y: street, angle: 0, speed: 130, health: 100, color: '#e63946', w: 34, h: 18 };
    player.x = avenue;
    player.y = street;
    player.angle = 0;
    game.camera.x = player.x - 640;
    game.camera.y = player.y - 360;
    game.screen = 'play';
    showBanner(missionState, 'JOB 2 — THE PICKUP', 'A package is waiting at Coral Mall.', state.timePlayed, 999);
    showToast(missionState, 'Drive to Coral Mall — 3 blocks east', state.timePlayed, 999);
    return shot;
  }

  if (shot === 'chase') {
    // Job 3: three stars, cruisers already on the player's tail.
    hooks.resetRun(false);
    const missionState = game.missionState; // resetRun builds a fresh one
    missionState.missionIndex = 2;
    missionState.stageIndex = 0;
    state.missionIndex = 2;
    state.money = 1040;
    state.moneyEarned = 790;
    state.jobsDone = 2;
    state.wanted = 3;
    state.timePlayed = 900;
    player.onFoot = false;
    player.car = { x: avenue, y: street, angle: 0, speed: 240, health: 82, color: '#ffbe0b', w: 34, h: 18 };
    player.x = avenue;
    player.y = street;
    player.angle = 0;
    game.camera.x = player.x - 640;
    game.camera.y = player.y - 360;
    // Stage the cruisers close behind and beside the player.
    police.cruisers.push(
      { x: avenue - 180, y: street - 16, angle: 0, speed: 300, color: '#1d3557', w: 34, h: 18, siren: true, ramCooldown: 0 },
      { x: avenue - 260, y: street + 16, angle: 0, speed: 300, color: '#1d3557', w: 34, h: 18, siren: true, ramCooldown: 0 },
      { x: avenue + 120, y: street - 220, angle: Math.PI / 2, speed: 280, color: '#1d3557', w: 34, h: 18, siren: true, ramCooldown: 0 },
    );
    game.screen = 'play';
    showBanner(missionState, 'JOB 3 — HOT PURSUIT', 'Three stars. Shake the cops, reach the Safehouse.', state.timePlayed, 999);
    return shot;
  }

  if (shot === 'end') {
    state.money = 3870;
    state.moneyEarned = 3750;
    state.jobsDone = 5;
    state.timePlayed = 1254;
    game.missionState.missionIndex = 5;
    game.missionState.stageIndex = 0;
    game.screen = 'end';
    return shot;
  }

  return null;
}
