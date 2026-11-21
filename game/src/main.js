// Neon Bay — game entry point: state machine, loop, camera, wanted system,
// mission progression, combat, stealing, saving and screenshot staging.
import { WORLD, PLAYER, WANTED_DECAY_S, STORY } from './config.js';
import { makeRng, clamp, dist, angleTo, angleDiff } from './random.js';
import { generateCity, resolveCircle, isOnRoad } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createPlayer, createCar, driveCar, collideCarWorld, carsCollide,
  spawnTrafficCar, updateTraffic, spawnPed, updatePed,
  spawnCop, updateCop, wantedCopCount, spawnPickups,
} from './entities.js';
import { MISSIONS, createMissionState, currentMission, currentStep, missionReward } from './missions.js';
import {
  createRenderer, drawWorld, drawPickups, drawCar, drawPed, drawPlayer,
  drawParticles, drawSkids, drawMarker, drawHUD, drawMinimap,
  drawTitle, drawPause, drawEnd, applyNightTint,
} from './render.js';
import { stageScene } from './shots.js';

const SAVE_KEY = 'neonbay-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function main() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || 20261121);
  const shot = params.get('shot');
  const rng = makeRng(seed);

  const canvas = document.getElementById('game');
  const r = createRenderer(canvas);
  const input = createInput(canvas);
  const audio = createAudio();
  const city = generateCity(seed);

  const g = {
    state: 'title',           // title | playing | paused | wasted | busted | complete
    time: 0,
    timeOfDay: 17.0,          // golden-hour start
    city, rng, audio,
    player: createPlayer(city.landmarks.start.x, city.landmarks.start.y),
    cars: [],                 // parked + traffic + player car (all cars live here)
    cops: [],
    peds: [],
    rivals: [],
    pickups: spawnPickups(rng, city),
    particles: [],
    tracers: [],
    skids: [],
    missions: createMissionState(),
    wanted: 0,
    wantedT: 0,
    crimeCd: 0,
    activeTarget: null,
    hint: '', hintT: 0,
    cam: { x: 0, y: 0, w: 1280, h: 720 },
    viewW: 1280, viewH: 720,
    shakeT: 0, shakeMag: 0,
    menuSel: 0,
    hasSave: !!loadSave(),
    showHelp: false,
    sirenT: 0,
    endT: 0,
  };

  // Parked cars from the city plan become stealable cars.
  for (const pk of city.pickups) {
    if (pk.kind === 'parked') g.cars.push(createCar(pk.def, pk.x, pk.y, pk.angle));
  }
  for (let i = 0; i < 12; i++) {
    const c = spawnTrafficCar(rng, city, g.player);
    if (c) g.cars.push(c);
  }
  for (let i = 0; i < 14; i++) {
    const p = spawnPed(rng, city, g.player);
    if (p) g.peds.push(p);
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: g.player.money,
        done: g.missions.done,
        index: g.missions.index,
        health: g.player.health,
        ammo: g.player.ammo,
        x: g.player.x, y: g.player.y,
        timeOfDay: g.timeOfDay,
      }));
      g.hasSave = true;
    } catch { /* storage unavailable */ }
  }

  function applySave(s) {
    g.player.money = s.money || 0;
    g.missions.done = s.done || [];
    g.missions.index = s.index || 0;
    g.player.health = s.health || PLAYER.healthMax;
    g.player.ammo = s.ammo ?? 24;
    g.player.x = s.x ?? city.landmarks.start.x;
    g.player.y = s.y ?? city.landmarks.start.y;
    g.timeOfDay = s.timeOfDay ?? 17.0;
  }

  function setHint(text, secs) { g.hint = text; g.hintT = secs || 5; }

  function addParticles(x, y, n, color, speed, size, life) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      g.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rng.range(life * 0.5, life), max: life,
        color, size: rng.range(size * 0.6, size * 1.4),
      });
    }
  }

  function raiseWanted(n, why) {
    if (g.crimeCd > 0 && why !== 'scripted') return;
    g.wanted = clamp(g.wanted + n, 0, 5);
    g.wantedT = 0;
    if (why !== 'scripted') g.crimeCd = 4;
    if (g.wanted > 0) setHint('Wanted level up — lose the cops!', 4);
  }

  function setBanner(text, sub) {
    g.missions.banner = { text, sub: sub || '', t: 3.2 };
  }

  function refreshTarget() {
    const m = currentMission(g.missions);
    const s = currentStep(g.missions);
    if (!m || !s || s.type !== 'goto') { g.activeTarget = null; return; }
    const lm = city.landmarks[s.target];
    g.activeTarget = lm ? { x: lm.x, y: lm.y } : null;
  }

  function startMissionStep() {
    // Skip pure-text steps automatically.
    let s = currentStep(g.missions);
    while (s && s.type === 'text') { g.missions.step++; s = currentStep(g.missions); }
    if (!s) return;
    if (s.type === 'timed') {
      g.missions.timer = s.seconds;
      g.missions.timerTotal = s.seconds;
    }
    if (s.type === 'defeat') g.missions.defeatLeft = s.count;
    refreshTarget();
  }

  function advanceStep() {
    g.missions.step++;
    const m = currentMission(g.missions);
    if (m && g.missions.step >= m.steps.length) {
      completeMission();
      return;
    }
    startMissionStep();
  }

  function completeMission() {
    const m = currentMission(g.missions);
    if (!m) return;
    g.player.money += m.reward;
    g.missions.done.push(m.id);
    setBanner('JOB DONE', `${m.title}  •  +$${m.reward.toLocaleString('en-US')}`);
    audio.mission();
    g.missions.index++;
    g.missions.step = 0;
    g.missions.timer = 0;
    g.missions.holdT = 0;
    g.missions.packageTaken = false;
    g.missions.rivalsSpawned = false;
    saveGame();
    if (g.missions.index >= MISSIONS.length) {
      g.state = 'complete';
      g.endT = 0;
      return;
    }
    startMissionStep();
    setHint(currentMission(g.missions).title + ' — ' + currentStep(g.missions).text, 6);
  }

  function failMission(why) {
    const m = currentMission(g.missions);
    if (!m) return;
    setBanner('JOB FAILED', why);
    audio.fail();
    g.missions.step = 0;
    g.missions.timer = 0;
    g.missions.holdT = 0;
    g.missions.packageTaken = false;
    startMissionStep();
  }

  function spawnRivals() {
    if (g.missions.rivalsSpawned) return;
    g.missions.rivalsSpawned = true;
    const yard = city.landmarks.industrial;
    for (let i = 0; i < 6; i++) {
      g.rivals.push({
        x: yard.x + rng.range(-90, 90), y: yard.y + rng.range(-90, 90),
        angle: 0, health: 30, speed: 95, dead: false,
        punchCd: 0, shirt: '#8e2f35',
        walkPhase: rng.range(0, Math.PI * 2),
      });
    }
    g.missions.defeatLeft = 6;
    setHint('The Kings are here — deal with all 6!', 5);
  }

  function explodeCar(car) {
    addParticles(car.x, car.y, 40, '#ff9a3d', 260, 7, 1.1);
    addParticles(car.x, car.y, 25, '#555', 120, 9, 1.6);
    addParticles(car.x, car.y, 15, '#ffd23d', 320, 5, 0.7);
    audio.crash();
    g.shakeT = 0.5; g.shakeMag = 10;
    car.dead = true;
    if (g.player.inCar === car) {
      g.player.inCar = null;
      g.player.onFoot = true;
      g.player.x = car.x + 30; g.player.y = car.y;
      g.player.health -= 25;
      setHint('Your car blew up!', 4);
    }
    g.cars = g.cars.filter((c) => c !== car);
  }

  // --- player actions ------------------------------------------------------
  function nearestCar(maxD) {
    let best = null, bd = maxD;
    for (const c of g.cars) {
      if (c.dead) continue;
      const d = dist(g.player.x, g.player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    const stolen = !car.playerOwned;
    g.player.inCar = car;
    g.player.onFoot = false;
    car.playerOwned = true;
    if (stolen) {
      const witnessed = g.peds.some((p) => !p.dead && dist(p.x, p.y, car.x, car.y) < 350)
        || g.cops.some((c) => dist(c.x, c.y, car.x, car.y) < 650);
      if (witnessed || car.traffic) raiseWanted(1, 'steal');
      setHint('Nice wheels. Now drive like you own it.', 4);
      audio.horn();
    }
  }

  function exitCar() {
    const car = g.player.inCar;
    if (!car) return;
    car.speed *= 0.3;
    g.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    g.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    const res = resolveCircle(g.player.x, g.player.y, g.player.radius, city);
    g.player.x = res.x; g.player.y = res.y;
    g.player.inCar = null;
    g.player.onFoot = true;
  }

  function playerPunch() {
    const p = g.player;
    if (p.punchCd > 0) return;
    p.punchCd = 0.45;
    audio.punch();
    const reach = 46;
    const fx = p.x + Math.cos(p.angle) * reach;
    const fy = p.y + Math.sin(p.angle) * reach;
    addParticles(fx, fy, 6, '#fff', 120, 4, 0.3);
    const hitList = [...g.rivals, ...g.peds.filter((x) => !x.dead)];
    for (const e of hitList) {
      if (dist(p.x, p.y, e.x, e.y) < reach + 12) {
        e.health = (e.health ?? 30) - 25;
        e.x += Math.cos(p.angle) * 14; e.y += Math.sin(p.angle) * 14;
        addParticles(e.x, e.y, 8, '#ff5a5a', 160, 4, 0.4);
        if (e.health <= 0) killPedOrRival(e);
      }
    }
  }

  function killPedOrRival(e) {
    if (e.dead) return;
    e.dead = true;
    addParticles(e.x, e.y, 16, '#c0392b', 140, 5, 0.8);
    if (g.rivals.includes(e)) {
      g.missions.defeatLeft = Math.max(0, g.missions.defeatLeft - 1);
      if (g.missions.defeatLeft === 0 && currentStep(g.missions)?.type === 'defeat') advanceStep();
    } else {
      raiseWanted(1, 'kill');
      setHint('That was a civilian. The Bay saw that.', 4);
    }
  }

  function playerShoot() {
    const p = g.player;
    if (p.shootCd > 0 || p.ammo <= 0 || !p.hasGun) return;
    p.shootCd = 0.22;
    p.ammo--;
    audio.shoot();
    const mx = input.mouse.x + g.cam.x;
    const my = input.mouse.y + g.cam.y;
    const a = angleTo(p.x, p.y, mx, my);
    p.angle = a;
    const range = 520;
    const tx = p.x + Math.cos(a) * range;
    const ty = p.y + Math.sin(a) * range;
    g.tracers.push({ x: p.x, y: p.y, x2: tx, y2: ty, life: 0.09, max: 0.09 });
    addParticles(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 4, '#ffd23d', 200, 3, 0.25);
    // Hit the nearest enemy roughly along the shot line.
    let best = null, bd = 1e9;
    const targets = [...g.rivals.filter((r) => !r.dead), ...g.peds.filter((x) => !x.dead)];
    for (const e of targets) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > range) continue;
      const ea = angleTo(p.x, p.y, e.x, e.y);
      if (Math.abs(angleDiff(a, ea)) < 0.09 + 26 / Math.max(d, 1)) {
        if (d < bd) { bd = d; best = e; }
      }
    }
    if (best) {
      best.health = (best.health ?? 30) - 34;
      addParticles(best.x, best.y, 10, '#ff5a5a', 180, 4, 0.4);
      if (best.health <= 0) killPedOrRival(best);
    }
    // Firing near cops draws heat.
    if (g.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 520)) raiseWanted(1, 'shoot');
  }

  // --- per-frame updates -----------------------------------------------------
  function updatePlaying(dt) {
    const p = g.player;
    g.time += dt;
    g.timeOfDay = (g.timeOfDay + dt / 120) % 24;
    if (g.hintT > 0) g.hintT -= dt;
    if (g.crimeCd > 0) g.crimeCd -= dt;
    if (g.missions.banner) g.missions.banner.t -= dt;
    if (g.shakeT > 0) g.shakeT -= dt;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);

    // Mission timer.
    const m = currentMission(g.missions);
    if (m && g.missions.timer > 0) {
      g.missions.timer -= dt;
      if (g.missions.timer <= 0) failMission('Out of time — Delia is not impressed.');
    }

    // --- input: on foot vs driving -------------------------------------------
    if (p.inCar) {
      const car = p.inCar;
      const throttle = input.down('KeyW', 'ArrowUp') ? 1 : input.down('KeyS', 'ArrowDown') ? -1 : 0;
      const steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
      const hb = input.down('Space');
      const spd = driveCar(car, throttle, steer, dt, hb);
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      const impact = collideCarWorld(car, city, dt);
      if (impact > 0) {
        audio.crash();
        g.shakeT = 0.3; g.shakeMag = 7;
        addParticles(car.x, car.y, 10, '#999', 140, 5, 0.6);
        p.health -= impact * 0.012;
      }
      if (hb && Math.abs(car.speed) > 120) {
        const bx = car.x - Math.cos(car.angle) * 20, by = car.y - Math.sin(car.angle) * 20;
        g.skids.push({ x: bx, y: by, x2: bx - car.vx * dt * 2, y2: by - car.vy * dt * 2, life: 6 });
      }
      if (car.health <= 0) explodeCar(car);
      if (input.hit('KeyE')) exitCar();
      if (input.hit('KeyH')) audio.horn();
      audio.setEngine(clamp(Math.abs(car.speed) / 500, 0, 1), true);
    } else {
      const run = input.down('ShiftLeft', 'ShiftRight');
      const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      let my = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
      const len = Math.hypot(mx, my);
      p.moving = len > 0;
      if (len > 0) { mx /= len; my /= len; }
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
      const res = resolveCircle(p.x, p.y, p.radius, city);
      p.x = res.x; p.y = res.y;
      p.speed = len * sp;
      // Aim at the mouse.
      p.angle = angleTo(p.x, p.y, input.mouse.x + g.cam.x, input.mouse.y + g.cam.y);
      if (input.hit('KeyE')) {
        const car = nearestCar(64);
        if (car) enterCar(car);
      }
      if (input.hit('KeyF')) playerPunch();
      if (input.mouse.clicked) playerShoot();
      audio.setEngine(0, false);
    }

    // --- traffic & pedestrians ----------------------------------------------
    for (const c of g.cars) {
      if (c.traffic && c !== p.inCar) updateTraffic(c, dt, rng, city);
    }
    // Pairwise car separation (cheap: only nearby pairs matter, n is small).
    const allCars = [...g.cars, ...g.cops];
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        if (carsCollide(allCars[i], allCars[j])) {
          if (allCars[i] === p.inCar || allCars[j] === p.inCar) {
            const pc = p.inCar;
            pc.health -= 2;
            if (Math.abs(pc.speed) > 200) { audio.crash(); g.shakeT = 0.25; g.shakeMag = 6; }
          }
        }
      }
    }
    if (g.cars.length < 14 && rng.chance(dt * 0.5)) {
      const c = spawnTrafficCar(rng, city, p);
      if (c) g.cars.push(c);
    }
    g.cars = g.cars.filter((c) => dist(c.x, c.y, p.x, p.y) < 1600 || c === p.inCar);

    for (const ped of g.peds) {
      const gunfire = input.mouse.clicked;
      updatePed(ped, dt, rng, city, gunfire ? { x: p.x, y: p.y } : null);
    }
    if (g.peds.length < 14 && rng.chance(dt * 0.6)) {
      const pd = spawnPed(rng, city, p);
      if (pd) g.peds.push(pd);
    }
    g.peds = g.peds.filter((x) => !x.dead && dist(x.x, x.y, p.x, p.y) < 1500);

    // --- rivals ----------------------------------------------------------------
    for (const rv of g.rivals) {
      if (rv.dead) continue;
      const d = dist(rv.x, rv.y, p.x, p.y);
      const want = angleTo(rv.x, rv.y, p.x, p.y);
      rv.angle += clamp(angleDiff(rv.angle, want), -4 * dt, 4 * dt);
      if (d > 34) {
        rv.x += Math.cos(rv.angle) * rv.speed * dt;
        rv.y += Math.sin(rv.angle) * rv.speed * dt;
        const res = resolveCircle(rv.x, rv.y, 11, city);
        rv.x = res.x; rv.y = res.y;
      } else if (rv.punchCd <= 0) {
        rv.punchCd = 1.1;
        p.health -= 8;
        addParticles(p.x, p.y, 6, '#ff5a5a', 120, 4, 0.3);
        g.shakeT = 0.2; g.shakeMag = 4;
      }
      rv.punchCd -= dt;
      rv.walkPhase += dt * 8;
    }

    // --- wanted / police -------------------------------------------------------
    const nearestCop = g.cops.length ? Math.min(...g.cops.map((c) => dist(c.x, c.y, p.x, p.y))) : 1e9;
    if (g.wanted > 0) {
      g.wantedT += dt;
      if (g.wantedT > WANTED_DECAY_S && nearestCop > 450) {
        g.wanted--;
        g.wantedT = 0;
        setHint(g.wanted === 0 ? 'Clean. For now.' : 'Heat dying down…', 3);
      }
      const want = wantedCopCount(g.wanted);
      while (g.cops.length < want) {
        const cop = spawnCop(rng, city, p);
        g.cops.push(cop);
      }
      g.sirenT -= dt;
      if (g.sirenT <= 0) { audio.siren(); g.sirenT = 2.4; }
    } else {
      g.cops = g.cops.filter((c) => dist(c.x, c.y, p.x, p.y) < 900);
    }
    for (const cop of g.cops) {
      const d = updateCop(cop, p, dt, city);
      // Busted: on foot and a cop sits on you.
      if (!p.inCar && d < 30) {
        p.bustedT += dt;
        if (p.bustedT > 1.2) { enterEnd('busted'); return; }
      } else {
        p.bustedT = Math.max(0, p.bustedT - dt * 2);
      }
    }
    if (p.inCar && p.inCar.health < 30 && rng.chance(dt * 0.3)) {
      addParticles(p.inCar.x, p.inCar.y - 10, 2, '#888', 60, 6, 0.8);
    }

    // --- pickups -----------------------------------------------------------------
    for (const pk of g.pickups) {
      if (pk.taken) continue;
      const d = dist(pk.x, pk.y, p.x, p.y);
      if (d < (p.inCar ? 44 : 30)) {
        pk.taken = true;
        if (pk.kind === 'cash') {
          p.money += pk.value;
          setHint(`+$${pk.value} found cash`, 3);
        } else if (pk.kind === 'health') {
          p.health = clamp(p.health + 35, 0, PLAYER.healthMax);
          setHint('Health +35', 3);
        } else if (pk.kind === 'repair') {
          if (p.inCar) { p.inCar.health = 100; setHint('Car repaired', 3); }
          else { p.money += 25; setHint('Sold scrap parts +$25', 3); }
        } else if (pk.kind === 'ammo') {
          p.ammo += 24;
          setHint('Ammo +24', 3);
        }
        audio.pickup();
        addParticles(pk.x, pk.y, 10, '#ffd23d', 140, 4, 0.5);
      }
    }

    // --- mission steps -------------------------------------------------------------
    const step = currentStep(g.missions);
    if (step) {
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      if (step.type === 'enterCar' && p.inCar) advanceStep();
      else if (step.type === 'goto') {
        const lm = city.landmarks[step.target];
        if (lm && dist(px, py, lm.x, lm.y) < step.radius) {
          if (step.onArrive === 'takePackage') {
            g.missions.packageTaken = true;
            raiseWanted(1, 'scripted');
            setHint('Package taken — the Kings made a call. Move!', 5);
          } else if (step.onArrive === 'spawnRivals') {
            spawnRivals();
          } else if (step.onArrive === 'grabCash') {
            raiseWanted(2, 'scripted');
            setHint('Vault cash grabbed — every cop in the Bay is coming!', 5);
          }
          advanceStep();
        }
      } else if (step.type === 'hold') {
        const lm = city.landmarks.bank;
        const spd = p.inCar ? Math.abs(p.inCar.speed) : p.speed;
        if (dist(px, py, lm.x, lm.y) < 90 && spd < 25) {
          g.missions.holdT += dt;
          setHint(`Cracking the vault… ${Math.ceil(3 - g.missions.holdT)}s`, 1);
          if (g.missions.holdT >= step.seconds) advanceStep();
        } else {
          g.missions.holdT = Math.max(0, g.missions.holdT - dt);
        }
      } else if (step.type === 'escape') {
        if (g.wanted === 0) advanceStep();
      }
    }

    // --- health / end states -------------------------------------------------------
    if (p.health <= 0) { enterEnd('wasted'); return; }

    // Particles / tracers / skids decay.
    for (const pt of g.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    g.particles = g.particles.filter((pt) => pt.life > 0);
    for (const t of g.tracers) t.life -= dt;
    g.tracers = g.tracers.filter((t) => t.life > 0);
    for (const s of g.skids) s.life -= dt;
    g.skids = g.skids.filter((s) => s.life > 0);

    // Camera follows the player (or the car).
    const tx = p.x - g.viewW / 2, ty = p.y - g.viewH / 2;
    g.cam.x += (tx - g.cam.x) * Math.min(1, dt * 5);
    g.cam.y += (ty - g.cam.y) * Math.min(1, dt * 5);
    g.cam.x = clamp(g.cam.x, 0, Math.max(0, WORLD - g.viewW));
    g.cam.y = clamp(g.cam.y, 0, Math.max(0, WORLD - g.viewH));
    g.cam.w = g.viewW; g.cam.h = g.viewH;

    if (input.hit('KeyP', 'Escape')) { g.state = 'paused'; audio.setEngine(0, false); }
    if (input.hit('KeyM')) {
      const muted = audio.toggleMute();
      setHint(muted ? 'Sound off' : 'Sound on', 2);
    }
  }

  function enterEnd(kind) {
    g.state = kind;
    g.endT = 0;
    audio.fail();
    if (kind === 'busted') {
      g.wanted = 0;
      g.cops = [];
      g.player.money = Math.max(0, g.player.money - 200);
    }
    saveGame();
  }

  function respawn() {
    const p = g.player;
    p.health = PLAYER.healthMax;
    p.wanted = 0;
    g.wanted = 0;
    g.cops = [];
    p.bustedT = 0;
    p.x = city.landmarks.delia.x;
    p.y = city.landmarks.delia.y;
    if (p.inCar) { p.inCar = null; p.onFoot = true; }
    g.state = 'playing';
    setHint("Delia patched you up. Don't make it a habit.", 5);
  }

  function newGame() {
    g.player = createPlayer(city.landmarks.start.x, city.landmarks.start.y);
    g.missions = createMissionState();
    g.wanted = 0; g.cops = []; g.rivals = [];
    g.timeOfDay = 17.0;
    g.state = 'playing';
    startMissionStep();
    setHint(STORY.intro, 8);
    refreshTarget();
  }

  function continueGame() {
    const s = loadSave();
    if (s) applySave(s);
    g.state = 'playing';
    startMissionStep();
    setHint('Back on the streets.', 4);
  }

  // --- rendering -------------------------------------------------------------------
  function render() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    g.viewW = w; g.viewH = h;
    r.canvasW = w; r.canvasH = h;
    const { ctx } = r;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (g.state === 'title') {
      drawTitle(r, g, w, h);
      return;
    }

    // World view with camera shake.
    const shx = g.shakeT > 0 ? (Math.random() - 0.5) * g.shakeMag : 0;
    const shy = g.shakeT > 0 ? (Math.random() - 0.5) * g.shakeMag : 0;
    const cam = { x: g.cam.x + shx, y: g.cam.y + shy, w, h };
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawWorld(r, g, cam);
    drawSkids(r, g.skids, cam);
    drawPickups(r, g, cam);
    drawMarker(r, g, cam);
    for (const c of g.cars) drawCar(r, c, cam, c === g.player.inCar);
    for (const c of g.cops) drawCar(r, c, cam, false);
    for (const ped of g.peds) drawPed(r, ped, cam);
    for (const rv of g.rivals) if (!rv.dead) drawPed(r, { ...rv, shirt: '#8e2f35' }, cam);
    if (g.player.onFoot) drawPlayer(r, g.player, cam);
    drawParticles(r, g.particles, cam);
    // Tracers.
    ctx.strokeStyle = 'rgba(255,220,80,0.9)';
    ctx.lineWidth = 2;
    for (const t of g.tracers) {
      ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    applyNightTint(r, g, w, h);
    if (g.state === 'playing' || g.state === 'paused') {
      drawHUD(r, g, w, h);
      drawMinimap(r, g);
    }
    if (g.state === 'paused') drawPause(r, g, w, h);
    if (g.state === 'wasted' || g.state === 'busted' || g.state === 'complete') {
      drawEnd(r, g, w, h, g.state);
    }
  }

  // --- menus -------------------------------------------------------------------------
  function updateTitle(dt) {
    g.time += dt;
    if (g.showHelp) {
      if (input.anyKey.value) { g.showHelp = false; audio.click(); }
      return;
    }
    const items = g.hasSave ? ['CONTINUE', 'NEW GAME', 'HOW TO PLAY'] : ['NEW GAME', 'HOW TO PLAY'];
    if (input.hit('ArrowUp', 'KeyW')) { g.menuSel = (g.menuSel + items.length - 1) % items.length; audio.click(); }
    if (input.hit('ArrowDown', 'KeyS')) { g.menuSel = (g.menuSel + 1) % items.length; audio.click(); }
    if (input.hit('Enter', 'NumpadEnter')) {
      audio.unlock();
      audio.click();
      const choice = items[g.menuSel];
      if (choice === 'CONTINUE') continueGame();
      else if (choice === 'NEW GAME') newGame();
      else g.showHelp = true;
    }
    if (input.mouse.clicked) audio.unlock();
  }

  function updatePaused() {
    if (input.hit('KeyP', 'Escape')) g.state = 'playing';
    if (input.hit('KeyS')) { saveGame(); setHint('Game saved', 3); g.state = 'playing'; }
    if (input.hit('KeyQ')) { g.state = 'title'; g.menuSel = 0; }
    if (input.hit('KeyM')) audio.toggleMute();
  }

  function updateEnd() {
    g.endT += 1 / 60;
    if (input.hit('Enter', 'NumpadEnter')) {
      if (g.state === 'complete') { g.state = 'playing'; startMissionStep(); }
      else respawn();
    }
  }

  // --- main loop -----------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    if (g.state === 'title') updateTitle(dt);
    else if (g.state === 'playing') updatePlaying(dt);
    else if (g.state === 'paused') updatePaused();
    else updateEnd();
    render();
    input.endFrame();
    requestAnimationFrame(frame);
  }

  // --- boot ------------------------------------------------------------------------------
  function resize() {
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
  window.addEventListener('keydown', () => audio.unlock(), { once: false });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: false });

  if (shot) {
    // Screenshot staging: fixed 1280x720 stage, a few settled frames, one render.
    canvas.style.width = '1280px';
    canvas.style.height = '720px';
    g.viewW = 1280; g.viewH = 720;
    stageScene(g, shot);
    if (g.state === 'playing') {
      for (let i = 0; i < 24; i++) updatePlaying(1 / 30);
    }
    document.title = 'Neon Bay — shot:' + shot;
    render();
    return;
  }

  startMissionStep();
  refreshTarget();
  requestAnimationFrame(frame);
}

main();
