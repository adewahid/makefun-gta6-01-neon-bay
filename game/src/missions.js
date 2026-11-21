// The story: five missions from Delia Voss that take Jax from a nobody
// with no wheels to the crew's getaway driver. Each mission is a list of
// steps; the game advances a step when its condition is met.
import { fmtMoney } from './random.js';

export const MISSIONS = [
  {
    id: 'hotwheels',
    title: '1 — Hot Wheels',
    reward: 500,
    briefing: "Delia: 'First rule of Neon Bay — nobody gives you a car. Take one. Bring it to the Chop Shop on 1st and Main. Don't scratch it. Much.'",
    steps: [
      { type: 'text', text: 'Steal any car (walk up and press E)' },
      { type: 'enterCar', text: 'Get in a car' },
      { type: 'goto', target: 'chopShop', radius: 90, text: 'Drive to the Chop Shop' },
    ],
  },
  {
    id: 'package',
    title: '2 — The Package',
    reward: 800,
    briefing: "Delia: 'A package is waiting at the Docks. Pick it up, bring it to me. The Kings are watching the Docks — if the cops notice you, lose them.'",
    steps: [
      { type: 'goto', target: 'docks', radius: 80, text: 'Pick up the package at the Docks', onArrive: 'takePackage' },
      { type: 'goto', target: 'delia', radius: 80, text: "Deliver the package to Delia's" },
    ],
  },
  {
    id: 'getaway',
    title: '3 — Getaway',
    reward: 1200,
    briefing: "Delia: 'The crew hit a pawn shop and the whole bay is awake. Three checkpoints, two and a half minutes. Drive like your rent depends on it — it does.'",
    steps: [
      { type: 'timed', seconds: 150, text: 'Hit all 3 checkpoints in time' },
      { type: 'goto', target: 'industrial', radius: 100, text: 'Checkpoint 1 — Industrial Yard', checkpoint: 1 },
      { type: 'goto', target: 'bank', radius: 100, text: 'Checkpoint 2 — Marina Bank', checkpoint: 2 },
      { type: 'goto', target: 'hideout', radius: 100, text: 'Checkpoint 3 — Hideout', checkpoint: 3 },
    ],
  },
  {
    id: 'turf',
    title: '4 — Turf War',
    reward: 1500,
    briefing: "Delia: 'The Kings jumped our yard crew. Take the Industrial Yard back. They brought bats and bad attitudes — bring something louder.'",
    steps: [
      { type: 'goto', target: 'industrial', radius: 130, text: 'Reach the Industrial Yard', onArrive: 'spawnRivals' },
      { type: 'defeat', count: 6, text: 'Deal with the Kings (0/6)' },
    ],
  },
  {
    id: 'bigscore',
    title: '5 — The Big Score',
    reward: 3000,
    briefing: "Delia: 'Tonight we retire the Marina Bank. Grab the cash, get out before the sirens close in, and meet me at the Hideout. No heroes, Jax — just gone.'",
    steps: [
      { type: 'goto', target: 'bank', radius: 90, text: 'Reach the Marina Bank', onArrive: 'grabCash' },
      { type: 'hold', seconds: 3, text: 'Crack the vault (hold still)' },
      { type: 'escape', text: 'Lose the cops, then reach the Hideout' },
      { type: 'goto', target: 'hideout', radius: 90, text: 'Reach the Hideout with the cash' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,            // which mission is active
    step: 0,             // which step inside it
    done: [],            // completed mission ids
    timer: 0,            // mission countdown (timed missions)
    timerTotal: 0,
    holdT: 0,            // vault hold progress
    defeatLeft: 0,
    packageTaken: false,
    rivalsSpawned: false,
    banner: null,        // { text, sub, t }
    failed: false,
  };
}

export function currentMission(state) {
  return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

export function missionProgressText(state) {
  const m = currentMission(state);
  if (!m) return 'All missions complete — Neon Bay is yours.';
  const s = currentStep(state);
  if (!s) return m.title;
  if (s.type === 'defeat') return `Deal with the Kings (${(6 - state.defeatLeft)}/6)`;
  return s.text;
}

export function missionReward(state) {
  const m = currentMission(state);
  return m ? m.reward : 0;
}

export function fmtBriefing(m) {
  return `${m.title}  •  Reward ${fmtMoney(m.reward)}\n${m.briefing}`;
}
