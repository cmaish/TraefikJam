// Level generation + solving for the "drive out of the lot" puzzle.
// Shared by the browser (endless levels) and tools/build-levels.mjs.
//
// Model: a w*h grid. Vehicles are 1 cell wide and `len` cells long, lying along
// the axis of their direction. dir: 0=up 1=right 2=down 3=left.
// Tapping a vehicle drives it forward; it leaves the lot only if every cell in
// front of it (to the edge) is empty. Obstacles never move. Pets leave on tap.
// Because leaving only ever frees cells, a lot is solvable iff greedily removing
// free vehicles empties it.

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isHoriz = (dir) => dir === 1 || dir === 3;

export function vehicleCells(v) {
  const out = [];
  const h = isHoriz(v.dir);
  for (let i = 0; i < v.len; i++) out.push(h ? [v.x + i, v.y] : [v.x, v.y + i]);
  return out;
}

export function frontCell(v) {
  if (v.dir === 1) return [v.x + v.len - 1, v.y];
  if (v.dir === 2) return [v.x, v.y + v.len - 1];
  return [v.x, v.y];
}

export function rayCells(v, w, h) {
  let [x, y] = frontCell(v);
  const out = [];
  x += DX[v.dir];
  y += DY[v.dir];
  while (x >= 0 && y >= 0 && x < w && y < h) {
    out.push([x, y]);
    x += DX[v.dir];
    y += DY[v.dir];
  }
  return out;
}

/** Which edge a vehicle drives out through: [side, index] (sides: 0 top, 1 right, 2 bottom, 3 left). */
export function exitOf(v) {
  return v.dir === 0 || v.dir === 2 ? [v.dir, v.x] : [v.dir, v.y];
}
const edgeKey = (side, i) => side * 1000 + i;
export function barrierSet(level) {
  return new Set((level.barriers || []).map((b) => edgeKey(b.side, b.i)));
}
export function exitBarred(v, barred) {
  const [side, i] = exitOf(v);
  return barred.has(edgeKey(side, i));
}

/** Solve by greedy rounds. Pets are ignored (they can always be tapped away). */
export function analyze(level) {
  const { w, h } = level;
  const grid = new Int16Array(w * h).fill(-1);
  for (const o of level.obstacles || []) grid[o.y * w + o.x] = -2;
  level.vehicles.forEach((v, i) => {
    for (const [x, y] of vehicleCells(v)) grid[y * w + x] = i;
  });
  const barred = barrierSet(level);
  const remaining = new Set(level.vehicles.map((_, i) => i));
  let depth = 0;
  let freeStart = -1;
  const order = [];
  while (remaining.size) {
    const free = [];
    for (const i of remaining) {
      const ray = rayCells(level.vehicles[i], w, h);
      if (!exitBarred(level.vehicles[i], barred) && ray.every(([x, y]) => grid[y * w + x] === -1)) free.push(i);
    }
    if (!free.length) return { solvable: false, depth, freeStart, order };
    if (freeStart < 0) freeStart = free.length;
    for (const i of free) {
      for (const [x, y] of vehicleCells(level.vehicles[i])) grid[y * w + x] = -1;
      remaining.delete(i);
      order.push(i);
    }
    depth++;
  }
  return { solvable: true, depth, freeStart: Math.max(0, freeStart), order };
}

