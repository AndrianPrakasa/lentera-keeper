// Lentera Keeper — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, margin: 26 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 18,
  speed: 305,
  fireInterval: 0.27,
  bulletSpeed: 760,
  maxHearts: 3,
  invulnerable: 1.3,
};

export const BULLET = { radius: 6, damage: 1, life: 1.1 };

export const ENEMY = {
  moth: { radius: 14, hp: 1, speed: 98, score: 10, color: '#b388ff' },
  wisp: { radius: 13, hp: 2, speed: 138, score: 20, color: '#5eead4' },
  beetle: { radius: 21, hp: 4, speed: 58, score: 30, color: '#f27d72' },
  boss: { radius: 56, hp: 95, speed: 50, score: 500, color: '#2b2350' },
};

/** Wave n spawns 5 + 3n shadows; waves 5 and 10 also bring the Raksasa Bayang. */
export const WAVE = {
  spawnInterval: 0.95,
  minSpawnInterval: 0.34,
  intervalScale: 0.94,
  bossWaves: [5, 10],
  finalWave: 10,
};

export const SHARD = { radius: 8, value: 5, magnetBase: 110 };

export const COMBO = { window: 3, maxMult: 5 };

/** Blessings offered between waves: pick one, it lasts the rest of the run. */
export const BLESSINGS = [
  { id: 'rapid', name: 'Rapid Wick', desc: 'Shoot 35% faster.' },
  { id: 'spread', name: 'Twin Lanterns', desc: 'Fire 3 orbs in a spread.' },
  { id: 'swift', name: 'Swift Feet', desc: 'Move 25% faster.' },
  { id: 'glass', name: 'Thick Glass', desc: '+1 max heart, and heal 1.' },
  { id: 'magnet', name: 'Star Magnet', desc: 'Shards fly to you from far away.' },
  { id: 'pierce', name: 'Piercing Light', desc: 'Orbs pass through shadows.' },
];

export const PALETTE = {
  backdrop: '#0a1220',
  skyTop: '#1b2c4d',
  skyBottom: '#0d1526',
  ground: '#182238',
  stallRed: '#c94f43',
  stallCream: '#f4e3c2',
  stallTeal: '#2f7d6d',
  gold: '#f2c94c',
  lantern: '#ffb347',
  teal: '#4fc3a7',
  coral: '#e5534b',
  violet: '#9b7ede',
  panel: '#141d31',
  panelEdge: '#2c3a57',
  text: '#f4efe4',
  muted: '#9aa7bd',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lentera-keeper.best';
