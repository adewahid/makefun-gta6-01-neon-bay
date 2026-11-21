# Neon Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/adewahid/makefun-gta6-01-neon-bay/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/adewahid/makefun-gta6-01-neon-bay/reward.svg)](https://make.fun/c/gta6-01)

**Neon Bay** is a sun-soaked open-world crime game built for make.fun's
[gta6-01 "Make GTA 6"](https://make.fun/c/gta6-01) competition. It runs
entirely offline in a desktop browser from its own static files — no
network, no build step, all sound synthesized live with WebAudio.

Referral: `zsgcm8j7` — https://make.fun/r/zsgcm8j7

## The game

You are a new driver in Neon Bay, a coastal city of pastel towers, neon
signs and one very busy police department. Rosa, the fixer, has five jobs
for you — steal a car, run a pickup, shake a three-star chase, pull the
big score, and finish as the Neon King.

- **Open world** — a 2600×2600 coastal city: a road grid with traffic,
  pedestrians, parks, parking lots, a beach and the bay, all laid out
  deterministically from a single seed.
- **On foot and by car** — walk the sidewalks, punch trouble away, jack
  any car you can reach (press E) and drive it with arcade handling.
- **Wanted system** — crimes raise your stars; the Bay PD sends cruisers
  with flashing light bars to chase and ram you. Keep clean and the heat
  cools off. Get cornered on foot and you're busted; get wrecked and you
  wake up at St. Coral Hospital, poorer.
- **Five-mission story campaign** — each job has stages, a beacon marker,
  an off-screen direction arrow and a distance readout, with cash rewards
  that build your wallet.
- **HUD + minimap** — money, health, speed, wanted stars, the current
  objective and a live minimap with the player, police and mission blip.
- **Save system** — progress autosaves after every job; Continue on the
  title screen drops you back in.
- **Sound** — engine hum, police sirens, pickup blips and a synthwave
  bassline, all synthesized with WebAudio. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| E | Steal a car / get out |
| F | Punch |
| P | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored `vendor/makefun-game.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE). An original game: its city, characters,
names, story, art and music are all its own, with nothing from any
commercial game.
