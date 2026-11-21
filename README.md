# Neon Bay — an open-city crime story (make.fun gta6-01)

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/adewahid/makefun-gta6-01-neon-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/adewahid/makefun-gta6-01-neon-bay/reward.svg)](https://make.fun/bounty/gta6-01)

Referral: [make.fun/r/zsgcm8j7](https://make.fun/r/zsgcm8j7)

Neon Bay is an original top-down open-world crime game built for the
[make.fun](https://make.fun/bounty/gta6-01) GTA 6 bounty: explore a sun-soaked
city on foot and by car, steal cars, outrun the police at a rising wanted
level, and run five story jobs for Delia Voss.

## Play

Serve `game/` with any static HTTP server and open `index.html` in desktop
Chrome. Keyboard and mouse, no network
needed: WASD drive & walk, E enter/exit car, F punch, click shoot, P pause,
M mute.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier`.

## Screenshots

`screenshots/` holds four real renders of the game itself: the title screen,
a drive through Downtown, a two-star police chase at dusk, and the finale.