function pickWeighted(items, weights, rand) {
  let total = 0;
  for (const wt of weights) total += wt;
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function attempt(p, rand) {
  const { w, h } = p;
  const grid = new Int16Array(w * h).fill(-1); // -1 empty, -2 obstacle, >=0 vehicle
  const rayCount = new Int16Array(w * h);
  const obstacles = [];
  const vehicles = [];

  // Obstacles: prefer interior cells, avoid touching each other.
  let tries = 0;
  while (obstacles.length < (p.obstacles || 0) && tries++ < 200) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    if (grid[y * w + x] !== -1) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (edge && rand() < 0.7) continue;
    let near = false;
    for (const o of obstacles) if (Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) near = true;
    if (near && rand() < 0.85) continue;
    grid[y * w + x] = -2;
    obstacles.push({ x, y });
  }

  // Edge barriers: runs of 1-3 closed exits along the lot's sides.
  const barriers = [];
  const barred = new Set();
  const sideLen = (side) => (side % 2 === 0 ? w : h);
  const perSide = [0, 0, 0, 0];
  let bt = 0;
  while (barriers.length < (p.barriers || 0) && bt++ < 60) {
    const side = Math.floor(rand() * 4);
    const n = sideLen(side);
    const run = Math.min(n - 1, 1 + Math.floor(rand() * 3));
    if (perSide[side] + run > Math.floor(n * 0.6)) continue;
    const start = Math.floor(rand() * (n - run + 1));
    let clash = false;
    for (let k = 0; k < run; k++) if (barred.has(edgeKey(side, start + k))) clash = true;
    if (clash) continue;
    for (let k = 0; k < run && barriers.length < p.barriers; k++) {
      barred.add(edgeKey(side, start + k));
      barriers.push({ side, i: start + k });
      perSide[side]++;
    }
  }

  const truckShare = p.truck || 0;
  const bias = p.bias ?? 1;
  while (vehicles.length < p.count) {
    const cands = [];
    const weights = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let dir = 0; dir < 4; dir++) {
          for (const len of truckShare > 0 ? [2, 3] : [2]) {
            const v = { x, y, len, dir };
            const cells = vehicleCells(v);
            let ok = true;
            let score = 0;
            for (const [cx, cy] of cells) {
              if (cx >= w || cy >= h || grid[cy * w + cx] !== -1) { ok = false; break; }
              score += rayCount[cy * w + cx];
            }
            if (!ok || exitBarred(v, barred)) continue;
            const ray = rayCells(v, w, h);
            for (const [rx, ry] of ray) if (grid[ry * w + rx] !== -1) { ok = false; break; }
            if (!ok) continue;
            const lenW = len === 3 ? truckShare : 1 - truckShare;
            // Prefer spots that sit in front of already placed vehicles (creates chains)
            // and longer escape routes (vehicles deeper inside the lot).
            const wt = lenW * (1 + bias * score * score) * (1 + 0.15 * ray.length);
            cands.push(v);
            weights.push(wt);
          }
        }
      }
    }
    if (!cands.length) break;
    const v = pickWeighted(cands, weights, rand);
    const id = vehicles.length;
    for (const [cx, cy] of vehicleCells(v)) grid[cy * w + cx] = id;
    for (const [rx, ry] of rayCells(v, w, h)) rayCount[ry * w + rx]++;
    vehicles.push(v);
  }

  // Pets sit in empty cells, preferably right in somebody's way.
  const pets = [];
  const empties = [];
  const ew = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (grid[y * w + x] === -1) { empties.push({ x, y }); ew.push(0.2 + rayCount[y * w + x] ** 2); }
  while (pets.length < (p.pets || 0) && empties.length) {
    const c = pickWeighted(empties, ew, rand);
    const i = empties.indexOf(c);
    empties.splice(i, 1);
    ew.splice(i, 1);
    pets.push(c);
  }

  // Shuffle vehicle order so ids don't leak the solution order.
  for (let i = vehicles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [vehicles[i], vehicles[j]] = [vehicles[j], vehicles[i]];
  }
  return { w, h, vehicles, obstacles, pets, barriers };
}

function scoreLevel(p, lvl, info) {
  const n = lvl.vehicles.length;
  const cells = lvl.vehicles.reduce((s, v) => s + v.len, 0);
  const density = cells / (p.w * p.h - (lvl.obstacles || []).length);
  let score = -Math.abs(n - p.count) * 4 + density * 6;
  if (p.targetDepth) score -= Math.abs(info.depth - p.targetDepth) * 3;
  else score += info.depth * (p.depthWeight ?? 2);
  score -= Math.max(0, info.freeStart - (p.maxFree ?? 99)) * 2;
  score -= info.freeStart * (p.freeWeight ?? 0);
  if (info.depth < (p.minDepth || 0)) score -= 20;
  // Variety: penalise lots where nearly everyone faces the same way.
  const dirs = [0, 0, 0, 0];
  for (const v of lvl.vehicles) dirs[v.dir]++;
  score -= (Math.max(...dirs) / Math.max(1, n)) * 4;
  return score;
}

function occupied(lvl) {
  const { w, h } = lvl;
  const grid = new Int16Array(w * h).fill(-1);
  for (const o of lvl.obstacles) grid[o.y * w + o.x] = -2;
  for (const pt of lvl.pets || []) grid[pt.y * w + pt.x] = -3;
  lvl.vehicles.forEach((v, i) => { for (const [x, y] of vehicleCells(v)) grid[y * w + x] = i; });
  return grid;
}

