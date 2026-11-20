// 3D board: rendering (three.js), input, driving / bump animation, hints, win detection.
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { DX, DY, isHoriz, vehicleCells, rayCells, rotateLevel, makeRng, barrierSet, exitBarred } from './generator.js';
import { buildObstacle, buildPet, buildDeco, buildBarrier, buildPerson, mergeStatic, rbox } from './models.js';
import { vehicleModel } from './realistic.js';
import { FX } from './fx.js';
import { drawHand } from './draw.js';
import { KINDS } from './vehicles.js';

const THEMES = {
  sunny: { sky: 0xbfe4ff, ground: 0x8fcf6a, lot: '#5b6273', line: 'rgba(255,255,255,0.85)', curb: 0xe8ebf0, hemi: [0xeaf6ff, 0x6fae5a, 1.0], sun: [0xfff1d6, 2.2], deco: ['tree', 'house', 'flowers', 'tree', 'flowers'] },
  trucks: { sky: 0xffe0b0, ground: 0xe3bf7d, lot: '#555a68', line: 'rgba(255,214,70,0.9)', curb: 0xe0d6c4, hemi: [0xfff3df, 0xb08a50, 1.0], sun: [0xffe2b0, 2.4], deco: ['cactus', 'rock', 'rock', 'cactus', 'house'] },
  forest: { sky: 0xc9ead0, ground: 0x5aa45c, lot: '#59626b', line: 'rgba(255,255,255,0.8)', curb: 0xd2d8cc, hemi: [0xe6f7e8, 0x3f7a40, 1.0], sun: [0xfff4dc, 2.0], deco: ['pine', 'tree', 'pine', 'pine', 'flowers'] },
  farm: { sky: 0xd6efff, ground: 0x9bd16a, lot: '#a07e58', line: 'rgba(255,244,214,0.9)', curb: 0x8a6440, hemi: [0xf0f8ff, 0x7aa850, 1.0], sun: [0xfff0d0, 2.2], deco: ['fence', 'tree', 'barn', 'flowers', 'fence'] },
  snow: { sky: 0xdfe9f6, ground: 0xf1f5fb, lot: '#748199', line: 'rgba(255,255,255,0.9)', curb: 0xffffff, hemi: [0xeef4ff, 0xc0cde0, 0.9], sun: [0xf0f4ff, 1.9], deco: ['snowpine', 'snowpine', 'snowpile', 'snowpine', 'house'] },
  night: { sky: 0x10162e, ground: 0x253050, lot: '#353b56', line: 'rgba(255,215,122,0.8)', curb: 0x59628e, hemi: [0x5a6aa8, 0x101830, 0.55], sun: [0x9fb4ff, 0.7], deco: ['building', 'building', 'lamp', 'building'], night: true },
};

