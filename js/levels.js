import { LEVELS } from './levels-data.js';
import { generate, makeRng } from './generator.js';
import { WORLDS, levelParams, CAMPAIGN_LEVELS } from './worlds.js';
import { dressVehicles } from './vehicles.js';

const cache = new Map();

function raw(n) {
  if (n <= LEVELS.length) {
    const L = LEVELS[n - 1];
    return {
      w: L.w, h: L.h,
      vehicles: L.v.map(([x, y, len, dir]) => ({ x, y, len, dir })),
      obstacles: L.o.map(([x, y]) => ({ x, y })),
      pets: L.p.map(([x, y]) => ({ x, y })),
      barriers: (L.b || []).map(([side, i]) => ({ side, i })),
    };
  }
  if (!cache.has(n)) cache.set(n, generate({ ...levelParams(n), attempts: 6 }, n * 7919 + 13));
  return cache.get(n);
}

// What blocks a closed exit in each world.
const BARRIER_TYPES = {
  sunny: ['hedge'], trucks: ['cones', 'booth'], forest: ['hedge', 'hedge', 'sign'], farm: ['fence', 'hedge'],
  snow: ['snowbank', 'sign', 'cones'], night: ['cones', 'booth', 'sign'],
};

/** Give each run of closed exits a look (hedge, fence, roadworks, booth with a boom gate...). */
function dressBarriers(barriers, theme, rand) {
  const list = [...barriers].sort((a, b) => a.side - b.side || a.i - b.i);
  const out = [];
  let run = null;
  for (const b of list) {
    if (run && run.side === b.side && run.last === b.i - 1) { run.cells.push(b); run.last = b.i; continue; }
    run = { side: b.side, last: b.i, cells: [b] };
    out.push(run);
  }
  const types = BARRIER_TYPES[theme] || ['cones'];
  const res = [];
  out.forEach((r, k) => {
    let type = types[Math.floor(rand() * types.length)];
    if (type === 'booth' && r.cells.length > 1) type = 'cones';
    r.cells.forEach((c, j) => res.push({ side: c.side, i: c.i, type, run: k, first: j === 0, last: j === r.cells.length - 1 }));
  });
  return res;
}

export function worldOf(n) {
  const p = levelParams(n);
  return WORLDS[p.world];
}

export function getLevel(n, unlocked) {
  const base = raw(n);
  const W = worldOf(n);
  const rand = makeRng(n * 31 + 7);
  const vehicles = dressVehicles(base.vehicles, unlocked, rand).map((v, i) => ({ ...v, id: i }));
  const obstacles = base.obstacles.map((o) => ({ ...o, type: W.obstacle === 'tree' && rand() < 0.4 ? 'bush' : W.obstacle }));
  const petTypes = W.pets.length ? W.pets : ['duck'];
  const pets = base.pets.map((p, i) => ({ ...p, id: i, type: petTypes[Math.floor(rand() * petTypes.length)] }));
  const P = levelParams(n);
  const barriers = dressBarriers(base.barriers || [], W.id, makeRng(n * 53 + 11));
  return { n, theme: W.id, world: W, w: base.w, h: base.h, vehicles, obstacles, pets, barriers, walkers: P.walkers, cars: P.cars, bonus: n > CAMPAIGN_LEVELS };
}

export { CAMPAIGN_LEVELS };

/** The daily puzzle: same for everyone on a given date, hard-ish, rotating themes. */
export function getDailyLevel(dateKey, unlocked) {
  let seed = 0;
  for (const ch of dateKey) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const theme = seed % WORLDS.length;
  const base = WORLDS.length * 20 + 1 + theme; // a bonus-level-shaped puzzle for that theme
  const p = { ...levelParams(base), attempts: 8 };
  const lvl = generate(p, seed);
  const W = WORLDS[theme];
  const rand = makeRng(seed ^ 0x5bd1);
  const vehicles = dressVehicles(lvl.vehicles, unlocked, rand).map((v, i) => ({ ...v, id: i }));
  const obstacles = lvl.obstacles.map((o) => ({ ...o, type: W.obstacle === 'tree' && rand() < 0.4 ? 'bush' : W.obstacle }));
  const petTypes = W.pets.length ? W.pets : ['duck'];
  const pets = lvl.pets.map((pt, i) => ({ ...pt, id: i, type: petTypes[Math.floor(rand() * petTypes.length)] }));
  const barriers = dressBarriers(lvl.barriers || [], W.id, rand);
  return { n: 9000 + (seed % 997), daily: dateKey, theme: W.id, world: W, w: lvl.w, h: lvl.h, vehicles, obstacles, pets, barriers, walkers: p.walkers, cars: p.cars, bonus: true };
}
