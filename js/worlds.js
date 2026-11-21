// World / difficulty curve definitions. Shared by the level builder and the
// runtime (endless levels beyond the hand-built campaign).

export const LEVELS_PER_WORLD = 20;

export const WORLDS = [
  {
    id: 'sunny', name: 'Sunny Town', icon: '☀️',
    obstacle: 'bush', pets: [],
    grid: [[3, 4], [5, 7]], fill: [0.5, 0.8], truck: [0, 0.15], obstacles: [0, 0], petCount: [0, 0], hard: [0, 0.5], barriers: [0, 0], walkers: [0, 0], cars: [0, 0],
  },
  {
    id: 'trucks', name: 'Truck Stop', icon: '🚚',
    obstacle: 'cone', pets: [],
    grid: [[5, 6], [6, 8]], fill: [0.65, 0.82], truck: [0.3, 0.4], obstacles: [0, 2], petCount: [0, 0], hard: [0.4, 0.7], barriers: [0, 0], walkers: [0, 0], cars: [0, 0],
  },
  {
    id: 'forest', name: 'Forest Park', icon: '🌲',
    obstacle: 'tree', pets: ['bunny'],
    grid: [[6, 7], [7, 9]], fill: [0.7, 0.84], truck: [0.3, 0.35], obstacles: [2, 4], petCount: [0, 1], hard: [0.55, 0.8], barriers: [-1, 4], walkers: [0, 0], cars: [0, 0],
  },
  {
    id: 'farm', name: 'Farm Friends', icon: '🐥',
    obstacle: 'hay', pets: ['duck', 'pig', 'chick', 'puppy'],
    grid: [[6, 8], [7, 9]], fill: [0.72, 0.85], truck: [0.3, 0.35], obstacles: [1, 3], petCount: [1, 3], hard: [0.65, 0.88], barriers: [1, 5], walkers: [-0.6, 2], cars: [0, 0],
  },
  {
    id: 'snow', name: 'Snowy Hills', icon: '❄️',
    obstacle: 'snowman', pets: ['penguin', 'bunny'],
    grid: [[7, 8], [8, 10]], fill: [0.74, 0.86], truck: [0.3, 0.4], obstacles: [2, 4], petCount: [0, 2], hard: [0.75, 0.95], barriers: [2, 6], walkers: [0.6, 2], cars: [-0.8, 2],
  },
  {
    id: 'night', name: 'Night City', icon: '🌙',
    obstacle: 'cone', pets: ['kitty', 'puppy'],
    grid: [[7, 9], [8, 10]], fill: [0.76, 0.87], truck: [0.35, 0.4], obstacles: [2, 4], petCount: [1, 2], hard: [0.85, 1], barriers: [3, 7], walkers: [1, 2], cars: [0.6, 3],
  },
  // Big lots: the grid keeps growing, from 9x11 up to 15x19 (pinch / scroll to zoom).
  {
    id: 'city', name: 'Downtown', icon: '🏙️',
    obstacle: 'cone', pets: ['puppy', 'kitty'],
    grid: [[9, 11], [10, 13]], fill: [0.8, 0.86], truck: [0.35, 0.4], obstacles: [2, 4], petCount: [1, 2], hard: [0.85, 0.95], barriers: [4, 9], walkers: [2, 3], cars: [2, 3], big: true,
  },
  {
    id: 'beach', name: 'Seaside', icon: '🏖️',
    obstacle: 'palm', pets: ['duck', 'chick', 'puppy'],
    grid: [[10, 13], [12, 16]], fill: [0.8, 0.86], truck: [0.35, 0.4], obstacles: [3, 5], petCount: [1, 3], hard: [0.85, 0.97], barriers: [6, 12], walkers: [2, 4], cars: [2, 3], big: true,
  },
  {
    id: 'mega', name: 'Mega Lot', icon: '🏟️',
    obstacle: 'cone', pets: ['puppy', 'kitty', 'duck'],
    grid: [[12, 15], [15, 19]], fill: [0.8, 0.86], truck: [0.35, 0.42], obstacles: [4, 6], petCount: [2, 3], hard: [0.9, 1], barriers: [8, 16], walkers: [3, 4], cars: [3, 4], big: true,
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
  let w = Math.round(lerp(W.grid[0][0], W.grid[1][0], tt));
  let h = Math.round(lerp(W.grid[0][1], W.grid[1][1], tt));
  if (endless) { w = Math.min(w, 11); h = Math.min(h, 14); } // bonus lots are generated on the device
  const truck = lerp(W.truck[0], W.truck[1], tt);
  const obstacles = Math.round(lerp(W.obstacles[0], W.obstacles[1], tt));
  const pets = Math.round(lerp(W.petCount[0], W.petCount[1], tt));
  const fill = lerp(W.fill[0], W.fill[1], tt);
  const hard = endless ? Math.min(1, 0.75 + 0.25 * t) : lerp(W.hard[0], W.hard[1], tt);
  const barriers = endless ? 3 + ((n * 5) % 4) : Math.max(0, Math.round(lerp(W.barriers[0], W.barriers[1], tt)));
  const walkers = endless ? 1 + (n % 2) : Math.max(0, Math.round(lerp(W.walkers[0], W.walkers[1], tt)));
  const cars = endless ? (n % 3) + 1 : Math.max(0, Math.round(lerp(W.cars[0], W.cars[1], tt)));
  const avgLen = 2 + truck;
  const count = Math.max(1, Math.round((fill * (w * h - obstacles - pets)) / avgLen));
  return {
    world: wi, theme: W.id, w, h, count, truck, obstacles, pets, barriers, walkers, cars,
    bias: lerp(0.3, 1.2, hard),
    improve: Math.round(lerp(150, 500, hard)),
    targetDepth: Math.max(1, Math.round(lerp(0.3, 0.75, hard) * count)),
    freeWeight: lerp(0, 0.5, hard),
    attempts: W.big && !endless ? 6 : endless ? 4 : 14,
    ...(W.big ? { fill: endless ? 120 : 400, improve: endless ? 150 : 300 } : {}),
  };
}
