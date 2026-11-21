// render.js — everything the player sees: the city, the cars, the HUD,
// the minimap and the menus. Top-down 2D canvas, sun-soaked palette:
// warm roads, pastel buildings, neon signs, a turquoise bay.

import { WORLD_W, WORLD_H, ROAD_W, BEACH_X } from './city.js';
import { currentMission, currentStage, activeTarget } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createCamera() {
  return { x: 650, y: 780, shakeX: 0, shakeY: 0 };
}

export function updateCamera(camera, player, dt, shakeAmount) {
  const tx = player.x - VIEW_W / 2;
  const ty = player.y - VIEW_H / 2;
  camera.x += (tx - camera.x) * Math.min(1, dt * 4);
  camera.y += (ty - camera.y) * Math.min(1, dt * 4);
  camera.x = Math.max(-80, Math.min(WORLD_W - VIEW_W + 80, camera.x));
  camera.y = Math.max(-80, Math.min(WORLD_H - VIEW_H + 80, camera.y));
  if (shakeAmount > 0) {
    camera.shakeX = (Math.random() - 0.5) * shakeAmount;
    camera.shakeY = (Math.random() - 0.5) * shakeAmount;
  } else {
    camera.shakeX = 0;
    camera.shakeY = 0;
  }
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

export function drawWorld(ctx, game, time) {
  const { city, traffic, police, player, camera } = game;
  const camX = camera.x + camera.shakeX;
  const camY = camera.y + camera.shakeY;
  ctx.save();
  ctx.translate(-camX, -camY);

  // Ground: warm grass, then the beach and the bay on the east edge.
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(camX - 40, camY - 40, VIEW_W + 80, VIEW_H + 80);
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(BEACH_X, camY - 40, WORLD_W - BEACH_X, VIEW_H + 80);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(2440, camY - 40, WORLD_W - 2440, VIEW_H + 80);
  // Bay waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let y = Math.floor(camY / 46) * 46; y < camY + VIEW_H + 46; y += 46) {
    ctx.beginPath();
    ctx.moveTo(2452 + Math.sin(time * 1.4 + y * 0.05) * 6, y);
    ctx.quadraticCurveTo(2470, y + 10, 2452 + Math.sin(time * 1.4 + y * 0.05 + 1) * 6, y + 22);
    ctx.stroke();
  }

  // Roads: asphalt with centre dashes and pale sidewalks.
  ctx.fillStyle = '#4a4e57';
  for (const a of city.avenues) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const s of city.streets) ctx.fillRect(0, s - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = '#8d8578';
  for (const a of city.avenues) {
    ctx.fillRect(a - ROAD_W / 2 - 8, 0, 8, WORLD_H);
    ctx.fillRect(a + ROAD_W / 2, 0, 8, WORLD_H);
  }
  for (const s of city.streets) {
    ctx.fillRect(0, s - ROAD_W / 2 - 8, WORLD_W, 8);
    ctx.fillRect(0, s + ROAD_W / 2, WORLD_W, 8);
  }
  ctx.fillStyle = '#e8c85a';
  for (const a of city.avenues) {
    for (let y = 40; y < WORLD_H; y += 52) ctx.fillRect(a - 2, y, 4, 26);
  }
  for (const s of city.streets) {
    for (let x = 40; x < WORLD_W; x += 52) ctx.fillRect(x, s - 2, 26, 4);
  }

  // Parks: green with trees.
  for (const park of city.parks) {
    ctx.fillStyle = '#7fb069';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#4c956c';
    for (let i = 0; i < park.trees; i++) {
      const tx = park.x + 16 + ((i * 53) % Math.max(20, park.w - 32));
      const ty = park.y + 16 + ((i * 37) % Math.max(20, park.h - 32));
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Parking lots: asphalt with white bays.
  for (const lot of city.parkingLots) {
    ctx.fillStyle = '#55595e';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 10; x < lot.x + lot.w - 10; x += 44) {
      ctx.strokeRect(x, lot.y + 8, 34, lot.h - 16);
    }
  }

  // Buildings: coloured block, darker roof, window grid, neon sign.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        ctx.fillRect(b.x + 8 + cx * 22, b.y + 8 + cy * 22, 10, 12);
      }
    }
    if (b.sign) {
      ctx.save();
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = b.signColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.signColor;
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.restore();
    }
  }

  // Palm trees.
  for (const palm of city.palms) {
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 14);
    ctx.stroke();
    ctx.fillStyle = '#2d9d4e';
    ctx.beginPath();
    ctx.arc(palm.x + 3, palm.y - 16, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission target beacon.
  const target = activeTarget(game.missionState, city);
  if (target && game.screen === 'play') {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▼ ' + target.name.toUpperCase(), target.x, target.y - 40);
    ctx.restore();
  }

  // Parked cars.
  for (const car of traffic.parked) drawCar(ctx, car, time, false);
  // Traffic.
  for (const car of traffic.cars) drawCar(ctx, car, time, false);
  // Police cruisers with flashing light bars.
  for (const c of police.cruisers) drawCar(ctx, c, time, true);

  // Pedestrians.
  for (const ped of traffic.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: on foot a bright figure, in a car a ringed car.
  if (player.onFoot) {
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 6, player.y + Math.sin(player.angle) * 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (player.punchTimer > 0) {
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (player.car) {
    drawCar(ctx, player.car, time, false);
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 3;
    ctx.save();
    ctx.translate(player.car.x, player.car.y);
    ctx.rotate(player.car.angle);
    roundRect(ctx, -22, -14, 44, 28, 8);
    ctx.stroke();
    ctx.restore();
  }

  // Floating texts.
  for (const ft of game.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawCar(ctx, car, time, isPolice) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -16, -8, 36, 20, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -18, -10, 36, 20, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = '#222831';
  roundRect(ctx, -6, -8, 12, 16, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.8)';
  roundRect(ctx, 6, -7, 6, 14, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(16, -9, 3, 4);
  ctx.fillRect(16, 5, 3, 4);
  if (isPolice) {
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-14, -11, 8, 4);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-14, 7, 8, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 2, 3);
  }
  ctx.restore();
}

// ---------- HUD ----------

export function drawHUD(ctx, game, time) {
  const { state, player, missionState } = game;
  const mission = currentMission(missionState);
  const stage = currentStage(missionState);

  // Money + health, top left.
  ctx.fillStyle = 'rgba(10,10,20,0.65)';
  roundRect(ctx, 14, 12, 250, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7cff00';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('$' + state.money.toLocaleString('en-US'), 28, 42);
  ctx.fillStyle = '#333';
  roundRect(ctx, 28, 52, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = player.health > 40 ? '#7cff00' : '#ff2e2e';
  roundRect(ctx, 28, 52, 150 * Math.max(0, player.health / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('HP', 186, 62);
  if (!player.onFoot && player.car) {
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 13px Arial';
    ctx.fillText(Math.round(Math.abs(player.car.speed) * 0.9) + ' mph', 28, 88);
  }

  // Wanted stars, top right.
  const stars = Math.ceil(state.wanted);
  ctx.fillStyle = 'rgba(10,10,20,0.65)';
  roundRect(ctx, VIEW_W - 240, 12, 226, 44, 10);
  ctx.fill();
  ctx.font = '28px Arial';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffe600' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 228 + i * 42, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff2e2e';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('WANTED', VIEW_W - 228, 68);
  }

  // Mission objective, top centre.
  if (mission && stage) {
    ctx.fillStyle = 'rgba(10,10,20,0.65)';
    const w = 560;
    roundRect(ctx, (VIEW_W - w) / 2, 12, w, 58, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mission.title, VIEW_W / 2, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(stage.text, VIEW_W / 2, 56);
    const target = activeTarget(missionState, game.city);
    if (target) {
      const d = Math.round(Math.hypot(target.x - player.x, target.y - player.y));
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(d + 'm', VIEW_W / 2, 74);
    }
  }

  // Off-screen target arrow.
  const target = activeTarget(missionState, game.city);
  if (target && game.screen === 'play') {
    const sx = target.x - (game.camera.x + game.camera.shakeX);
    const sy = target.y - (game.camera.y + game.camera.shakeY);
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(ang) * 300;
      const ay = cy + Math.sin(ang) * 200;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Banners and toasts run on game time (seconds since the run started).
  const now = game.state.timePlayed;
  if (missionState.banner && now < missionState.banner.until) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (missionState.banner.until - now) * 2);
    ctx.fillStyle = 'rgba(10,10,20,0.75)';
    roundRect(ctx, VIEW_W / 2 - 320, 200, 640, 86, 12);
    ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(missionState.banner.text, VIEW_W / 2, 238);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText(missionState.banner.sub, VIEW_W / 2, 266);
    ctx.restore();
  }
  if (missionState.toast && now < missionState.toast.until) {
    ctx.fillStyle = 'rgba(10,10,20,0.7)';
    roundRect(ctx, VIEW_W / 2 - 220, VIEW_H - 210, 440, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(missionState.toast.text, VIEW_W / 2, VIEW_H - 188);
  }

  // Controls hint, bottom right.
  ctx.fillStyle = 'rgba(10,10,20,0.55)';
  roundRect(ctx, VIEW_W - 330, VIEW_H - 46, 316, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.font = '13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.onFoot ? 'WASD move · E steal car · F punch · P pause · M mute' : 'W/S drive · A/D steer · E get out · P pause · M mute', VIEW_W - 172, VIEW_H - 25);

  drawMinimap(ctx, game);
}

// ---------- Minimap ----------

function drawMinimap(ctx, game) {
  const { city, traffic, police, player } = game;
  const MW = 220;
  const MH = 170;
  const mx = 14;
  const my = VIEW_H - MH - 14;
  const scaleX = MW / WORLD_W;
  const scaleY = MH / WORLD_H;

  ctx.fillStyle = 'rgba(10,10,20,0.75)';
  roundRect(ctx, mx - 6, my - 6, MW + 12, MH + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MW, MH);
  ctx.clip();
  ctx.fillStyle = '#5d7d4f';
  ctx.fillRect(mx, my, MW, MH);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(mx + BEACH_X * scaleX, my, MW - BEACH_X * scaleX, MH);
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(mx + BEACH_X * scaleX, my, (2440 - BEACH_X) * scaleX, MH);
  ctx.fillStyle = '#3a3f4a';
  for (const a of city.avenues) ctx.fillRect(mx + (a - 24) * scaleX, my, 48 * scaleX, MH);
  for (const s of city.streets) ctx.fillRect(mx, my + (s - 24) * scaleY, MW, 48 * scaleY);

  const target = activeTarget(game.missionState, city);
  if (target) {
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(mx + target.x * scaleX, my + target.y * scaleY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + target.x * scaleX, my + target.y * scaleY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const c of police.cruisers) {
    ctx.fillStyle = '#2e6bff';
    ctx.beginPath();
    ctx.arc(mx + c.x * scaleX, my + c.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath();
  ctx.arc(mx + player.x * scaleX, my + player.y * scaleY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + player.x * scaleX, my + player.y * scaleY, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', mx + 2, my - 12 > 12 ? my - 12 : my + MH + 18);
}

// ---------- Menus ----------

export function drawTitle(ctx, game, time, hasSave) {
  const pulse = 0.7 + Math.sin(time * 2) * 0.3;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#1b1035');
  grad.addColorStop(0.55, '#7b2d8b');
  grad.addColorStop(1, '#ff6b35');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Sun + skyline silhouette.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(VIEW_W - 190, 150, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(27,16,53,0.9)';
  const skyline = [60, 120, 90, 150, 70, 130, 100, 160, 80, 140, 95, 125, 75, 145, 85, 110];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, 470 - h, 80, h + 250);
    sx += 80;
  }
  // Neon windows.
  ctx.fillStyle = '#00e5ff';
  for (let i = 0; i < 40; i++) {
    const wx = (i * 97) % VIEW_W;
    const wy = 430 + ((i * 53) % 230);
    ctx.fillRect(wx, wy, 10, 14);
  }

  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 96px Arial';
  ctx.fillText('NEON BAY', VIEW_W / 2, 190);
  ctx.restore();
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('— A SUN-SOAKED OPEN-WORLD CRIME STORY —', VIEW_W / 2, 232);

  ctx.fillStyle = '#fff';
  ctx.font = '17px Arial';
  ctx.fillText('Five jobs. One city. Every cop in the bay on your tail.', VIEW_W / 2, 300);
  ctx.fillText('Steal cars, run missions, lose the heat — and become the Neon King.', VIEW_W / 2, 326);

  const options = hasSave
    ? ['ENTER — New Game', 'C — Continue saved game', 'WASD move · E steal car · F punch · P pause · M mute']
    : ['ENTER — Start the story', 'WASD move · E steal car · F punch · P pause · M mute'];
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(options[0], VIEW_W / 2, 420);
  ctx.globalAlpha = 1;
  if (hasSave) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(options[1], VIEW_W / 2, 456);
  }
  ctx.fillStyle = '#ddd';
  ctx.font = '15px Arial';
  ctx.fillText(options[options.length - 1], VIEW_W / 2, 500);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px Arial';
  ctx.fillText('An original game. No Rockstar names, art or music. All sound synthesized live.', VIEW_W / 2, VIEW_H - 24);
}

export function drawEnd(ctx, game) {
  const { state } = game;
  ctx.fillStyle = 'rgba(10,10,25,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 64px Arial';
  ctx.fillText('NEON KING', VIEW_W / 2, 180);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '22px Arial';
  ctx.fillText('All five jobs done. The bay is yours.', VIEW_W / 2, 228);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, VIEW_W / 2 - 300, 270, 600, 210, 14);
  ctx.fill();
  ctx.fillStyle = '#7cff00';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('JOBS COMPLETED  ' + state.jobsDone + ' / 5', VIEW_W / 2, 330);
  ctx.fillStyle = '#ffe600';
  ctx.fillText('MONEY EARNED  $' + state.moneyEarned.toLocaleString('en-US'), VIEW_W / 2, 380);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText('Wallet: $' + state.money.toLocaleString('en-US'), VIEW_W / 2, 420);
  const mins = Math.floor(state.timePlayed / 60);
  const secs = Math.floor(state.timePlayed % 60);
  ctx.fillText('Time in the city: ' + mins + ':' + String(secs).padStart(2, '0'), VIEW_W / 2, 452);

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('ENTER — Play again', VIEW_W / 2, 560);
  ctx.fillStyle = '#bbb';
  ctx.font = '15px Arial';
  ctx.fillText('Free roam continues after the story — the city never sleeps.', VIEW_W / 2, 596);
}

export function drawOverlay(ctx, title, sub, hint) {
  ctx.fillStyle = 'rgba(10,10,25,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e2e';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText(sub, VIEW_W / 2, 350);
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(hint, VIEW_W / 2, 410);
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(10,10,25,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px Arial';
  ctx.fillText('PAUSED', VIEW_W / 2, 320);
  ctx.fillStyle = '#ddd';
  ctx.font = '18px Arial';
  ctx.fillText('P — resume · M — mute · progress is saved after every job', VIEW_W / 2, 368);
}