const ROAD_NEAR = 0.85; // lot edge -> road centre on plain levels
const ROAD_FAR = 1.4; // ...and on levels with a footpath (barriers, people, traffic)
const LANE = 0.24; // lane centre offset from the road centre
const WALK = 0.68; // footpath walking line, from the lot edge
const BAR = 0.36; // barrier line, from the lot edge
// Flat ground layers are painted in this order with depth writes off, so overlapping
// planes (crossing roads, sidewalks, lane dashes, the lot) never z-fight at any distance.
const LAYER = { ground: -10, sidewalk: -9, road: -8, dash: -7, lot: -6 };
function layer(mesh, order) {
  mesh.renderOrder = order;
  mesh.material.depthWrite = false;
  return mesh;
} // lot edge -> road centre
const ROAD_W = 1.0;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const bounce = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const groundTex = new Map();
function groundTexture(color, grassy, amp = 0.16) {
  const key = color + '|' + grassy + '|' + amp;
  if (groundTex.has(key)) return groundTex.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const base = new THREE.Color(color);
  x.fillStyle = '#' + base.getHexString();
  x.fillRect(0, 0, 256, 256);
  const rand = makeRng(color);
  for (let i = 0; i < 2600; i++) {
    const k = (rand() - 0.5) * amp;
    const col = base.clone().offsetHSL(0, 0, k);
    x.fillStyle = '#' + col.getHexString();
    const px = rand() * 256, py = rand() * 256;
    if (grassy && rand() < 0.6) { x.fillRect(px, py, 1.5, 4 + rand() * 4); }
    else { x.beginPath(); x.arc(px, py, 1 + rand() * 2.5, 0, 7); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(36, 36);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.cached = true;
  groundTex.set(key, t);
  return t;
}
const yawOf = (dir) => (-dir * Math.PI) / 2;

export class Game {
  constructor(canvas, overlay, hooks) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.hooks = hooks;
    this.fx = new FX();
    this.time = 0;
    this.running = false;
    this.mode = 'play';
    this.level = null;

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const small = Math.min(screen.width, screen.height) < 500;
    this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.world = new THREE.Group();
    this.board = new THREE.Group();
    this.scene.add(this.world, this.board);
    this.ray = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._last = 0;
    this._loop = this._loop.bind(this);
    canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas.parentElement);
  }

  get settings() { return this.hooks.settings(); }

  // ------------------------------------------------------------ setup ---

  load(level, mode = 'play') {
    this.mode = mode;
    this.level = { ...level, world: undefined };
    this.levelN = level.n;
    this.vehicles = level.vehicles.map((v) => ({ ...v, state: 'idle', off: 0, vel: 0, s: 0, squish: 0, wiggle: 0, hop: 0 }));
    this.pets = level.pets.map((p) => ({ ...p, state: 'idle', t: 0, phase: Math.random() * 6, intro: 1 }));
    this.obstacles = level.obstacles.map((o) => ({ ...o }));
    this.barriers = (level.barriers || []).map((b) => ({ ...b }));
    this.barred = barrierSet({ barriers: this.barriers });
    this.walkerCount = level.walkers || 0;
    this.carCount = level.cars || 0;
    this.hasPath = this.barriers.length > 0 || this.walkerCount > 0 || this.carCount > 0;
    this.ro = this.hasPath ? ROAD_FAR : ROAD_NEAR;
    this.traffic = [];
    this.walkers = [];
    this.total = this.vehicles.length;
    this.exited = 0;
    this.bumps = 0;
    this.moves = 0;
    this.idle = 0;
    this.hint = null;
    this.won = false;
    this.startTime = 0;
    this.fx.clear();
    this.shake = 0;
    this.orbit = 0;
    this._z = 0;
    this.blockT = 0;
    this._forceFrames = 3;
    // vehicles drop into the lot, rippling out from the centre
    const animateIn = mode === 'play' && !this.settings.reduceMotion;
    let maxDelay = 0;
    const cx = level.w / 2, cy = level.h / 2;
    for (const it of [...this.vehicles, ...this.pets]) {
      const d = Math.hypot(it.x + 0.5 - cx, it.y + 0.5 - cy);
      const delay = animateIn ? 0.05 + d * 0.045 : 0;
      it.intro = animateIn ? -delay : 1;
      maxDelay = Math.max(maxDelay, delay);
    }
    this.introLeft = animateIn ? maxDelay + 0.45 : 0;
    if (animateIn) setTimeout(() => this.hooks.sfx.whoosh?.(), 60);
    this._idleFrames = 0;
    this._measure();
    if (this._wantsRotate()) this._rotateLogic();
    this._build();
    this.resize();
    this.start();
  }

  _measure() {
    const p = this.canvas.parentElement;
    this.cw = p.clientWidth || window.innerWidth;
    this.ch = p.clientHeight || window.innerHeight;
  }

  _wantsRotate() {
    const L = this.level;
    const landscape = this.cw > this.ch * 1.08;
    const portrait = this.ch > this.cw * 1.08;
    return (landscape && L.h > L.w) || (portrait && L.w > L.h);
  }

  _rotateLogic() {
    const L = this.level;
    const r = rotateLevel({ ...L, vehicles: this.vehicles, pets: this.pets, obstacles: this.obstacles, barriers: this.barriers });
    this.level = { ...L, w: r.w, h: r.h };
    this.barriers = r.barriers.map((b) => ({ ...b, mesh: undefined }));
    this.barred = barrierSet({ barriers: this.barriers });
    const byId = new Map(r.vehicles.map((v) => [v.id, v]));
    for (const v of this.vehicles) {
      const nv = byId.get(v.id);
      if (v.state === 'exit') v.state = 'gone';
      if (v.state === 'bump') v.state = 'idle';
      Object.assign(v, { x: nv.x, y: nv.y, dir: nv.dir, off: 0, vel: 0 });
    }
    const pById = new Map(r.pets.map((p) => [p.id, p]));
    for (const p of this.pets) { if (p.state !== 'idle') p.state = 'gone'; Object.assign(p, { x: pById.get(p.id).x, y: pById.get(p.id).y }); }
    this.obstacles = r.obstacles;
    this.hint = null;
  }

  /** Remove everything from a group and free the GPU memory that isn't shared/cached. */
  _clear(group) {
    group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.cached) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (m.userData.cached) continue;
        if (m.map && !m.map.userData.cached) m.map.dispose();
        m.dispose();
      }
    });
    for (let i = group.children.length - 1; i >= 0; i--) group.remove(group.children[i]);
  }

  _build() {
    const L = this.level;
    const th = THEMES[L.theme] || THEMES.sunny;
    this.theme = th;
    this._clear(this.world);
    this._clear(this.board);
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.sky, 22, 60);
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this.hemi.intensity = th.hemi[2] * 0.55;
    this.sun.color.set(th.sun[0]);
    this.sun.intensity = th.sun[1] * 0.8;

    const hw = L.w / 2, hh = L.h / 2;
    const ro = this.ro;
    const rand = makeRng((this.levelN || 1) * 97 + 3);

    // ground
    const grassy = ['sunny', 'forest', 'farm'].includes(L.theme);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ map: groundTexture(th.ground, grassy, th.night ? 0.035 : L.theme === 'snow' ? 0.06 : 0.16), roughness: 1, envMapIntensity: 0.25 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    layer(ground, LAYER.ground);
    this.world.add(ground);

    // roads (two horizontal, two vertical) with lane dashes
    const roadMat = new THREE.MeshStandardMaterial({ color: th.night ? 0x2b2f3d : 0x4a4f5c, roughness: 0.92, envMapIntensity: 0.25 });
    const sideMat = new THREE.MeshStandardMaterial({ color: th.curb, roughness: 0.8, envMapIntensity: 0.3 });
    const dashMat = new THREE.MeshStandardMaterial({ color: th.night ? 0xffd77a : 0xffffff, roughness: 0.75, envMapIntensity: 0.4 });
    const dashes = [];
    const addRoad = (horiz, c, y) => {
      const g = new THREE.PlaneGeometry(horiz ? 140 : ROAD_W, horiz ? ROAD_W : 140);
      const m = new THREE.Mesh(g, roadMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(horiz ? 0 : c, y, horiz ? c : 0);
      m.receiveShadow = true;
      layer(m, LAYER.road);
      this.world.add(m);
      for (let t = -40; t < 40; t += 0.8) {
        const nearCross = horiz ? Math.abs(Math.abs(t) - (hw + ro)) < 0.8 : Math.abs(Math.abs(t) - (hh + ro)) < 0.8;
        if (!nearCross) dashes.push(horiz ? [t, c, 0] : [c, t, 1]);
      }
      // outer sidewalk
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? 140 : 0.35, horiz ? 0.35 : 140), sideMat);
        sw.rotation.x = -Math.PI / 2;
        const off = c + s * (ROAD_W / 2 + 0.175);
        sw.position.set(horiz ? 0 : off, y - 0.001, horiz ? off : 0);
        sw.receiveShadow = true;
        layer(sw, LAYER.sidewalk);
        this.world.add(sw);
      }
    };
    addRoad(true, -(hh + ro), 0.004);
    addRoad(true, hh + ro, 0.004);
    addRoad(false, -(hw + ro), 0.006);
    addRoad(false, hw + ro, 0.006);
    const dg = new THREE.BoxGeometry(0.34, 0.004, 0.05);
    const im = new THREE.InstancedMesh(dg, dashMat, dashes.length);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    dashes.forEach(([x, z, rot], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot ? Math.PI / 2 : 0);
      mtx.compose(new THREE.Vector3(x, 0.01, z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, mtx);
    });
    layer(im, LAYER.dash);
    this.world.add(im);

    // lot surface with painted bays
    const lotTex = this._lotTexture(L, th);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(L.w + 0.24, L.h + 0.24), new THREE.MeshStandardMaterial({ map: lotTex, roughness: 0.9, envMapIntensity: 0.25 }));
    lot.rotation.x = -Math.PI / 2;
    lot.position.y = 0.012;
    lot.receiveShadow = true;
    layer(lot, LAYER.lot);
    this.world.add(lot);
    // curb around the lot
    const curbM = new THREE.MeshStandardMaterial({ color: th.curb, roughness: 0.7, envMapIntensity: 0.3 });
    const cw = 0.12;
    for (const [w2, d2, x, z] of [[L.w + 0.48, cw, 0, -hh - 0.18], [L.w + 0.48, cw, 0, hh + 0.18], [cw, L.h + 0.24, -hw - 0.18, 0], [cw, L.h + 0.24, hw + 0.18, 0]]) {
      const c = new THREE.Mesh(rbox(w2, 0.07, d2, 0.02, 2), curbM);
      c.position.set(x, 0.035, z);
      c.receiveShadow = true;
      this.world.add(c);
    }

    // paved footpath between the lot and the road (levels with barriers, people or traffic)
    if (this.hasPath) {
      const inner = 0.24, outer = ro - ROAD_W / 2;
      const pw = outer - inner;
      const pathMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.curb).lerp(new THREE.Color(th.ground), 0.15), roughness: 0.85, envMapIntensity: 0.3 });
      for (const [w2, d2, x, z] of [
        [L.w + 2 * outer, pw, 0, -hh - inner - pw / 2], [L.w + 2 * outer, pw, 0, hh + inner + pw / 2],
        [pw, L.h + 2 * inner, -hw - inner - pw / 2, 0], [pw, L.h + 2 * inner, hw + inner + pw / 2, 0],
      ]) {
        const fp = new THREE.Mesh(new THREE.PlaneGeometry(w2, d2), pathMat);
        fp.rotation.x = -Math.PI / 2;
        fp.position.set(x, 0, z);
        fp.receiveShadow = true;
        layer(fp, LAYER.sidewalk);
        this.world.add(fp);
      }
    }
    // closed exits
    const brand = makeRng((this.levelN || 1) * 71 + 5);
    for (const b of this.barriers) {
      const m = buildBarrier(b.type, brand);
      const [x, z, ry] = this._barrierPos(b);
      m.scale.set(1, 1.45, 1.3);
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      this.board.add(m);
      b.mesh = m;
    }

    // scenery outside the roads
    const clearX = hw + ro + ROAD_W / 2 + 0.55;
    const clearZ = hh + ro + ROAD_W / 2 + 0.55;
    const R = Math.max(L.w, L.h) + 9;
    let placed = 0;
    const spots = [];
    const decoRoot = new THREE.Group();
    for (let i = 0; i < 400 && placed < 70; i++) {
      const x = (rand() * 2 - 1) * R, z = (rand() * 2 - 1) * R;
      const ax = Math.abs(x), az = Math.abs(z);
      if (ax < clearX && az < clearZ) continue;
      // keep off the roads
      if (Math.abs(ax - (hw + ro)) < ROAD_W / 2 + 0.55 || Math.abs(az - (hh + ro)) < ROAD_W / 2 + 0.55) continue;
      const type = th.deco[Math.floor(rand() * th.deco.length)];
      const big = type === 'house' || type === 'building' || type === 'barn';
      const need = big ? 1.6 : 0.7;
      if (big && (ax < clearX + 0.8 && az < clearZ + 0.8)) continue;
      if (spots.some(([sx, sz, sr]) => Math.hypot(sx - x, sz - z) < sr + need)) continue;
      spots.push([x, z, need]);
      const d = buildDeco(type, rand);
      d.position.set(x, 0, z);
      if (big) {
        // face the nearest road
        d.rotation.y = ax - clearX > az - clearZ ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : (z > 0 ? Math.PI : 0);
      } else d.rotation.y = rand() * Math.PI * 2;
      decoRoot.add(d);
      placed++;
    }
    if (th.night) {
      // street lamps along the roads + a few real lights
      for (const [x, z, ry] of [[-hw - ro - 0.75, -hh * 0.5, Math.PI / 2], [hw + ro + 0.75, hh * 0.5, -Math.PI / 2], [-hw * 0.5, hh + ro + 0.75, Math.PI], [hw * 0.5, -hh - ro - 0.75, 0]]) {
        const l = buildDeco('lamp', rand);
        l.position.set(x, 0, z);
        l.rotation.y = ry;
        decoRoot.add(l);
      }
      for (const [x, z] of [[-hw * 0.6, -hh * 0.6], [hw * 0.6, hh * 0.6], [hw * 0.6, -hh * 0.6], [-hw * 0.6, hh * 0.6]]) {
        const pl = new THREE.PointLight(0xffd99a, 6, Math.max(L.w, L.h) * 0.9, 1.6);
        pl.position.set(x, 2.2, z);
        this.world.add(pl);
      }
    }

    this.world.add(mergeStatic(decoRoot));

    // obstacles
    for (const o of this.obstacles) {
      const m = buildObstacle(o.type);
      m.position.set(o.x + 0.5 - hw, 0.012, o.y + 0.5 - hh);
      m.rotation.y = ((o.x * 7 + o.y * 3) % 4) * 0.4;
      this.board.add(m);
      o.mesh = m;
    }
    // pets
    for (const p of this.pets) {
      if (p.state === 'gone') continue;
      const m = buildPet(p.type);
      m.scale.setScalar(1.35);
      m.position.set(p.x + 0.5 - hw, 0.012, p.y + 0.5 - hh);
      m.userData.pid = p.id;
      this.board.add(m);
      p.mesh = m;
    }
    // vehicles
    const faces = !!this.settings.faces;
    const realistic = !!this.settings.realistic;
    this.glowTex = this.glowTex || this._glowTexture();
    for (const v of this.vehicles) {
      if (v.state === 'gone') continue;
      const m = vehicleModel(v, { faces, realistic });
      m.userData.vid = v.id;
      if (th.night) {
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(0, 0.03, -(v.len - 0.14) / 2 - 0.8);
        m.add(beam);
      }
      this.board.add(m);
      v.mesh = m;
      this._placeVehicle(v);
    }

    // hint ring
    this.hintMesh = new THREE.Mesh(rbox(1, 0.02, 1, 0.009, 2), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.6, depthWrite: false }));
    this.hintMesh.visible = false;
    this.board.add(this.hintMesh);
    this.blockMesh = new THREE.Mesh(rbox(1, 0.02, 1, 0.009, 2), new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false }));
    this.blockMesh.visible = false;
    this.board.add(this.blockMesh);

    // traffic on the roads and people on the footpath
    this.traffic = [];
    this.walkers = [];
    const tcount = this.mode === 'show' ? 6 : this.carCount;
    if (tcount) this._spawnTraffic(tcount, rand, faces, realistic);
    for (let i = 0; i < this.walkerCount; i++) {
      const m = buildPerson(rand);
      m.scale.setScalar(1.45);
      this.world.add(m);
      const A = hw + WALK, B = hh + WALK;
      this.walkers.push({ m, s: (i / Math.max(1, this.walkerCount)) * (4 * A + 4 * B) + rand() * 2, dir: rand() < 0.5 ? 1 : -1, speed: 0.5 + rand() * 0.2, phase: rand() * 6, jolt: 0 });
    }

    // snow
    this.snow = null;
    if (L.theme === 'snow') {
      const n = 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 8; pos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
      this.world.add(this.snow);
    }

    // sun + shadow framing
    const ext = Math.max(L.w, L.h) / 2 + 2.5;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = 40;
    sc.updateProjectionMatrix();
    this.sun.position.set(-ext * 0.7, 12, ext * 0.9);
    this.sun.target.position.set(0, 0, 0);
  }

  /** World position + facing for one closed exit cell (barrier front faces the lot). */
  _barrierPos(b) {
    const L = this.level;
    const hw = L.w / 2, hh = L.h / 2;
    if (b.side === 0) return [b.i + 0.5 - hw, -hh - BAR, 0];
    if (b.side === 2) return [b.i + 0.5 - hw, hh + BAR, Math.PI];
    if (b.side === 1) return [hw + BAR, b.i + 0.5 - hh, -Math.PI / 2];
    return [-hw - BAR, b.i + 0.5 - hh, Math.PI / 2];
  }

  /** Lanes: the near lane of each road runs clockwise around the lot (where leaving cars merge). */
  _lane(side, near = true) {
    const L = this.level;
    const hw = L.w / 2, hh = L.h / 2, ro = this.ro;
    const n = near ? 1 : -1;
    if (side === 0) return { axis: 'x', c: -(hh + ro) + LANE * n, dir: near ? 1 : 3 };
    if (side === 1) return { axis: 'z', c: hw + ro - LANE * n, dir: near ? 2 : 0 };
    if (side === 2) return { axis: 'x', c: hh + ro - LANE * n, dir: near ? 3 : 1 };
    return { axis: 'z', c: -(hw + ro) + LANE * n, dir: near ? 0 : 2 };
  }

  _spawnTraffic(count, rand, faces, realistic) {
    const pool = this.vehicles.filter((v) => v.kind).map((v) => v.kind);
    const kinds = pool.length > 3 ? pool : ['car', 'car', 'truck', ...pool];
    const colors = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ccf6e', '#2ec4b6', '#3a86ff', '#9b5de5', '#f15bb5'];
    const L = this.level;
    this.trafficSpan = Math.max(L.w, L.h) / 2 + this.ro + 14;
    for (let i = 0; i < count; i++) {
      const side = i % 4;
      const near = this.mode === 'play' ? rand() < 0.8 : rand() < 0.5;
      const ln = this._lane(side, near);
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const len = ['truck', 'bus', 'firetruck', 'icecream', 'garbage', 'mixer'].includes(kind) ? 3 : 2;
      const m = vehicleModel({ kind, len, color: colors[Math.floor(rand() * colors.length)], id: i + 40 }, { faces, realistic });
      m.rotation.y = yawOf(ln.dir);
      this.world.add(m);
      const base = this.mode === 'play' ? 1.3 + rand() * 0.7 : 1.6 + rand() * 1.2;
      this.traffic.push({ m, ...ln, side, near, len, pos: -this.trafficSpan * 0.6 + rand() * this.trafficSpan * 1.2, base, speed: base });
    }
  }

  _laneSign(dir) { return dir === 1 || dir === 2 ? 1 : -1; }

  _walkerAt(w) {
    const L = this.level;
    const A = L.w / 2 + WALK, B = L.h / 2 + WALK;
    const P = 4 * A + 4 * B;
    let s2 = ((w.s % P) + P) % P;
    if (s2 < 2 * A) return [-A + s2, -B, w.dir > 0 ? 1 : 3];
    s2 -= 2 * A;
    if (s2 < 2 * B) return [A, -B + s2, w.dir > 0 ? 2 : 0];
    s2 -= 2 * B;
    if (s2 < 2 * A) return [A - s2, B, w.dir > 0 ? 3 : 1];
    s2 -= 2 * A;
    return [-A, B - s2, w.dir > 0 ? 0 : 2];
  }

  /** Is someone or something passing the exit this vehicle would use, right now? */
  timingBlock(v) {
    if (!this.walkers.length && !this.traffic.length) return null;
    const L = this.level;
    const hw = L.w / 2, hh = L.h / 2;
    const ex = v.dir === 1 ? hw + WALK : v.dir === 3 ? -hw - WALK : v.x + 0.5 - hw;
    const ez = v.dir === 0 ? -hh - WALK : v.dir === 2 ? hh + WALK : v.y + 0.5 - hh;
    for (const w of this.walkers) {
      const p = w.m.position;
      if (Math.hypot(p.x - ex, p.z - ez) < 0.85) return { kind: 'walker', obj: w };
    }
    const lane = this._lane(v.dir, true);
    const sign = this._laneSign(lane.dir);
    const coord = lane.axis === 'x' ? ex : ez;
    const pm = sign * coord + 0.4;
    for (const tr of this.traffic) {
      if (tr.axis !== lane.axis || Math.abs(tr.c - lane.c) > 0.01 || tr.dir !== lane.dir) continue;
      const rel = pm - tr.pos;
      if (rel > -1.0 - tr.len / 2 && rel < 2.6) return { kind: 'traffic', obj: tr };
    }
    return null;
  }

  _lotTexture(L, th) {
    const px = 96;
    const c = document.createElement('canvas');
    c.width = Math.round((L.w + 0.24) * px);
    c.height = Math.round((L.h + 0.24) * px);
    const x = c.getContext('2d');
    x.fillStyle = th.lot;
    x.fillRect(0, 0, c.width, c.height);
    const rand = makeRng(L.w * 31 + L.h);
    for (let i = 0; i < c.width * c.height * 0.02; i++) {
      x.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      x.fillRect(rand() * c.width, rand() * c.height, 2, 2);
    }
    const o = 0.12 * px;
    x.strokeStyle = th.line;
    x.lineWidth = px * 0.035;
    x.lineCap = 'round';
    // painted bay marks: short ticks at every cell corner + a frame
    for (let gx = 0; gx <= L.w; gx++) {
      for (let gy = 0; gy <= L.h; gy++) {
        const cx = o + gx * px, cy = o + gy * px;
        const t = px * 0.14;
        x.beginPath();
        x.moveTo(cx - t, cy); x.lineTo(cx + t, cy);
        x.moveTo(cx, cy - t); x.lineTo(cx, cy + t);
        x.stroke();
      }
    }
    x.globalAlpha = 0.35;
    x.setLineDash([px * 0.16, px * 0.16]);
    x.lineWidth = px * 0.02;
    for (let gx = 1; gx < L.w; gx++) { x.beginPath(); x.moveTo(o + gx * px, o + px * 0.2); x.lineTo(o + gx * px, o + L.h * px - px * 0.2); x.stroke(); }
    for (let gy = 1; gy < L.h; gy++) { x.beginPath(); x.moveTo(o + px * 0.2, o + gy * px); x.lineTo(o + L.w * px - px * 0.2, o + gy * px); x.stroke(); }
    x.globalAlpha = 1;
    x.setLineDash([]);
    // red/white "no exit" hatching painted along every closed exit
    for (const b of this.barriers || []) {
      let rx, ry, rw, rh;
      if (b.side === 0) [rx, ry, rw, rh] = [o + b.i * px, 0, px, o];
      else if (b.side === 2) [rx, ry, rw, rh] = [o + b.i * px, o + L.h * px, px, o];
      else if (b.side === 1) [rx, ry, rw, rh] = [o + L.w * px, o + b.i * px, o, px];
      else [rx, ry, rw, rh] = [0, o + b.i * px, o, px];
      x.save();
      x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
      x.fillStyle = '#ffffff'; x.fillRect(rx, ry, rw, rh);
      x.fillStyle = '#e6202f';
      for (let k = -px; k < px * 2; k += px * 0.16) { x.beginPath(); x.moveTo(rx + k, ry); x.lineTo(rx + k + px * 0.08, ry); x.lineTo(rx + k + px * 0.08 + rh, ry + rh); x.lineTo(rx + k + rh, ry + rh); x.fill(); }
      x.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  _glowTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(255,236,170,0.9)');
    g.addColorStop(1, 'rgba(255,236,170,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(20, 128); x.lineTo(44, 128); x.lineTo(64, 0); x.lineTo(0, 0); x.fill();
    const t = new THREE.CanvasTexture(c);
    t.userData.cached = true;
    return t;
  }

  // ------------------------------------------------------------ layout ---

  resize() {
    this._measure();
    const { cw, ch } = this;
    if (!cw || !ch) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, this.qualityCap || 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cw, ch, false);
    this.overlay.width = Math.round(cw * dpr);
    this.overlay.height = Math.round(ch * dpr);
    this.dpr = dpr;
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
    if (!this.level) return;
    if (this.mode === 'play' && this._wantsRotate() && !this.won) {
      this._rotateLogic();
      this._build();
    }
    this._fit();
    this._forceFrames = 2;
  }

  /** Position the camera so the lot fills the space between the HUD and the bottom edge. */
  _fit() {
    const L = this.level;
    const cam = this.camera;
    const el = this.mode === 'show' ? 0.85 : 0.98; // elevation (rad)
    // frame the road too when traffic matters, the footpath when people/barriers do
    const margin = this.mode === 'play' && this.carCount ? this.ro + 0.55 : this.hasPath ? this.ro - 0.42 : 0.3;
    const hw = L.w / 2 + margin, hh = L.h / 2 + margin;
    const pts = [];
    for (const x of [-hw, hw]) for (const z of [-hh, hh]) for (const y of [0, 0.7]) pts.push(new THREE.Vector3(x, y, z));
    const topPx = this.mode === 'show' ? this.hooks.showInsets?.().top ?? 0 : this.hooks.hudHeight?.() ?? 70;
    const botPx = this.mode === 'show' ? this.hooks.showInsets?.().bottom ?? 0 : 12;
    const yMax = 1 - (2 * (topPx + 8)) / this.ch;
    const yMin = -1 + (2 * (botPx + 8)) / this.ch;
    const xLim = 1 - 20 / this.cw;
    const yaw = this.mode === 'show' ? Math.sin(this.orbit) * 0.35 : 0;
    const target = new THREE.Vector3();
    const place = (d, tz) => {
      target.set(0, 0, tz);
      cam.position.set(Math.sin(yaw) * Math.cos(el) * d, Math.sin(el) * d, tz + Math.cos(yaw) * Math.cos(el) * d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
    };
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { const v = p.clone().project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      return { x0, x1, y0, y1 };
    };
    const wantC = (yMax + yMin) / 2;
    // For a distance d, slide the target along z until the board is centred in the free band.
    const centred = (d) => {
      const err = (tz) => { place(d, tz); const b = bounds(); return (b.y0 + b.y1) / 2 - wantC; };
      let a = 0, fa = err(a), b2 = d * 0.2, fb = err(b2);
      for (let i = 0; i < 8 && Math.abs(fb) > 1e-4 && fb !== fa; i++) {
        const c = b2 - (fb * (b2 - a)) / (fb - fa);
        a = b2; fa = fb; b2 = c; fb = err(c);
      }
      place(d, b2);
      return b2;
    };
    let lo = 2, hi = 200, tz = 0;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      centred(mid);
      const b = bounds();
      const fits = b.x0 >= -xLim && b.x1 <= xLim && b.y0 >= yMin && b.y1 <= yMax;
      if (fits) hi = mid; else lo = mid;
    }
    tz = centred(hi);
    void tz;
    this.camDist = cam.position.distanceTo(target);
    this.camTarget = target.clone();
    if (this.scene.fog) { this.scene.fog.near = this.camDist * 1.15; this.scene.fog.far = this.camDist * 2.6; }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() { this.running = false; }

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
    return !exitBarred(v, this.barred) && rayCells(v, this.level.w, this.level.h).every(([x, y]) => !this.blockerAt(x, y, v));
  }

  findHint() {
    const free = this.vehicles.filter((v) => v.state === 'idle' && this.isFree(v));
    const now = free.filter((v) => !this.timingBlock(v));
    if (now.length) return { kind: 'vehicle', obj: now[Math.floor(now.length / 2)] };
    if (free.length) return { kind: 'vehicle', obj: free[Math.floor(free.length / 2)] };
    const pet = this.pets.find((p) => p.state === 'idle');
    return pet ? { kind: 'pet', obj: pet } : null;
  }

  showHint() {
    if (this.won || this.mode !== 'play') return;
    this.hint = this.findHint();
    this.hintedAt = this.time;
  }

  _centerOf(v) {
    const L = this.level;
    const h = isHoriz(v.dir);
    return [v.x + (h ? v.len / 2 : 0.5) - L.w / 2, v.y + (h ? 0.5 : v.len / 2) - L.h / 2];
  }

  _placeVehicle(v) {
    const m = v.mesh;
    if (!m) return;
    if (v.state === 'exit') {
      const p = this._pathAt(v, v.s);
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.yaw;
      return;
    }
    const [cx, cz] = this._centerOf(v);
    m.position.set(cx + DX[v.dir] * v.off, 0, cz + DY[v.dir] * v.off);
    m.rotation.y = yawOf(v.dir);
  }

  _setupPath(v) {
    const L = this.level;
    const [sx, sz] = this._centerOf(v);
    const hw = L.w / 2, hh = L.h / 2;
    const ro = this.ro;
    // drive to the near lane (closer than the road centre), then turn clockwise into it
    const d1 = (v.dir === 0 ? sz + hh + ro : v.dir === 2 ? hh + ro - sz : v.dir === 1 ? hw + ro - sx : sx + hw + ro) - LANE;
    const nd = (v.dir + 1) % 4;
    const R = 0.5;
    let dy = yawOf(nd) - yawOf(v.dir);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    v.path = { sx, sz, f: [DX[v.dir], DY[v.dir]], n: [DX[nd], DY[nd]], d1, R, y0: yawOf(v.dir), dy, a: Math.max(0, d1 - R), arc: (Math.PI * R) / 2, lane: this._lane(v.dir, true) };
  }

  _pathAt(v, s) {
    const P = v.path;
    if (s <= P.a) return { x: P.sx + P.f[0] * s, z: P.sz + P.f[1] * s, yaw: P.y0 };
    if (s <= P.a + P.arc) {
      const a = (s - P.a) / P.R;
      const cx = P.sx + P.f[0] * P.a + P.n[0] * P.R, cz = P.sz + P.f[1] * P.a + P.n[1] * P.R;
      return { x: cx - P.n[0] * P.R * Math.cos(a) + P.f[0] * P.R * Math.sin(a), z: cz - P.n[1] * P.R * Math.cos(a) + P.f[1] * P.R * Math.sin(a), yaw: P.y0 + P.dy * (a / (Math.PI / 2)) };
    }
    const rest = s - P.a - P.arc;
    const ex = P.sx + P.f[0] * (P.a + P.R) + P.n[0] * P.R, ez = P.sz + P.f[1] * (P.a + P.R) + P.n[1] * P.R;
    return { x: ex + P.n[0] * rest, z: ez + P.n[1] * rest, yaw: P.y0 + P.dy };
  }

  // ------------------------------------------------------------ input ---

  _onPointer(e) {
    e.preventDefault();
    this.hooks.onFirstInput?.();
    if (!this.level || this.won || this.mode !== 'play') return;
    const r = this.canvas.getBoundingClientRect();
    this.tapAt(e.clientX - r.left, e.clientY - r.top);
  }

  _hit(px, py) {
    const ndc = new THREE.Vector2((px / this.cw) * 2 - 1, -(py / this.ch) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.ray.intersectObjects(this.board.children, true);
    for (const h of hits) {
      const vr = h.object.userData.vroot;
      if (vr) { const v = this.vehicles.find((x) => x.mesh === vr); if (v && this._present(v)) return { kind: 'vehicle', obj: v }; }
      const pr = h.object.userData.proot;
      if (pr) { const p = this.pets.find((x) => x.mesh === pr); if (p && p.state === 'idle') return { kind: 'pet', obj: p }; }
    }
    // ground fallback with fat-finger tolerance
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.groundPlane, pt)) return null;
    const fx = pt.x + this.level.w / 2, fy = pt.z + this.level.h / 2;
    let best = null, bestD = 0.5;
    for (const v of this.vehicles) {
      if (!this._present(v)) continue;
      const h = isHoriz(v.dir);
      const x0 = v.x, y0 = v.y, x1 = v.x + (h ? v.len : 1), y1 = v.y + (h ? 1 : v.len);
      const d = Math.hypot(Math.max(x0 - fx, 0, fx - x1), Math.max(y0 - fy, 0, fy - y1));
      if (d < bestD) { bestD = d; best = { kind: 'vehicle', obj: v }; }
    }
    for (const p of this.pets) {
      if (p.state !== 'idle') continue;
      const d = Math.hypot(fx - (p.x + 0.5), fy - (p.y + 0.5)) - 0.45;
      if (d < bestD) { bestD = d; best = { kind: 'pet', obj: p }; }
    }
    return best;
  }

  tapAt(px, py) {
    if (this.introLeft > 0.2) return;
    const hit = this._hit(px, py);
    this.idle = 0;
    this.hint = null;
    if (!hit) { this.fx.stars(px, py, 28, 4); return; }
    if (!this.startTime) this.startTime = performance.now();
    if (hit.kind === 'vehicle') this.tapVehicle(hit.obj);
    else this.tapPet(hit.obj);
  }

  tapVehicle(v) {
    if (v.state !== 'idle') return;
    const sfx = this.hooks.sfx;
    this.moves++;
    const ray = rayCells(v, this.level.w, this.level.h);
    let dist = -1, blocker = null;
    for (let i = 0; i < ray.length; i++) {
      const b = this.blockerAt(ray[i][0], ray[i][1], v);
      if (b) { dist = i; blocker = b; break; }
    }
    if (!blocker && exitBarred(v, this.barred)) {
      const [side, i] = v.dir === 0 || v.dir === 2 ? [v.dir, v.x] : [v.dir, v.y];
      blocker = { kind: 'barrier', obj: this.barriers.find((b) => b.side === side && b.i === i) };
      dist = ray.length + 0.12;
    }
    let timing = false;
    if (!blocker) {
      const tb = this.timingBlock(v);
      if (tb) { blocker = tb; dist = 0.06; timing = true; }
    }
    v.squish = 1;
    this.hooks.haptic?.(12);
    if (!blocker) {
      v.state = 'exit';
      v.vel = 2;
      v.s = 0;
      v.z = ++this._z;
      this._setupPath(v);
      this.exited++;
      sfx.vroom(v.len === 3);
      if (Math.random() < 0.35 || v.kind !== 'car') sfx.honk(KINDS[v.kind]?.sound === 'honk' ? 'car' : KINDS[v.kind]?.sound);
      sfx.exit(this.exited - 1);
      this.hooks.onExit?.(this.exited, this.total, v);
    } else {
      v.state = 'bump';
      v.phase = 'fwd';
      v.bumpTo = timing ? dist : dist + (dist === 0 ? 0.12 : 0.1);
      v.blocker = blocker;
      v.vel = 0;
      this.bumps++;
      this.hooks.onBump?.(this.bumps);
    }
  }

  tapPet(p) {
    p.state = 'leave';
    p.t = 0;
    const L = this.level;
    const opts = [[0, -1, p.y], [1, 0, L.w - 1 - p.x], [0, 1, L.h - 1 - p.y], [-1, 0, p.x]].sort((a, b) => a[2] - b[2]);
    p.dx = opts[0][0];
    p.dy = opts[0][1];
    p.mesh.rotation.y = Math.atan2(p.dx, p.dy);
    this.hooks.sfx.animal(p.type);
    this.hooks.haptic?.(12);
    const s = this._screen(p.mesh.position.x, 0.6, p.mesh.position.z);
    this.fx.hearts(s[0], s[1], 40, 5);
  }

  // ------------------------------------------------------------ loop ---

  _loop(now) {
    if (!this.running) return;
    const raw = now - this._last;
    const dt = Math.min(0.05, raw / 1000);
    this._last = now;
    if (!this.level) { requestAnimationFrame(this._loop); return; }
    this.update(dt);
    // Only redraw when something on screen is changing (saves battery while thinking).
    if (this._needsRender()) {
      this.render();
      this._adapt(raw);
      this._idleFrames = 0;
    } else if (++this._idleFrames === 1) this.render();
    requestAnimationFrame(this._loop);
  }

  _needsRender() {
    if (this.mode === 'show' || this._forceFrames > 0) { this._forceFrames--; return true; }
    if (this.hint || this.shake > 0 || this.fx.p.length || this.snow || this.introLeft > 0 || this.blockT > 0) return true;
    if (this.traffic.length || this.walkers.length) return true;
    if (this.pets.some((p) => p.state !== 'gone')) return true;
    return this.vehicles.some((v) => v.state === 'exit' || v.state === 'bump' || v.squish > 0 || v.wiggle > 0 || v.hop > 0)
      || this.obstacles.some((o) => o.wob > 0);
  }

  /** Drop resolution / shadow quality on devices that can't keep up. */
  _adapt(ms) {
    if (ms > 200) return; // tab switch etc.
    this._ft = (this._ft || 16) * 0.95 + ms * 0.05;
    this._ftN = (this._ftN || 0) + 1;
    if (this._ftN < 90 || this._ft < 26) return;
    this._ftN = 0;
    const r = this.renderer;
    const pr = r.getPixelRatio();
    if (pr > 1.01) {
      r.setPixelRatio(Math.max(1, pr - 0.5));
      r.setSize(this.cw, this.ch, false);
      this.qualityCap = r.getPixelRatio();
    } else if (r.shadowMap.type !== THREE.PCFShadowMap) {
      r.shadowMap.type = THREE.PCFShadowMap;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this._ft = 16;
  }

  _screen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [((v.x + 1) / 2) * this.cw, ((1 - v.y) / 2) * this.ch];
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const speed = this.settings.speed || 1;
    let busy = false;
    for (const v of this.vehicles) {
      const m = v.mesh;
      if (!m || v.state === 'gone') continue;
      const ud = m.userData;
      v.squish = Math.max(0, v.squish - dt * 4);
      v.wiggle = Math.max(0, v.wiggle - dt * 2.2);
      let ds = 0;
      if (v.state === 'exit') {
        if (v.s < v.path.d1 + 1.2) busy = true; // once it's out on the road the level can finish
        v.vel = Math.min(11, v.vel + dt * 22 * speed);
        if (this.traffic.length && v.s > v.path.a) {
          // don't drive through slower traffic ahead in the same lane
          const ln = v.path.lane, sign = this._laneSign(ln.dir);
          const mine = sign * (ln.axis === 'x' ? m.position.x : m.position.z);
          for (const tr of this.traffic) {
            if (tr.axis !== ln.axis || Math.abs(tr.c - ln.c) > 0.01 || tr.dir !== ln.dir) continue;
            const gap = tr.pos - mine;
            if (gap > 0 && gap < (v.len + tr.len) / 2 + 0.7) v.vel = Math.min(v.vel, tr.speed / speed);
          }
        }
        ds = v.vel * dt * speed;
        v.s += ds;
        if (Math.random() < dt * 12) {
          const back = m.position.clone().add(new THREE.Vector3(0, 0.2, 0).add(new THREE.Vector3(0, 0, (v.len - 0.14) / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), m.rotation.y)));
          const s = this._screen(back.x, back.y, back.z);
          this.fx.puff(s[0], s[1], 30, 1);
        }
        if (v.s > v.path.d1 + 26) {
          v.state = 'gone';
          this.board.remove(m);
          continue;
        }
      } else if (v.state === 'bump') {
        busy = true;
        if (v.phase === 'fwd') {
          v.vel = Math.min(9, v.vel + dt * 40 * speed);
          ds = v.vel * dt;
          v.off += ds;
          if (v.off >= v.bumpTo) {
            v.off = v.bumpTo;
            v.phase = 'back';
            v.backT = 0;
            v.backFrom = v.off;
            v.hop = 1;
            const b = v.blocker;
            if (b.kind === 'vehicle') b.obj.wiggle = 1;
            if (b.kind === 'pet') b.obj.t = 0, b.obj.jolt = 1;
            if ((b.kind === 'obstacle' || b.kind === 'barrier') && b.obj?.mesh) b.obj.wob = 1;
            if (b.kind === 'walker') { b.obj.jolt = 1; this.hooks.sfx.hey?.(); }
            if (b.kind === 'traffic') this.hooks.sfx.honk('car');
            this._flashBlocker(b);
            this.hooks.sfx.bump();
            this.hooks.haptic?.([20, 30, 20]);
            if (!this.settings.reduceMotion) this.shake = 0.18;
            const fwd = new THREE.Vector3(DX[v.dir], 0, DY[v.dir]).multiplyScalar((v.len - 0.14) / 2 + 0.05);
            const s = this._screen(m.position.x + fwd.x, 0.4, m.position.z + fwd.z);
            this.fx.stars(s[0], s[1], 26, 6, '#fff3b0');
          }
        } else {
          v.backT += dt * 3;
          const prev = v.off;
          v.off = v.backFrom * (1 - easeOut(Math.min(1, v.backT)));
          ds = v.off - prev;
          if (v.backT >= 1) { v.off = 0; v.state = 'idle'; }
        }
      }
      this._placeVehicle(v);
      if (v.intro < 0.5) {
        v.intro += dt;
        m.visible = v.intro >= 0;
        const k = Math.max(0, Math.min(1, v.intro / 0.42));
        m.position.y = (1 - bounce(k)) * 1.6;
      }
      // body motion
      const body = ud.body;
      const sq = Math.sin(v.squish * Math.PI) * 0.07;
      v.hop = Math.max(0, v.hop - dt * 3);
      body.scale.set(1 + sq * 0.5, 1 - sq + Math.sin(v.hop * Math.PI) * 0.05, 1 + sq * 0.3);
      body.rotation.z = Math.sin(t * 38) * 0.07 * v.wiggle;
      body.rotation.x = v.state === 'exit' ? Math.max(-0.06, -0.08 + v.vel * 0.004) : v.phase === 'back' && v.state === 'bump' ? 0.05 * (1 - v.backT) : 0;
      body.position.y = Math.sin(v.hop * Math.PI) * 0.04;
      for (const w of ud.wheels) w.g.rotation.x -= ds / w.r;
      if (ud.sirens.length) {
        const on = v.state === 'exit' ? Math.floor(t * 6) % 2 : -1;
        ud.sirens.forEach((s, i) => { s.material.emissiveIntensity = on === -1 ? 0.3 : (on === i ? 3 : 0.2); });
      }
      if (ud.drum) ud.drum.rotation.y += dt * 2;
    }
    for (const o of [...this.obstacles, ...this.barriers]) {
      if (o.wob > 0 && o.mesh) { o.wob = Math.max(0, o.wob - dt * 2.5); o.mesh.rotation.z = Math.sin(t * 30) * 0.08 * o.wob; }
    }
    this._updateMovers(dt, t);
    for (const p of this.pets) {
      if (!p.mesh || p.state === 'gone') continue;
      p.t += dt;
      const body = p.mesh.userData.body;
      if (p.intro < 0.5) {
        p.intro += dt;
        p.mesh.visible = p.intro >= 0;
        p.mesh.position.y = 0.012 + (1 - bounce(Math.max(0, Math.min(1, p.intro / 0.42)))) * 1.6;
      }
      if (p.state === 'idle') {
        body.position.y = Math.abs(Math.sin(t * 3 + p.phase)) * 0.04;
        body.rotation.y = Math.sin(t * 0.8 + p.phase) * 0.5;
        if (p.jolt) { p.jolt = Math.max(0, p.jolt - dt * 2); body.position.y += Math.sin(p.jolt * Math.PI) * 0.15; }
      } else if (p.state === 'leave') {
        busy = true;
        const k = p.t / 1.4;
        const L = this.level;
        const hops = 4;
        p.mesh.position.x = p.x + 0.5 - L.w / 2 + p.dx * k * 5;
        p.mesh.position.z = p.y + 0.5 - L.h / 2 + p.dy * k * 5;
        body.position.y = Math.abs(Math.sin(k * Math.PI * hops)) * 0.35;
        body.rotation.y = 0;
        if (k >= 1) { p.state = 'gone'; this.board.remove(p.mesh); }
      }
    }
    this.fx.update(dt);
    if (this.shake > 0) this.shake -= dt;
    if (this.introLeft > 0) this.introLeft -= dt;
    if (this.blockT > 0) {
      this.blockT -= dt;
      this.blockMesh.visible = this.blockT > 0;
      this.blockMesh.material.opacity = Math.max(0, this.blockT / 0.7) * 0.75 * (0.6 + 0.4 * Math.sin(t * 30));
    }
    if (this.snow) {
      const a = this.snow.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * (0.6 + (i % 7) * 0.08);
        if (y < 0) y = 8;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t + i) * dt * 0.1);
      }
      a.needsUpdate = true;
    }

    if (this.mode === 'show') {
      this.orbit += dt * 0.12;
      const yaw = Math.sin(this.orbit) * 0.35;
      const el = 0.85;
      const T = this.camTarget || new THREE.Vector3();
      const d = this.camDist || 20;
      this.camera.position.set(T.x + Math.sin(yaw) * Math.cos(el) * d, T.y + Math.sin(el) * d, T.z + Math.cos(yaw) * Math.cos(el) * d);
      this.camera.lookAt(T);
      return;
    }

    // hints + win
    if (!this.won) {
      if (!busy) this.idle += dt;
      const delay = this.levelN <= 2 && !this.level.daily ? 1.5 : this.settings.hints;
      if (delay > 0 && this.idle > delay && !this.hint) this.showHint();
      if (this.hint) {
        const h = this.hint;
        const gone = h.kind === 'vehicle' ? h.obj.state !== 'idle' : h.obj.state !== 'idle';
        if (gone) this.hint = null;
      }
      const left = this.vehicles.some((v) => this._present(v)) || this.pets.some((p) => p.state === 'idle');
      if (!left && !busy) {
        this.won = true;
        this.hint = null;
        const secs = this.startTime ? (performance.now() - this.startTime) / 1000 : 0;
        this.hooks.onWin?.({ bumps: this.bumps, moves: this.moves, total: this.total, seconds: secs });
      }
    }
    // hint ring
    const hm = this.hintMesh;
    if (this.hint && hm) {
      const h = this.hint;
      hm.visible = true;
      if (h.kind === 'vehicle') {
        const v = h.obj;
        const [cx, cz] = this._centerOf(v);
        const horiz = isHoriz(v.dir);
        hm.position.set(cx, 0.02, cz);
        hm.scale.set(horiz ? v.len : 1, 1, horiz ? 1 : v.len);
      } else {
        hm.position.set(h.obj.x + 0.5 - this.level.w / 2, 0.02, h.obj.y + 0.5 - this.level.h / 2);
        hm.scale.set(1, 1, 1);
      }
      hm.material.opacity = 0.35 + 0.35 * (Math.sin(t * 6) + 1) / 2;
    } else if (hm) hm.visible = false;
  }

  render() {
    const cam = this.camera;
    let shook = false;
    const base = cam.position.clone();
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * 0.08; cam.position.z += (Math.random() - 0.5) * 0.08; shook = true; }
    this.renderer.render(this.scene, cam);
    if (shook) cam.position.copy(base);

    const c = this.octx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.cw, this.ch);
    this.fx.draw(c);
    if (this.hint && this.mode === 'play') {
      const h = this.hint;
      const p = h.kind === 'vehicle' ? h.obj.mesh.position : h.obj.mesh.position;
      const s = this._screen(p.x, 0.5, p.z);
      const unit = this._screen(p.x + 1, 0.5, p.z)[0] - s[0];
      drawHand(c, s[0], s[1], Math.max(36, Math.abs(unit) * 1.1), this.time);
    }
  }

  _updateMovers(dt, t) {
    const exiting = this.vehicles.filter((v) => v.state === 'exit' && v.mesh);
    // traffic keeps its distance and brakes for cars pulling out
    for (const tr of this.traffic) {
      const sign = this._laneSign(tr.dir);
      let blocked = false;
      for (const o of this.traffic) {
        if (o === tr || o.axis !== tr.axis || Math.abs(o.c - tr.c) > 0.01 || o.dir !== tr.dir) continue;
        const gap = o.pos - tr.pos;
        if (gap > 0 && gap < (o.len + tr.len) / 2 + 0.6) blocked = true;
      }
      for (const v of exiting) {
        const p = v.mesh.position;
        const along = sign * (tr.axis === 'x' ? p.x : p.z);
        const lateral = Math.abs((tr.axis === 'x' ? p.z : p.x) - tr.c);
        const gap = along - tr.pos;
        if (lateral < 0.55 && gap > 0 && gap < (v.len + tr.len) / 2 + 0.9) blocked = true;
      }
      const target = blocked ? 0 : tr.base;
      tr.speed += (target - tr.speed) * Math.min(1, dt * (blocked ? 8 : 2));
      tr.pos += tr.speed * dt;
      if (tr.pos > this.trafficSpan) tr.pos = -this.trafficSpan;
      const c = sign * tr.pos;
      if (tr.axis === 'x') tr.m.position.set(c, 0, tr.c);
      else tr.m.position.set(tr.c, 0, c);
      for (const w of tr.m.userData.wheels || []) w.g.rotation.x -= (tr.speed * dt) / w.r;
    }
    // people stroll around the footpath and wait for cars crossing it
    for (const w of this.walkers) {
      const p = w.m.position;
      const wait = exiting.some((v) => v.mesh.position.distanceTo(p) < 0.95);
      const sp = wait ? 0 : w.speed;
      w.s += sp * dt * w.dir;
      const [x, z, hd] = this._walkerAt(w);
      w.m.position.set(x, 0, z);
      w.m.rotation.y = yawOf(hd);
      const ud = w.m.userData;
      if (sp > 0) w.phase += dt * 9;
      const swing = sp > 0 ? Math.sin(w.phase) * 0.55 : 0;
      ud.legs[0].rotation.x = swing; ud.legs[1].rotation.x = -swing;
      ud.arms[0].rotation.x = -swing * 0.8; ud.arms[1].rotation.x = swing * 0.8;
      w.jolt = Math.max(0, (w.jolt || 0) - dt * 2.5);
      ud.body.position.y = Math.abs(Math.sin(w.phase)) * 0.02 * (sp > 0 ? 1 : 0) + Math.sin(w.jolt * Math.PI) * 0.18;
    }
  }

  _flashBlocker(b) {
    const L = this.level;
    const bm = this.blockMesh;
    if (b.kind === 'walker' || b.kind === 'traffic') {
      const p = b.obj.m.position;
      const [sx, sy] = this._screen(p.x, 0.9, p.z);
      this.fx.bang(sx, sy, 30);
      return;
    }
    if (b.kind === 'barrier') {
      const p = b.obj.mesh.position;
      bm.position.set(p.x, 0.025, p.z);
      const along = b.obj.side % 2 === 0;
      bm.scale.set(along ? 1.05 : 0.5, 1, along ? 0.5 : 1.05);
    } else if (b.kind === 'vehicle') {
      const v = b.obj;
      const [cx, cz] = this._centerOf(v);
      const horiz = isHoriz(v.dir);
      bm.position.set(cx, 0.025, cz);
      bm.scale.set((horiz ? v.len : 1) + 0.12, 1, (horiz ? 1 : v.len) + 0.12);
    } else {
      bm.position.set(b.obj.x + 0.5 - L.w / 2, 0.025, b.obj.y + 0.5 - L.h / 2);
      bm.scale.set(1.12, 1, 1.12);
    }
    this.blockT = 0.7;
    const [sx, sy] = this._screen(bm.position.x, 0.9, bm.position.z);
    const unit = Math.abs(this._screen(bm.position.x + 1, 0.9, bm.position.z)[0] - sx);
    this.fx.bang(sx, sy, Math.max(26, unit * 0.62));
  }

  celebrate() {
    const n = this.settings.reduceMotion ? 40 : 160;
    this.fx.confetti(this.cw, this.ch, n);
    if (!this.settings.reduceMotion) this.fx.burst(this.cw / 2, this.ch / 2, 70);
  }

  /** Snapshot of the board for the test harness. */
  debugTargets() {
    const h = this.findHint();
    if (!h) return null;
    const p = h.obj.mesh.position;
    return this._screen(p.x, 0.3, p.z);
  }
}
