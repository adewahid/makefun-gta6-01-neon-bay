// Solmar Bay — side activities that pay between jobs: taxi fares, hidden
// packages and ammo crates. They keep free roam worth playing.
import { dist, fmtCash, range, irange } from './config.js';
import { randomRoadPoint } from './city.js';

export function createActivities(S) {
  return {
    fare: null,        // { ped, dest, timer, pay }
    fareCooldown: 20,
    ammoCrates: [
      { x: 700, y: 700, taken: false, respawn: 0 },
      { x: 2600, y: 500, taken: false, respawn: 0 },
      { x: 1500, y: 2300, taken: false, respawn: 0 },
      { x: 2900, y: 2100, taken: false, respawn: 0 },
    ],
    update(dt) {
      const p = S.player;
      // --- taxi fares -------------------------------------------------------
      this.fareCooldown -= dt;
      if (!this.fare && this.fareCooldown <= 0 && p.inCar && Math.abs(p.inCar.speed) < 40) {
        // Find a waving ped near the road ahead.
        const cands = S.peds.filter((x) => !x.fare && x.state === 'walk' && dist(x.x, x.y, p.x, p.y) < 320);
        if (cands.length > 0 && Math.random() < dt * 0.5) {
          const ped = cands[Math.floor(Math.random() * cands.length)];
          ped.fare = true;
          const dest = randomRoadPoint(S.rng);
          this.fare = { ped, dest, timer: 90, pay: irange(S.rng, 80, 160), state: 'waiting' };
          S.hud.flash('Fare waiting — pull up next to the waving passenger');
        }
      }
      if (this.fare) {
        const f = this.fare;
        if (f.state === 'waiting') {
          if (p.inCar && Math.abs(p.inCar.speed) < 60 && dist(p.x, p.y, f.ped.x, f.ped.y) < 60) {
            f.state = 'riding';
            f.ped.boarding = true;
            S.peds.splice(S.peds.indexOf(f.ped), 1);
            S.audio.pickup();
            S.hud.flash(`Passenger aboard — take them to the marker (${Math.round(f.timer)}s)`);
          } else if (dist(p.x, p.y, f.ped.x, f.ped.y) > 700) {
            this.fare = null; this.fareCooldown = 15;
            S.hud.flash('Fare walked away');
          }
        } else {
          f.timer -= dt;
          if (dist(p.x, p.y, f.dest.x, f.dest.y) < 70) {
            S.player.cash += f.pay;
            S.audio.cash();
            S.hud.floatText(p.x, p.y - 30, `+$${f.pay} fare`);
            S.stats.fares++;
            this.fare = null; this.fareCooldown = 12;
          } else if (f.timer <= 0) {
            this.fare = null; this.fareCooldown = 15;
            S.hud.flash('Fare cancelled — too slow');
          }
        }
      }
      // --- hidden packages --------------------------------------------------
      for (const pkg of S.city.packages) {
        if (!pkg.taken && dist(p.x, p.y, pkg.x, pkg.y) < 34) {
          pkg.taken = true;
          S.player.cash += 100;
          S.audio.pickup();
          S.hud.floatText(pkg.x, pkg.y - 20, '+$100 package');
          const got = S.city.packages.filter((x) => x.taken).length;
          S.hud.flash(`Hidden package ${got}/10 — $100`);
        }
      }
      // --- ammo crates ------------------------------------------------------
      for (const c of this.ammoCrates) {
        if (c.taken) { c.respawn -= dt; if (c.respawn <= 0) c.taken = false; continue; }
        if (!p.inCar && dist(p.x, p.y, c.x, c.y) < 34) {
          c.taken = true; c.respawn = 60;
          S.player.ammo += 24;
          S.audio.pickup();
          S.hud.flash('Ammo +24');
        }
      }
    },
  };
}
