// Static tuning and content for Neon Bay. Nothing here is copied from
// any commercial game: the city, districts, people and story are original.
export const WORLD = 2400;            // world is WORLD x WORLD px
export const ROAD_W = 92;             // road width
export const ROAD_STEP = 300;         // distance between road centrelines
export const ROADS = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];

export const COLORS = {
  grass: '#2e6b34',
  grassAlt: '#2a6130',
  park: '#3d8a44',
  sand: '#d9c27a',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  road: '#33363d',
  roadEdge: '#23262c',
  lane: '#c9c46a',
  sidewalk: '#7d7f85',
  buildingRoof: ['#5a5f6e', '#6e5a4a', '#4a5a6e', '#715a6e', '#5e6e5a', '#7a6a52'],
  buildingEdge: '#2b2e36',
  downtown: ['#3d4a6b', '#5b4a6b', '#4a6b5f', '#6b5a3d'],
};

export const DISTRICTS = [
  { name: 'Downtown', x: 900, y: 300, w: 900, h: 600 },
  { name: 'Old Town', x: 150, y: 900, w: 600, h: 600 },
  { name: 'Marina', x: 1650, y: 1500, w: 600, h: 600 },
  { name: 'Industrial', x: 150, y: 150, w: 600, h: 600 },
  { name: 'Bayside', x: 150, y: 1650, w: 2100, h: 450 },
];

export const CAR_DEFS = [
  { name: 'Pinto', color: '#c94f3d', top: 95, accel: 150, max: 300, turn: 2.6, price: 400 },
  { name: 'Comet', color: '#3d7ac9', top: 130, accel: 210, max: 380, turn: 3.0, price: 900 },
  { name: 'Vulture', color: '#c9a13d', top: 150, accel: 260, max: 430, turn: 3.2, price: 1600 },
  { name: 'Rhino Van', color: '#7a7f8a', top: 110, accel: 170, max: 330, turn: 2.4, price: 700 },
  { name: 'Interceptor', color: '#22262e', top: 170, accel: 320, max: 500, turn: 3.4, price: 0 }, // police
];

export const PED_COLORS = ['#d94f6a', '#4fd98a', '#e8e4d8', '#6a8ad9', '#d9a44f', '#9a6ad9', '#4fd2d9'];
export const PED_SHIRTS = ['#e84a5f', '#2ecc71', '#f1c40f', '#3498db', '#e67e22', '#9b59b6', '#1abc9c', '#ecf0f1'];

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 13,
  healthMax: 100,
};

export const WANTED_DECAY_S = 22;   // seconds with no crime and no cop near before stars drop
export const COP_COUNT = [0, 1, 2, 3, 4, 6]; // cops by wanted level

export const STORY = {
  hero: 'Jax Marlowe',
  fixer: 'Delia Voss',
  rival: 'The Kings',
  intro: 'Neon Bay, 2:14 AM. Jax Marlowe is out of cash, out of luck, and one bad decision away from out of town. Delia Voss has work — if he can drive.',
};
