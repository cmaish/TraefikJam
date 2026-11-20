import { DX, DY, isHoriz, vehicleCells, rayCells, rotateLevel, makeRng } from './generator.js';
import { drawVehicle, drawObstacle, drawPet, drawHand, rr, shade } from './draw.js';
import { FX } from './fx.js';
import { KINDS } from './vehicles.js';

const THEMES = {
  sunny: { ground: '#9be38f', ground2: '#86d67b', lot: '#646c80', line: 'rgba(255,255,255,0.35)', curb: '#e9ecf2', deco: ['flower', 'flower', 'tuft'] },
  trucks: { ground: '#f3d98b', ground2: '#e9c86d', lot: '#5d6274', line: 'rgba(255,230,120,0.5)', curb: '#d9dde6', deco: ['pebble', 'tuft', 'cactus'] },
  forest: { ground: '#6cc070', ground2: '#5aae5f', lot: '#5f6a72', line: 'rgba(255,255,255,0.3)', curb: '#c9d1c0', deco: ['tree', 'mushroom', 'tuft'] },
  farm: { ground: '#a9df7a', ground2: '#97cf66', lot: '#b08a62', line: 'rgba(255,255,255,0.35)', curb: '#8a6440', deco: ['flower', 'fence', 'tuft'] },
  snow: { ground: '#eef6ff', ground2: '#dcebfb', lot: '#7d8aa3', line: 'rgba(255,255,255,0.5)', curb: '#ffffff', deco: ['pine', 'snowpile', 'pine'] },
  night: { ground: '#25305a', ground2: '#1e2850', lot: '#3a4166', line: 'rgba(255,230,140,0.35)', curb: '#59628e', deco: ['lamp', 'starry', 'starry'] },
};

const easeOut = (t) => 1 - (1 - t) * (1 - t);

