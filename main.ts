// Solmar Bay — gta6-01 entry program (Node 22, standard library only).
// Hands the game in: copies this repository's game/ and screenshots/ into
// the output directory and writes /output/dossier.json with the kit's
// buildDossier, so the scorer can check the entry exactly as the kit does.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (kit reference/gate.json): game/ at most 993 files
// and 48 MiB, screenshots at most 4 files of 256 KiB, dossier text at most
// 160 KiB. Enforce the same bounds here so a bad local run fails loudly
// instead of handing the grader an entry it would refuse.
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const SHOT_MAX = 4;
const SHOT_MAX_BYTES = 256 * 1024;

function countTree(dir) {
  let files = 0; let bytes = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { files++; bytes += statSync(p).size; }
    }
  };
  walk(dir);
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const gameStats = countTree(join(out, 'game'));
if (gameStats.files > GAME_MAX_FILES) throw new Error(`game/ has ${gameStats.files} files (cap ${GAME_MAX_FILES})`);
if (gameStats.bytes > GAME_MAX_BYTES) throw new Error(`game/ is ${gameStats.bytes} bytes (cap ${GAME_MAX_BYTES})`);

const shotDir = join(out, 'screenshots');
const shots = existsSync(shotDir)
  ? readdirSync(shotDir).filter((f) => !f.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > SHOT_MAX) throw new Error(`need 3 or 4 screenshots, found ${shots.length}`);
for (const f of shots) {
  const size = statSync(join(shotDir, f)).size;
  if (size > SHOT_MAX_BYTES) throw new Error(`screenshot ${f} is ${size} bytes (cap ${SHOT_MAX_BYTES})`);
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Bay handed in: ${gameStats.files} game files, ${shots.length} screenshots, dossier written to ${out}`);
