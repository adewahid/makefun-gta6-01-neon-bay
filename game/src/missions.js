// missions.js — the five-job story campaign of Neon Bay.
// Each mission is a list of stages; a stage is reached by arriving at its
// marker (on foot or in a car) or by holding a condition for a while.
// The mission system only reads the world and reports what happened; the
// main loop applies rewards, wanted changes and the end screen.

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'JOB 1 — FIRST WHEELS',
    giver: 'Rosa, the fixer, needs a driver.',
    briefing: 'Steal a car — any car — and bring it to Palm Plaza. The crew is waiting.',
    reward: 250,
    stages: [
      { id: 'steal', text: 'Steal a car (walk up to one and press E)', type: 'inCar' },
      { id: 'plaza', text: 'Drive to Palm Plaza', type: 'goto', target: 'plaza' },
    ],
  },
  {
    id: 'the-pickup',
    title: 'JOB 2 — THE PICKUP',
    giver: 'A package is waiting at Coral Mall.',
    briefing: 'Grab the package at Coral Mall, then run it to Sunset Docks. Keep it clean — or don\'t.',
    reward: 400,
    stages: [
      { id: 'mall', text: 'Pick up the package at Coral Mall', type: 'goto', target: 'mall' },
      { id: 'docks', text: 'Deliver the package to Sunset Docks', type: 'goto', target: 'docks' },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'JOB 3 — HOT PURSUIT',
    giver: 'The Bay PD is on your tail.',
    briefing: 'Three stars and counting. Shake the cops and reach the Safehouse. Do not get busted.',
    reward: 600,
    wantedOnStart: 3,
    stages: [
      { id: 'safehouse', text: 'Lose the heat — reach the Safehouse', type: 'goto', target: 'safehouse', requireWantedBelow: 3 },
    ],
  },
  {
    id: 'the-big-score',
    title: 'JOB 4 — THE BIG SCORE',
    giver: 'Three cash drops. One night. No mistakes.',
    briefing: 'Collect the three cash bags stashed around the city, then bring them to Bayview Hotel.',
    reward: 900,
    stages: [
      { id: 'bag1', text: 'Grab cash bag 1/3 — Neon Pier', type: 'goto', target: 'pier' },
      { id: 'bag2', text: 'Grab cash bag 2/3 — Palm Plaza', type: 'goto', target: 'plaza' },
      { id: 'bag3', text: 'Grab cash bag 3/3 — Sunset Docks', type: 'goto', target: 'docks' },
      { id: 'hotel', text: 'Deliver the cash to Bayview Hotel', type: 'goto', target: 'hotel' },
    ],
  },
  {
    id: 'neon-king',
    title: 'JOB 5 — NEON KING',
    giver: 'One last run. The yacht is waiting.',
    briefing: 'The whole city is watching. Reach the Yacht Marina, then lose the heat and get home to the Safehouse.',
    reward: 1500,
    wantedOnStart: 2,
    stages: [
      { id: 'yacht', text: 'Reach the Yacht Marina', type: 'goto', target: 'yacht' },
      { id: 'home', text: 'Lose the heat — get to the Safehouse', type: 'goto', target: 'safehouse', requireWantedBelow: 2 },
    ],
  },
];

// Fresh runtime state for a campaign run.
export function createMissionState() {
  return {
    missionIndex: 0,
    stageIndex: 0,
    stageTimer: 0,
    banner: null,      // { text, sub, until } shown centre-screen
    bannerUntil: 0,
    toast: null,       // small one-line notice
    toastUntil: 0,
  };
}

export function currentMission(state) {
  return MISSIONS[state.missionIndex] ?? null;
}

export function currentStage(state) {
  const mission = currentMission(state);
  return mission ? mission.stages[state.stageIndex] ?? null : null;
}

// Where the player must go right now (a landmark key), or null.
export function activeTarget(state, city) {
  const stage = currentStage(state);
  if (!stage || stage.type !== 'goto') return null;
  const spot = city.landmarks[stage.target];
  return spot ? { x: spot.x, y: spot.y, name: spot.name } : null;
}

export function missionDone(state) {
  return state.missionIndex >= MISSIONS.length;
}

// Advance one stage; returns 'mission' when the mission finished, 'stage'
// when only the stage did, or null when nothing advanced. The caller
// decides rewards and banners from the return value.
export function advanceStage(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  state.stageIndex++;
  if (state.stageIndex >= mission.stages.length) {
    state.missionIndex++;
    state.stageIndex = 0;
    return 'mission';
  }
  return 'stage';
}

export function showBanner(state, text, sub, now, seconds = 3) {
  state.banner = { text, sub: sub || '', until: now + seconds };
}

export function showToast(state, text, now, seconds = 2.5) {
  state.toast = { text, until: now + seconds };
}
