// World / difficulty curve definitions. Shared by the level builder and the
// runtime (endless levels beyond the hand-built campaign).

export const LEVELS_PER_WORLD = 20;

export const WORLDS = [
  {
    id: 'sunny', name: 'Sunny Town', icon: '☀️',
    obstacle: 'bush', pets: [],
    grid: [[3, 4], [5, 6]], fill: [0.45, 0.8], truck: [0, 0], obstacles: [0, 0], petCount: [0, 0], hard: [0, 0.35],
  },
  {
    id: 'trucks', name: 'Truck Stop', icon: '🚚',
    obstacle: 'cone', pets: [],
    grid: [[5, 5], [6, 7]], fill: [0.6, 0.82], truck: [0.3, 0.4], obstacles: [0, 1], petCount: [0, 0], hard: [0.25, 0.55],
  },
  {
    id: 'forest', name: 'Forest Park', icon: '🌲',
    obstacle: 'tree', pets: ['bunny'],
    grid: [[5, 6], [6, 8]], fill: [0.65, 0.82], truck: [0.3, 0.35], obstacles: [2, 4], petCount: [0, 1], hard: [0.4, 0.7],
  },
  {
    id: 'farm', name: 'Farm Friends', icon: '🐥',
    obstacle: 'hay', pets: ['duck', 'pig', 'chick', 'puppy'],
    grid: [[6, 7], [6, 8]], fill: [0.68, 0.84], truck: [0.3, 0.35], obstacles: [1, 3], petCount: [1, 3], hard: [0.5, 0.8],
  },
  {
    id: 'snow', name: 'Snowy Hills', icon: '❄️',
    obstacle: 'snowman', pets: ['penguin', 'bunny'],
    grid: [[6, 8], [7, 9]], fill: [0.7, 0.85], truck: [0.3, 0.4], obstacles: [2, 4], petCount: [0, 2], hard: [0.6, 0.9],
  },
  {
    id: 'night', name: 'Night City', icon: '🌙',
    obstacle: 'cone', pets: ['kitty', 'puppy'],
    grid: [[7, 8], [7, 9]], fill: [0.72, 0.86], truck: [0.35, 0.4], obstacles: [2, 4], petCount: [1, 2], hard: [0.7, 1],
  },
];

export const CAMPAIGN_LEVELS = WORLDS.length * LEVELS_PER_WORLD;

const lerp = (a, b, t) => a + (b - a) * t;

/** Generator parameters for 1-based level number n (works past the campaign too). */
export function levelParams(n) {
  let wi = Math.floor((n - 1) / LEVELS_PER_WORLD);
  let t = ((n - 1) % LEVELS_PER_WORLD) / (LEVELS_PER_WORLD - 1);
  const endless = wi >= WORLDS.length;
  if (endless) {
    // Bonus levels cycle themes at near-max difficulty, with a gentle wobble.
    wi = (n - 1) % WORLDS.length;
    t = 0.55 + 0.45 * (((n * 7) % 10) / 9);
  }
  const W = WORLDS[wi];
  // Every 5th level is a little breather; every 10th a bigger "boss" lot.
  const k = n % 10;
  let tt = t;
  if (!endless) {
    if (k === 5) tt = Math.max(0, t - 0.25);
    if (k === 0) tt = Math.min(1, t + 0.1);
  }
  const w = Math.round(lerp(W.grid[0][0], W.grid[1][0], tt));
  const h = Math.round(lerp(W.grid[0][1], W.grid[1][1], tt));
  const truck = lerp(W.truck[0], W.truck[1], tt);
  const obstacles = Math.round(lerp(W.obstacles[0], W.obstacles[1], tt));
  const pets = Math.round(lerp(W.petCount[0], W.petCount[1], tt));
  const fill = lerp(W.fill[0], W.fill[1], tt);
  const hard = endless ? Math.min(1, 0.75 + 0.25 * t) : lerp(W.hard[0], W.hard[1], tt);
  const avgLen = 2 + truck;
  const count = Math.max(1, Math.round((fill * (w * h - obstacles - pets)) / avgLen));
  return {
    world: wi, theme: W.id, w, h, count, truck, obstacles, pets,
    bias: lerp(0.3, 1.2, hard),
    improve: Math.round(lerp(150, 500, hard)),
    targetDepth: Math.max(1, Math.round(lerp(0.3, 0.75, hard) * count)),
    freeWeight: lerp(0, 0.5, hard),
    attempts: 14,
  };
}
