# Solmar Bay — an open-city crime story (make.fun gta6-01)

[![rank](https://make.fun/badge/gta6-01/adewahid/makefun-gta6-01-neon-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![rate](https://make.fun/badge/gta6-01/adewahid/makefun-gta6-01-neon-bay/rate.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/adewahid/makefun-gta6-01-neon-bay/reward.svg)](https://make.fun/bounty/gta6-01)

Referral: [make.fun/r/zsgcm8j7](https://make.fun/r/zsgcm8j7)

Solmar Bay is an original top-down open-world crime game built for the
[make.fun](https://make.fun/bounty/gta6-01) GTA 6 bounty. Explore a sun-soaked
coastal city on foot and by car, steal cars, outrun the SCPD at a rising
wanted level, and run seven story jobs for fixer Marisol Vega — from a first
stolen Vortex GT to the Coral Crown casino vault.

## What is in the game

- **A living city**: six districts (Marina, Old Town, Downtown, Casino Strip,
  The Docks, Palms East), a beach, parks, a container yard, 90 buildings,
  street lamps, palms and a full day/night cycle with headlights and lit
  windows after dark.
- **Traffic and pedestrians**: 14+ traffic cars following the road grid and
  40+ pedestrians who stroll the sidewalks — and flee from gunfire and fast
  cars.
- **Seven story missions**, each a different kind: a first steal, a timed
  delivery, a cash run under police heat, a getaway, a dockside shootout, a
  tailing job, and a casino-vault heist with a 4-star escape.
- **Wanted system (0–5 stars)**: crime raises the heat, police cruisers chase
  and ram, officers get out on foot to arrest you at 3+ stars, and a police
  helicopter keeps you lit up at 5 stars. Stay unseen and the heat cools off.
- **Combat**: punch and a pistol with ammo, enemy crew who shoot back,
  health and armor, car damage, smoke and explosions.
- **Vehicles**: six types with different speed and handling — Compact, Sedan,
  Sports, Taxi, Van and the SCPD Interceptor.
- **Side work**: taxi fares, 10 hidden packages, ammo crates.
- **HUD and minimap**: cash, health, armor, ammo, wanted stars, clock,
  mission objective, speedometer, and a live minimap with mission markers,
  police blips and landmarks.
- **Menus and save**: title screen, pause menu, busted/wasted flow, story
  complete screen, and autosave to localStorage (Continue on the title
  screen).
- **Sound**: everything is synthesised with WebAudio — engine hum, sirens,
  gunshots, pickups, mission jingles and a bassline that plays while you
  drive. M mutes.

## Play

Serve `game/` with any static HTTP server and open `index.html` in desktop
Chrome. Keyboard and mouse, no network needed: WASD drive & walk, E enter or
steal a car, F punch, mouse aim + click to shoot, Shift sprint / handbrake,
P pause, M mute.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier`.

## Screenshots

Four real renders of the game itself: a dusk police chase, the dockside
shootout, a night drive through Downtown, and the title screen over the city.