export class Game {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.fx = new FX();
    this.time = 0;
    this.level = null;
    this.running = false;
    this.snow = [];
    this._last = 0;
    this._loop = this._loop.bind(this);
    canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement);
  }

  get settings() { return this.hooks.settings(); }

  load(level) {
    this.level = structuredClone({ ...level, world: undefined });
    this.levelN = level.n;
    this.vehicles = this.level.vehicles.map((v) => ({
      ...v, state: 'idle', off: 0, vel: 0, squish: 0, wiggle: 0, mood: 'idle', moodT: 0,
      blinkT: 1 + Math.random() * 4, blink: false, z: 0,
    }));
    this.pets = this.level.pets.map((p) => ({ ...p, state: 'idle', t: 0, phase: Math.random() * 6 }));
    this.obstacles = this.level.obstacles;
    this.total = this.vehicles.length;
    this.exited = 0;
    this.bumps = 0;
    this.taps = 0;
    this.idle = 0;
    this.hint = null;
    this.won = false;
    this.fx.clear();
    this.shake = 0;
    this.rotated = false;
    this._z = 0;
    this.resize(true);
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() { this.running = false; }

  // ------------------------------------------------------------ layout ---

  resize(force) {
    const parent = this.canvas.parentElement;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    if (!cw || !ch) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.cw = cw;
    this.ch = ch;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    if (!this.level) return;

    // Turn the lot sideways on landscape screens so it fills the space.
    const L = this.level;
    const landscape = cw > ch * 1.08;
    const portrait = ch > cw * 1.08;
    if ((landscape && L.h > L.w) || (portrait && L.w > L.h)) this._rotate();

    const pad = 0.9;
    this.cell = Math.floor(Math.min(cw / (L.w + pad * 2), ch / (L.h + pad * 2), 140));
    this.ox = Math.round((cw - L.w * this.cell) / 2);
    this.oy = Math.round((ch - L.h * this.cell) / 2);
    this._buildBackground();
    if (this.level.theme === 'snow' && (!this.snow.length || force)) {
      this.snow = Array.from({ length: 50 }, () => ({ x: Math.random() * cw, y: Math.random() * ch, r: 1.5 + Math.random() * 3, s: 15 + Math.random() * 30, d: Math.random() * 6 }));
    }
  }

  _rotate() {
    const L = this.level;
    const live = {
      ...L,
      vehicles: this.vehicles.filter((v) => v.state !== 'gone' && v.state !== 'exit'),
      pets: this.pets.filter((p) => p.state === 'idle'),
      obstacles: this.obstacles,
    };
    const r = rotateLevel(live);
    this.level = { ...L, w: r.w, h: r.h };
    for (const v of this.vehicles) {
      if (v.state === 'exit') v.state = 'gone';
      const nv = r.vehicles.find((x) => x.id === v.id);
      if (nv) Object.assign(v, { x: nv.x, y: nv.y, dir: nv.dir, off: 0, vel: 0, state: v.state === 'bump' ? 'idle' : v.state });
    }
    for (const p of this.pets) {
      if (p.state !== 'idle') { p.state = 'gone'; continue; }
      const np = r.pets.find((x) => x.id === p.id);
      Object.assign(p, { x: np.x, y: np.y });
    }
    this.obstacles = r.obstacles;
    this.hint = null;
    this.rotated = !this.rotated;
  }

  _buildBackground() {
    const { cw, ch, dpr, cell: s, ox, oy } = this;
    const L = this.level;
    const th = THEMES[L.theme] || THEMES.sunny;
    this.theme = th;
    const bg = document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const c = bg.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = th.ground;
    c.fillRect(0, 0, cw, ch);
    const rand = makeRng(this.levelN * 13 + 5);
    // soft ground blobs
    for (let i = 0; i < 18; i++) {
      c.fillStyle = th.ground2;
      c.beginPath();
      c.ellipse(rand() * cw, rand() * ch, 30 + rand() * 80, 20 + rand() * 50, rand() * 3, 0, Math.PI * 2);
      c.fill();
    }
    const lotX = ox - s * 0.18, lotY = oy - s * 0.18, lotW = L.w * s + s * 0.36, lotH = L.h * s + s * 0.36;
    // decorations outside the lot
    const decoS = Math.max(18, s * 0.55);
    for (let i = 0; i < 40; i++) {
      const x = rand() * cw, y = rand() * ch;
      if (x > lotX - decoS * 0.6 && x < lotX + lotW + decoS * 0.6 && y > lotY - decoS * 0.6 && y < lotY + lotH + decoS * 0.6) continue;
      this._deco(c, th.deco[Math.floor(rand() * th.deco.length)], x, y, decoS, rand);
    }
    // lot
    c.fillStyle = 'rgba(0,0,0,0.18)';
    rr(c, lotX + 4, lotY + 6, lotW, lotH, s * 0.3); c.fill();
    c.fillStyle = th.curb;
    rr(c, lotX - s * 0.08, lotY - s * 0.08, lotW + s * 0.16, lotH + s * 0.16, s * 0.34); c.fill();
    c.fillStyle = th.lot;
    rr(c, lotX, lotY, lotW, lotH, s * 0.28); c.fill();
    // speckle texture
    for (let i = 0; i < L.w * L.h * 6; i++) {
      c.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      c.fillRect(lotX + rand() * lotW, lotY + rand() * lotH, 2, 2);
    }
    // parking slot marks
    c.strokeStyle = th.line;
    c.lineWidth = Math.max(1.5, s * 0.03);
    c.setLineDash([s * 0.12, s * 0.12]);
    for (let x = 1; x < L.w; x++) { c.beginPath(); c.moveTo(ox + x * s, oy + s * 0.1); c.lineTo(ox + x * s, oy + L.h * s - s * 0.1); c.stroke(); }
    for (let y = 1; y < L.h; y++) { c.beginPath(); c.moveTo(ox + s * 0.1, oy + y * s); c.lineTo(ox + L.w * s - s * 0.1, oy + y * s); c.stroke(); }
    c.setLineDash([]);
    this.bg = bg;
  }

  _deco(c, type, x, y, s, rand) {
    c.save();
    c.translate(x, y);
    const circle = (cx, cy, r, f) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = f; c.fill(); };
    if (type === 'flower') {
      const col = ['#ff6b9a', '#ffd23f', '#ffffff', '#9b5de5', '#ff9f1c'][Math.floor(rand() * 5)];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; circle(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14, s * 0.1, col); }
      circle(0, 0, s * 0.08, '#ffb703');
    } else if (type === 'tuft') {
      c.strokeStyle = 'rgba(40,120,40,0.5)'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * s * 0.08, 0); c.lineTo(i * s * 0.14, -s * 0.22); c.stroke(); }
    } else if (type === 'pebble') {
      circle(0, 0, s * 0.12, '#d8b56a'); circle(s * 0.15, s * 0.05, s * 0.08, '#cfa95a');
    } else if (type === 'cactus') {
      c.fillStyle = '#4caf50';
      rr(c, -s * 0.08, -s * 0.4, s * 0.16, s * 0.45, s * 0.08); c.fill();
      rr(c, -s * 0.26, -s * 0.28, s * 0.12, s * 0.2, s * 0.06); c.fill();
      rr(c, s * 0.14, -s * 0.32, s * 0.12, s * 0.2, s * 0.06); c.fill();
    } else if (type === 'tree' || type === 'pine') {
      if (type === 'pine') {
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(s * 0.05, s * 0.05, s * 0.35, s * 0.2, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 3; i++) {
          c.fillStyle = ['#2f7d4a', '#3a9159', '#4aa86a'][i];
          c.beginPath(); c.moveTo(0, -s * (0.55 - i * 0.12) - s * 0.1); c.lineTo(-s * (0.35 - i * 0.08), -s * (0.1 - i * 0.1) + s * 0.05); c.lineTo(s * (0.35 - i * 0.08), -s * (0.1 - i * 0.1) + s * 0.05); c.fill();
        }
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -s * 0.65); c.lineTo(-s * 0.1, -s * 0.48); c.lineTo(s * 0.1, -s * 0.48); c.fill();
      } else drawObstacle(c, 'tree', s, 0);
    } else if (type === 'mushroom') {
      c.fillStyle = '#f4efe6'; c.fillRect(-s * 0.05, -s * 0.05, s * 0.1, s * 0.14);
      c.beginPath(); c.arc(0, -s * 0.05, s * 0.15, Math.PI, 0); c.fillStyle = '#e63946'; c.fill();
      circle(-s * 0.06, -s * 0.11, s * 0.03, '#fff'); circle(s * 0.06, -s * 0.09, s * 0.025, '#fff');
    } else if (type === 'fence') {
      c.fillStyle = '#fff'; c.strokeStyle = '#c9b79c'; c.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { rr(c, i * s * 0.2 - s * 0.04, -s * 0.3, s * 0.08, s * 0.34, s * 0.03); c.fill(); c.stroke(); }
      c.fillRect(-s * 0.3, -s * 0.22, s * 0.6, s * 0.05); c.fillRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.05);
    } else if (type === 'snowpile') {
      circle(0, 0, s * 0.2, '#ffffff'); circle(s * 0.15, s * 0.05, s * 0.13, '#f4f9ff');
    } else if (type === 'lamp') {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.9);
      g.addColorStop(0, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 0.9, 0, Math.PI * 2); c.fill();
      circle(0, 0, s * 0.12, '#ffe9a8'); circle(0, 0, s * 0.06, '#fff');
    } else if (type === 'starry') {
      for (let i = 0; i < 3; i++) circle((rand() - 0.5) * s, (rand() - 0.5) * s, 1 + rand() * 1.8, 'rgba(255,255,230,0.85)');
    }
    c.restore();
  }

  // ------------------------------------------------------------ logic ---

  _present(v) { return v.state === 'idle' || v.state === 'bump'; }

  blockerAt(x, y, except) {
    for (const v of this.vehicles) {
      if (v === except || !this._present(v)) continue;
      for (const [cx, cy] of vehicleCells(v)) if (cx === x && cy === y) return { kind: 'vehicle', obj: v };
    }
    for (const p of this.pets) if (p.state === 'idle' && p.x === x && p.y === y) return { kind: 'pet', obj: p };
    for (const o of this.obstacles) if (o.x === x && o.y === y) return { kind: 'obstacle', obj: o };
    return null;
  }

  isFree(v) {
    const ray = rayCells(v, this.level.w, this.level.h);
    return ray.every(([x, y]) => !this.blockerAt(x, y, v));
  }

  /** Best thing to tap next (for hints and tests). */
  findHint() {
    const free = this.vehicles.filter((v) => v.state === 'idle' && this.isFree(v));
    if (free.length) return { kind: 'vehicle', obj: free[Math.floor(free.length / 2)] };
    const pet = this.pets.find((p) => p.state === 'idle');
    if (pet) return { kind: 'pet', obj: pet };
    return null;
  }

  _hit(px, py) {
    const s = this.cell;
    const fx = (px - this.ox) / s;
    const fy = (py - this.oy) / s;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    const direct = this.blockerAt(cx, cy, null);
    if (direct && direct.kind !== 'obstacle') return direct;
    // Fat-finger tolerance: nearest vehicle/pet within ~0.45 cell.
    let best = null, bestD = 0.45;
    for (const v of this.vehicles) {
      if (!this._present(v)) continue;
      const h = isHoriz(v.dir);
      const x0 = v.x, y0 = v.y, x1 = v.x + (h ? v.len : 1), y1 = v.y + (h ? 1 : v.len);
      const dx = Math.max(x0 - fx, 0, fx - x1), dy = Math.max(y0 - fy, 0, fy - y1);
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = { kind: 'vehicle', obj: v }; }
    }
    for (const p of this.pets) {
      if (p.state !== 'idle') continue;
      const d = Math.hypot(fx - (p.x + 0.5), fy - (p.y + 0.5)) - 0.5;
      if (d < bestD) { bestD = d; best = { kind: 'pet', obj: p }; }
    }
    return best;
  }

  _onPointer(e) {
    e.preventDefault();
    this.hooks.onFirstInput?.();
    if (!this.level || this.won) return;
    const r = this.canvas.getBoundingClientRect();
    this.tapAt(e.clientX - r.left, e.clientY - r.top);
  }

  tapAt(px, py) {
    const hit = this._hit(px, py);
    this.idle = 0;
    this.hint = null;
    if (!hit) {
      this.fx.stars(px, py, this.cell * 0.6, 5);
      return;
    }
    this.taps++;
    if (hit.kind === 'vehicle') this.tapVehicle(hit.obj);
    else this.tapPet(hit.obj);
  }

  tapVehicle(v) {
    if (v.state !== 'idle') return;
    const sfx = this.hooks.sfx;
    const ray = rayCells(v, this.level.w, this.level.h);
    let dist = -1, blocker = null;
    for (let i = 0; i < ray.length; i++) {
      const b = this.blockerAt(ray[i][0], ray[i][1], v);
      if (b) { dist = i; blocker = b; break; }
    }
    v.squish = 1;
    this.hooks.haptic?.(12);
    if (!blocker) {
      v.state = 'exit';
      v.vel = 1.5;
      v.mood = 'happy';
      v.z = ++this._z;
      v.siren = true;
      this.exited++;
      sfx.vroom(v.len === 3);
      if (Math.random() < 0.55 || v.kind !== 'car') sfx.honk(KINDS[v.kind]?.sound === 'honk' ? 'car' : KINDS[v.kind]?.sound);
      sfx.exit(this.exited - 1);
      this.hooks.onExit?.(this.exited, this.total, v);
    } else {
      v.state = 'bump';
      v.phase = 'fwd';
      v.bumpTo = dist + (dist === 0 ? 0.14 : 0.12);
      v.blocker = blocker;
      v.vel = 0;
      this.bumps++;
    }
  }

  tapPet(p) {
    p.state = 'leave';
    p.t = 0;
    const L = this.level;
    // hop toward the nearest edge
    const opts = [[0, -1, p.y], [1, 0, L.w - 1 - p.x], [0, 1, L.h - 1 - p.y], [-1, 0, p.x]];
    opts.sort((a, b) => a[2] - b[2]);
    p.dx = opts[0][0];
    p.dy = opts[0][1];
    this.hooks.sfx.animal(p.type);
    this.hooks.haptic?.(12);
    const s = this.cell;
    this.fx.hearts(this.ox + (p.x + 0.5) * s, this.oy + (p.y + 0.3) * s, s, 5);
  }

  // ------------------------------------------------------------ update ---

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.time += dt;
    const speed = this.settings.speed || 1;
    const s = this.cell;
    let busy = false;
    for (const v of this.vehicles) {
      v.squish = Math.max(0, v.squish - dt * 5);
      v.wiggle = Math.max(0, v.wiggle - dt * 2.5);
      v.blinkT -= dt;
      if (v.blinkT < 0) { v.blink = !v.blink; v.blinkT = v.blink ? 0.12 : 2 + Math.random() * 4; }
      if (v.moodT > 0) { v.moodT -= dt; if (v.moodT <= 0 && v.state !== 'exit') v.mood = 'idle'; }
      if (v.state === 'exit') {
        busy = true;
        v.vel = Math.min(22, v.vel + dt * 34 * speed);
        v.off += v.vel * dt * speed;
        if (Math.random() < dt * 14) {
          const [bx, by] = this._rearPx(v);
          this.fx.puff(bx, by, s * 0.7, 1);
        }
        const [cx, cy] = this._centerPx(v);
        const m = v.len * s;
        if (cx < -m || cy < -m || cx > this.cw + m || cy > this.ch + m) v.state = 'gone';
      } else if (v.state === 'bump') {
        busy = true;
        if (v.phase === 'fwd') {
          v.vel = Math.min(16, v.vel + dt * 60 * speed);
          v.off += v.vel * dt;
          if (v.off >= v.bumpTo) {
            v.off = v.bumpTo;
            v.phase = 'back';
            v.backT = 0;
            v.backFrom = v.off;
            v.mood = 'oops';
            v.moodT = 0.8;
            const b = v.blocker;
            if (b.kind === 'vehicle') { b.obj.wiggle = 1; b.obj.mood = 'oops'; b.obj.moodT = 0.7; }
            if (b.kind === 'pet') { b.obj.phase += 1; }
            this.hooks.sfx.bump();
            this.hooks.haptic?.([20, 30, 20]);
            if (!this.settings.reduceMotion) this.shake = 0.15;
            const [fx2, fy2] = this._frontPx(v);
            this.fx.stars(fx2, fy2, s * 0.5, 6, '#fff3b0');
          }
        } else {
          v.backT += dt * 3.2;
          v.off = v.backFrom * (1 - easeOut(Math.min(1, v.backT)));
          if (v.backT >= 1) { v.off = 0; v.state = 'idle'; }
        }
      }
    }
    for (const p of this.pets) {
      p.t += dt;
      if (p.state === 'leave') {
        busy = true;
        if (p.t > 1.6) p.state = 'gone';
      }
    }
    this.fx.update(dt);
    if (this.shake > 0) this.shake -= dt;

    // Snow drift
    for (const f of this.snow) {
      f.y += f.s * dt;
      f.x += Math.sin(this.time + f.d) * 10 * dt;
      if (f.y > this.ch + 5) { f.y = -5; f.x = Math.random() * this.cw; }
    }

    // Hints
    if (!this.won) {
      if (!busy) this.idle += dt;
      const tutorial = this.levelN <= 2;
      const delay = tutorial ? 1.2 : this.settings.hints;
      if (delay > 0 && this.idle > delay && !this.hint) this.hint = this.findHint();
      const left = this.vehicles.some((v) => this._present(v)) || this.pets.some((p) => p.state === 'idle');
      if (!left && !busy) {
        this.won = true;
        this.hint = null;
        this.hooks.onWin?.({ bumps: this.bumps, taps: this.taps, total: this.total });
      }
    }
  }

  // ------------------------------------------------------------ geometry ---

  _centerPx(v) {
    const s = this.cell;
    const h = isHoriz(v.dir);
    const cx = this.ox + (v.x + (h ? v.len / 2 : 0.5)) * s + DX[v.dir] * v.off * s;
    const cy = this.oy + (v.y + (h ? 0.5 : v.len / 2)) * s + DY[v.dir] * v.off * s;
    return [cx, cy];
  }

  _frontPx(v) {
    const [cx, cy] = this._centerPx(v);
    const d = (v.len * this.cell) / 2;
    return [cx + DX[v.dir] * d, cy + DY[v.dir] * d];
  }

  _rearPx(v) {
    const [cx, cy] = this._centerPx(v);
    const d = (v.len * this.cell) / 2;
    return [cx - DX[v.dir] * d, cy - DY[v.dir] * d];
  }

  // ------------------------------------------------------------ render ---

  render() {
    const { ctx, dpr } = this;
    if (!this.bg) return;
    const s = this.cell;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    ctx.drawImage(this.bg, 0, 0, this.cw, this.ch);
    const t = this.time;

    // Hint glow under the target
    if (this.hint) {
      const pulse = (Math.sin(t * 5) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.35 + pulse * 0.35;
      ctx.fillStyle = '#fff6a8';
      const h = this.hint;
      if (h.kind === 'vehicle') {
        const v = h.obj;
        const hz = isHoriz(v.dir);
        rr(ctx, this.ox + v.x * s - 4, this.oy + v.y * s - 4, (hz ? v.len : 1) * s + 8, (hz ? 1 : v.len) * s + 8, s * 0.3);
      } else {
        ctx.beginPath();
        ctx.arc(this.ox + (h.obj.x + 0.5) * s, this.oy + (h.obj.y + 0.5) * s, s * 0.55, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    for (const o of this.obstacles) {
      ctx.save();
      ctx.translate(this.ox + (o.x + 0.5) * s, this.oy + (o.y + 0.5) * s);
      drawObstacle(ctx, o.type, s, t);
      ctx.restore();
    }

    for (const p of this.pets) {
      if (p.state === 'gone') continue;
      ctx.save();
      let x = this.ox + (p.x + 0.5) * s, y = this.oy + (p.y + 0.5) * s;
      let sc = 1;
      let mood = 'idle';
      if (p.state === 'leave') {
        const k = p.t / 1.6;
        x += p.dx * k * s * 4;
        y += p.dy * k * s * 4 - Math.abs(Math.sin(k * Math.PI * 4)) * s * 0.5;
        sc = 1 + 0.15 * Math.sin(k * Math.PI);
        mood = 'happy';
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) * 2.5);
      }
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      drawPet(ctx, p.type, s, t + p.phase, mood);
      ctx.restore();
    }

    const night = this.level.theme === 'night';
    const list = this.vehicles.filter((v) => v.state !== 'gone').sort((a, b) => (a.state === 'exit') - (b.state === 'exit') || (a.z || 0) - (b.z || 0));
    if (night) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const v of list) {
        const [fx, fy] = this._frontPx(v);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((v.dir * Math.PI) / 2);
        const g = ctx.createLinearGradient(0, 0, 0, -s * 1.3);
        g.addColorStop(0, 'rgba(255,240,170,0.35)');
        g.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, 0); ctx.lineTo(s * 0.3, 0); ctx.lineTo(s * 0.55, -s * 1.3); ctx.lineTo(-s * 0.55, -s * 1.3);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    for (const v of list) {
      const [cx, cy] = this._centerPx(v);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((v.dir * Math.PI) / 2 + Math.sin(t * 40) * 0.07 * v.wiggle);
      const sq = Math.sin(v.squish * Math.PI) * 0.08;
      ctx.scale(1 + sq * 0.5, 1 - sq);
      drawVehicle(ctx, v, s, { mood: v.mood, blink: v.blink, t: t + v.id, siren: v.siren || v.kind === 'police' });
      ctx.restore();
    }

    if (this.snow.length && this.level.theme === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const f of this.snow) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
    }

    this.fx.draw(ctx);

    if (this.hint) {
      const h = this.hint;
      let x, y;
      if (h.kind === 'vehicle') [x, y] = this._centerPx(h.obj);
      else { x = this.ox + (h.obj.x + 0.5) * s; y = this.oy + (h.obj.y + 0.5) * s; }
      drawHand(ctx, x, y, s * 1.1, t);
    }
    ctx.restore();
  }

  celebrate() {
    const n = this.settings.reduceMotion ? 40 : 150;
    this.fx.confetti(this.cw, this.ch, n);
    if (!this.settings.reduceMotion) this.fx.burst(this.cw / 2, this.ch / 2, 60);
  }
}

export { shade };
