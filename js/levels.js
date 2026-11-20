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
    };
  }
  if (!cache.has(n)) cache.set(n, generate(levelParams(n), n * 7919 + 13));
  return cache.get(n);
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
  return { n, theme: W.id, world: W, w: base.w, h: base.h, vehicles, obstacles, pets, bonus: n > CAMPAIGN_LEVELS };
}

export { CAMPAIGN_LEVELS };