/** Hill-climb: flip / relocate vehicles while the lot stays solvable and gets more interesting. */
function improve(p, lvl, info, rand, steps) {
  let score = scoreLevel(p, lvl, info);
  const { w, h } = lvl;
  for (let s = 0; s < steps; s++) {
    const i = Math.floor(rand() * lvl.vehicles.length);
    const old = lvl.vehicles[i];
    let nv;
    if (rand() < 0.6) {
      nv = { ...old, dir: (old.dir + 2) % 4 };
    } else {
      const grid = occupied(lvl);
      for (const [x, y] of vehicleCells(old)) grid[y * w + x] = -1;
      const dir = Math.floor(rand() * 4);
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      nv = { x, y, len: old.len, dir };
      if (vehicleCells(nv).some(([cx, cy]) => cx >= w || cy >= h || grid[cy * w + cx] !== -1)) continue;
    }
    lvl.vehicles[i] = nv;
    const ni = analyze(lvl);
    const ns = ni.solvable ? scoreLevel(p, lvl, ni) : -Infinity;
    if (ns >= score) { score = ns; info = ni; } else lvl.vehicles[i] = old;
  }
  return info;
}

/**
 * Top up a lot towards its target count: try extra vehicles in empty spots and keep each one
 * only if the lot is still solvable. Used for the big late-game lots, where the constructive
 * pass runs out of room early.
 */
function fillUp(p, lvl, rand, tries) {
  const { w, h } = lvl;
  const barred = barrierSet(lvl);
  for (let k = 0; k < tries && lvl.vehicles.length < p.count; k++) {
    const grid = occupied(lvl);
    const empties = [];
    for (let i = 0; i < w * h; i++) if (grid[i] === -1) empties.push(i);
    if (!empties.length) break;
    const c = empties[Math.floor(rand() * empties.length)];
    const len = rand() < (p.truck || 0) ? 3 : 2;
    const dir = Math.floor(rand() * 4);
    const v = { x: c % w, y: Math.floor(c / w), len, dir };
    if (vehicleCells(v).some(([cx, cy]) => cx >= w || cy >= h || grid[cy * w + cx] !== -1)) continue;
    if (exitBarred(v, barred)) continue;
    lvl.vehicles.push(v);
    if (!analyze(lvl).solvable) lvl.vehicles.pop();
  }
}

/**
 * Generate a level. p = { w, h, count, truck (0..1), obstacles, pets, bias,
 * attempts, minDepth } . Returns { w, h, vehicles, obstacles, pets, depth }.
 */
export function generate(p, seed) {
  const rand = makeRng(seed);
  const attempts = p.attempts || 24;
  let best = null;
  let bestScore = -Infinity;
  for (let a = 0; a < attempts; a++) {
    const lvl = attempt(p, rand);
    let info = analyze(lvl);
    if (!info.solvable) continue; // never happens by construction, but be safe
    if (p.improve) info = improve(p, lvl, info, rand, p.improve);
    if (p.fill) { fillUp(p, lvl, rand, p.fill); info = analyze(lvl); }
    const score = scoreLevel(p, lvl, info);
    if (score > bestScore) {
      bestScore = score;
      best = { ...lvl, depth: info.depth, freeStart: info.freeStart };
    }
  }
  return best;
}

/** Rotate a level 90° clockwise (for landscape screens). */
export function rotateLevel(lvl) {
  const { w, h } = lvl;
  const rc = (x, y) => [h - 1 - y, x];
  const rotV = (v) => {
    const cells = vehicleCells(v).map(([x, y]) => rc(x, y));
    const x = Math.min(...cells.map((c) => c[0]));
    const y = Math.min(...cells.map((c) => c[1]));
    return { ...v, x, y, dir: (v.dir + 1) % 4 };
  };
  const rotP = (o) => { const [x, y] = rc(o.x, o.y); return { ...o, x, y }; };
  // edges turn clockwise too: top->right, right->bottom (flipped), bottom->left, left->top (flipped)
  const rotB = (b) => ({ ...b, side: (b.side + 1) % 4, i: b.side === 1 || b.side === 3 ? h - 1 - b.i : b.i });
  return {
    ...lvl,
    w: h,
    h: w,
    barriers: (lvl.barriers || []).map(rotB),
    vehicles: lvl.vehicles.map(rotV),
    obstacles: (lvl.obstacles || []).map(rotP),
    pets: (lvl.pets || []).map(rotP),
  };
}
