// Procedural low-poly 3D models: vehicles, animals, obstacles and scenery.
// Everything faces -Z ("forward") and sits on y = 0. 1 unit = 1 parking cell.
import * as THREE from '../vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

// ------------------------------------------------------------ caches ---

const geos = new Map();
function geo(key, make) {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
}
export const rbox = (w, h, d, r = 0.05, seg = 3) =>
  geo(`rb${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
const cyl = (rt, rb, h, seg = 20) => geo(`cy${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = (r, seg = 16) => geo(`sp${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)));
const ico = (r, d = 0) => geo(`ic${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
const cone = (r, h, seg = 16) => geo(`co${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const torus = (r, t) => geo(`to${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));

const mats = new Map();
function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}
const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.55, ...o });
export const M = {
  paint: (c) => mat('paint' + c, () => std({ color: c, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.75 })),
  matte: (c) => mat('matte' + c, () => std({ color: c, roughness: 0.75, metalness: 0, envMapIntensity: 0.4 })),
  flat: (c) => mat('flat' + c, () => std({ color: c, roughness: 0.85, metalness: 0, flatShading: true, envMapIntensity: 0.35 })),
  glass: () => mat('glass', () => std({ color: 0x223349, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.1 })),
  rubber: () => mat('rubber', () => std({ color: 0x1d1e22, roughness: 0.85, envMapIntensity: 0.3 })),
  chrome: () => mat('chrome', () => std({ color: 0xe6e9ef, roughness: 0.18, metalness: 1, envMapIntensity: 1 })),
  dark: () => mat('dark', () => std({ color: 0x2a2d35, roughness: 0.6, metalness: 0.2 })),
  gold: () => mat('gold', () => std({ color: 0xf2c230, roughness: 0.2, metalness: 1, envMapIntensity: 1.2 })),
  glow: (c, i = 1.6) => mat('glow' + c + i, () => std({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 })),
};

function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (!g.boundingSphere) g.computeBoundingSphere();
  o.castShadow = g.boundingSphere.radius > 0.14; // tiny trim pieces don't need shadows
  o.receiveShadow = true;
  if (parent) parent.add(o);
  return o;
}

// ------------------------------------------------------------ patterns ---

const patternTex = new Map();
function patternTexture(p) {
  if (patternTex.has(p)) return patternTex.get(p);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  const star = (cx, cy, r) => {
    x.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  };
  const heart = (cx, cy, s) => {
    x.beginPath(); x.moveTo(cx, cy + s * 0.35);
    x.bezierCurveTo(cx - s, cy - s * 0.3, cx - s * 0.4, cy - s, cx, cy - s * 0.45);
    x.bezierCurveTo(cx + s * 0.4, cy - s, cx + s, cy - s * 0.3, cx, cy + s * 0.35); x.fill();
  };
  if (p === 'dots') { x.fillStyle = 'rgba(255,255,255,0.9)'; for (let yy = 16; yy < 256; yy += 32) for (let xx = (yy / 32) % 2 ? 16 : 32; xx < 128; xx += 32) { x.beginPath(); x.arc(xx, yy, 8, 0, 7); x.fill(); } }
  if (p === 'stripes') { x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(42, 0, 16, 256); x.fillRect(70, 0, 16, 256); }
  if (p === 'hearts') { x.fillStyle = 'rgba(255,235,242,0.95)'; for (let yy = 26; yy < 256; yy += 48) for (const xx of [30, 98]) heart(xx, yy + (xx > 50 ? 24 : 0), 16); }
  if (p === 'stars') { x.fillStyle = 'rgba(255,248,190,1)'; for (let yy = 26; yy < 256; yy += 48) for (const xx of [30, 98]) star(xx, yy + (xx > 50 ? 24 : 0), 15); }
  if (p === 'flames') {
    const g = x.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, '#ffe14d'); g.addColorStop(1, '#ff4d1f'); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 0);
    for (let i = 0; i <= 6; i++) { const xx = (128 * i) / 6; const l = 90 + 45 * Math.sin(i * 2.3); x.lineTo(xx - 10, l); x.lineTo(xx, l * 0.55); }
    x.lineTo(128, 0); x.fill();
  }
  if (p === 'rainbow') { ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ccf6e', '#3a86ff', '#9b5de5'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * (128 / 6), 0, 128 / 6 + 1, 256); }); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  patternTex.set(p, t);
  return t;
}

function decal(parent, p, w, l, y, z = 0) {
  const m = mat('decal' + p, () => new THREE.MeshStandardMaterial({ map: patternTexture(p), transparent: true, roughness: 0.3, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const g = geo(`pl${w}|${l}`, () => new THREE.PlaneGeometry(w, l));
  const o = new THREE.Mesh(g, m);
  o.rotation.x = -Math.PI / 2;
  o.position.set(0, y, z);
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

// ------------------------------------------------------------ vehicle parts ---

function wheel(parent, x, y, z, r, w, list) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const t = mesh(cyl(r, r, w, 22), M.rubber(), 0, 0, 0, g);
  t.rotation.z = Math.PI / 2;
  const hub = mesh(cyl(r * 0.55, r * 0.55, w + 0.01, 14), M.chrome(), 0, 0, 0, g);
  hub.rotation.z = Math.PI / 2;
  const spoke = mesh(new THREE.BoxGeometry(w + 0.02, r * 0.18, r * 0.9), M.dark(), 0, 0, 0, g);
  void spoke;
  parent.add(g);
  list.push({ g, r });
  return g;
}

function lights(body, W, L, y, front = true, rear = true) {
  if (front) for (const s of [-1, 1]) mesh(rbox(0.16, 0.07, 0.04, 0.02), M.glow(0xfff4cc, 1.8), s * W * 0.3, y, -L / 2 - 0.005, body);
  if (rear) for (const s of [-1, 1]) mesh(rbox(0.14, 0.06, 0.04, 0.02), M.glow(0xff2a2a, 1.2), s * W * 0.3, y, L / 2 + 0.005, body);
}

function lightBar(body, y, z, a, b, list) {
  mesh(rbox(0.36, 0.04, 0.12, 0.02), M.dark(), 0, y, z, body);
  const ma = new THREE.MeshStandardMaterial({ color: a, emissive: a, emissiveIntensity: 0.4 });
  const mb = new THREE.MeshStandardMaterial({ color: b, emissive: b, emissiveIntensity: 0.4 });
  const la = mesh(rbox(0.15, 0.07, 0.11, 0.03), ma, -0.09, y + 0.05, z, body);
  const lb = mesh(rbox(0.15, 0.07, 0.11, 0.03), mb, 0.09, y + 0.05, z, body);
  list.push(la, lb);
}

function eyes(body, y, z, spread = 0.13, r = 0.075) {
  const g = new THREE.Group();
  const lids = [];
  for (const s of [-1, 1]) {
    const e = mesh(sph(r, 16), M.matte(0xffffff), s * spread, y, z, g);
    e.scale.z = 0.6;
    const p = mesh(sph(r * 0.55, 12), M.matte(0x16161c), s * spread, y + r * 0.1, z - r * 0.45, g);
    p.scale.z = 0.6;
    const hl = mesh(sph(r * 0.18, 8), M.glow(0xffffff, 0.5), s * spread + r * 0.15, y + r * 0.35, z - r * 0.62, g);
    void hl;
    lids.push(e);
  }
  body.add(g);
  return g;
}

// ------------------------------------------------------------ vehicles ---

const W = 0.76;

/**
 * Build a vehicle. v = { kind, len, color, pattern }, opts = { faces }.
 * Returns a Group (root) with userData { body, wheels, sirens, drum, eyes }.
 */
export function buildVehicle(v, opts = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const len = v.len || 2;
  const L = len - 0.14;
  const kind = v.kind || (len === 3 ? 'truck' : 'car');
  const gold = v.pattern === 'gold';
  const col = gold ? null : new THREE.Color(v.color || '#ff5a5f').getHex();
  const P = (c) => (gold ? M.gold() : M.paint(c));
  const wheels = [];
  const sirens = [];
  let drum = null;
  let eyeY = 0.42, eyeZ = -L / 2 + 0.55;

  const sedan = (c, opt = {}) => {
    const h = opt.h || 0.2;
    mesh(rbox(W * 0.94, 0.1, L * 0.96, 0.04), M.dark(), 0, 0.14, 0, body);
    mesh(rbox(W, h, L, 0.08), P(c), 0, 0.17 + h / 2, 0, body);
    const cz = opt.cabinZ ?? L * 0.06;
    const cl = opt.cabinL ?? L * 0.5;
    mesh(rbox(W * 0.8, 0.19, cl, 0.08), M.glass(), 0, 0.17 + h + 0.08, cz, body);
    mesh(rbox(W * 0.74, 0.05, cl * 0.78, 0.025), P(opt.roof ?? c), 0, 0.17 + h + 0.18, cz + cl * 0.04, body);
    mesh(rbox(W * 0.5, 0.05, 0.03, 0.01), M.dark(), 0, 0.22, -L / 2 - 0.005, body);
    lights(body, W, L, 0.27);
    for (const z of [-L * 0.31, L * 0.31]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.035), 0.15, z, 0.15, 0.11, wheels);
    eyeY = 0.17 + h + 0.1; eyeZ = cz - cl / 2 - 0.02;
    return 0.17 + h; // top of hood
  };

  const truckBase = (cabC, cargoLen) => {
    mesh(rbox(W * 0.9, 0.12, L * 0.98, 0.04), M.dark(), 0, 0.17, 0, body);
    const cabL = 0.8;
    const cz = -L / 2 + cabL / 2;
    mesh(rbox(W, 0.42, cabL, 0.1), P(cabC), 0, 0.42, cz, body);
    mesh(rbox(W * 0.86, 0.18, 0.08, 0.04), M.glass(), 0, 0.53, -L / 2 + 0.03, body);
    for (const s of [-1, 1]) mesh(rbox(0.04, 0.15, 0.3, 0.02), M.glass(), s * (W / 2 + 0.003), 0.52, cz - 0.05, body);
    mesh(rbox(W * 0.5, 0.08, 0.03, 0.01), M.chrome(), 0, 0.3, -L / 2 - 0.005, body);
    lights(body, W, L, 0.33, true, true);
    for (const z of [-L / 2 + 0.38, L / 2 - 0.38, L / 2 - 0.82]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.04), 0.16, z, 0.16, 0.12, wheels);
    eyeY = 0.55; eyeZ = -L / 2 - 0.02;
    return { cargoZ: -L / 2 + cabL + 0.04 + (cargoLen ?? L - cabL - 0.04) / 2, cargoL: cargoLen ?? L - cabL - 0.04 };
  };

  switch (kind) {
    case 'taxi': {
      const top = sedan(0xffc81a);
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.045, L * 0.11), M.matte(i % 2 ? 0x111111 : 0xffffff), s * (W / 2 + 0.002), top - 0.05, -L * 0.33 + i * L * 0.11, body);
      mesh(rbox(0.3, 0.09, 0.13, 0.03), M.glow(0xfff2b0, 0.6), 0, top + 0.31, L * 0.08, body);
      break;
    }
    case 'police': {
      const top = sedan(0xf4f6fa, { roof: 0xf4f6fa });
      mesh(rbox(W + 0.01, 0.205, L * 0.25, 0.08), M.paint(0x1e2638), 0, 0.17 + 0.1, -L * 0.375, body);
      mesh(rbox(W + 0.01, 0.205, L * 0.2, 0.08), M.paint(0x1e2638), 0, 0.17 + 0.1, L * 0.4, body);
      lightBar(body, top + 0.24, L * 0.06, 0xff2020, 0x2060ff, sirens);
      break;
    }
    case 'ambulance': {
      mesh(rbox(W * 0.94, 0.1, L * 0.96, 0.04), M.dark(), 0, 0.14, 0, body);
      mesh(rbox(W, 0.5, L, 0.1), M.paint(0xf6f7fb), 0, 0.42, 0, body);
      mesh(rbox(W * 0.86, 0.17, 0.08, 0.04), M.glass(), 0, 0.52, -L / 2 + 0.02, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.07, L * 0.9), M.matte(0xff3040), s * (W / 2 + 0.002), 0.36, 0, body);
      mesh(new THREE.BoxGeometry(0.1, 0.012, 0.3), M.matte(0xff3040), 0, 0.675, 0.15, body);
      mesh(new THREE.BoxGeometry(0.3, 0.012, 0.1), M.matte(0xff3040), 0, 0.675, 0.15, body);
      lightBar(body, 0.68, -L * 0.3, 0xff2020, 0xff2020, sirens);
      lights(body, W, L, 0.3);
      for (const z of [-L * 0.31, L * 0.31]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.035), 0.15, z, 0.15, 0.11, wheels);
      eyeY = 0.53; eyeZ = -L / 2 - 0.03;
      break;
    }
    case 'racecar': {
      mesh(rbox(W * 0.9, 0.06, L * 0.96, 0.03), M.dark(), 0, 0.1, 0, body);
      mesh(rbox(W * 0.98, 0.15, L * 0.96, 0.07), P(col), 0, 0.2, 0, body);
      mesh(rbox(W * 0.6, 0.13, L * 0.32, 0.06), M.glass(), 0, 0.31, L * 0.05, body);
      mesh(new THREE.BoxGeometry(0.1, 0.005, L * 0.95), M.matte(0xffffff), -0.08, 0.278, 0, body);
      mesh(new THREE.BoxGeometry(0.1, 0.005, L * 0.95), M.matte(0xffffff), 0.08, 0.278, 0, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), M.dark(), s * 0.22, 0.34, L / 2 - 0.1, body);
      mesh(rbox(W * 1.02, 0.04, 0.16, 0.02), P(col), 0, 0.43, L / 2 - 0.1, body);
      lights(body, W, L, 0.22);
      for (const z of [-L * 0.32, L * 0.3]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.02), 0.14, z, 0.14, 0.15, wheels);
      eyeY = 0.33; eyeZ = L * 0.05 - L * 0.16 - 0.02;
      break;
    }
    case 'jeep': {
      mesh(rbox(W * 0.94, 0.1, L * 0.96, 0.03), M.dark(), 0, 0.17, 0, body);
      mesh(rbox(W, 0.24, L, 0.04), M.paint(0xc9a46a), 0, 0.32, 0, body);
      mesh(rbox(W * 0.86, 0.17, 0.05, 0.02), M.glass(), 0, 0.52, -L * 0.12, body);
      // roll bar + seats
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), M.dark(), s * W * 0.4, 0.55, L * 0.15, body);
      mesh(new THREE.BoxGeometry(W * 0.84, 0.04, 0.04), M.dark(), 0, 0.66, L * 0.15, body);
      for (const s of [-1, 1]) mesh(rbox(0.22, 0.12, 0.2, 0.04), M.matte(0x5b3b22), s * 0.15, 0.5, L * 0.02, body);
      const sp = mesh(cyl(0.15, 0.15, 0.1, 18), M.rubber(), 0, 0.36, L / 2 + 0.06, body);
      sp.rotation.x = Math.PI / 2;
      lights(body, W, L, 0.36);
      for (const z of [-L * 0.31, L * 0.31]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.02), 0.17, z, 0.17, 0.13, wheels);
      eyeY = 0.53; eyeZ = -L * 0.12 - 0.04;
      break;
    }
    case 'tractor': {
      const g = 0x2fa84f;
      mesh(rbox(0.36, 0.26, L * 0.5, 0.06), M.paint(g), 0, 0.36, -L * 0.2, body);
      for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.37, 0.02, 0.02), M.dark(), 0, 0.42, -L * 0.36 + i * 0.07, body);
      mesh(cyl(0.035, 0.035, 0.3), M.dark(), 0.1, 0.62, -L * 0.15, body);
      mesh(rbox(W * 0.8, 0.12, L * 0.42, 0.04), M.paint(0xffcc1a), 0, 0.3, L * 0.25, body);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), M.dark(), x * W * 0.32, 0.55, L * 0.25 + z * L * 0.17, body);
      mesh(rbox(W * 0.78, 0.05, L * 0.44, 0.02), M.paint(g), 0, 0.77, L * 0.25, body);
      mesh(rbox(0.22, 0.18, 0.18, 0.05), M.matte(0x333333), 0, 0.45, L * 0.28, body);
      lights(body, 0.4, L, 0.38, true, false);
      for (const s of [-1, 1]) wheel(body, s * 0.25, 0.13, -L * 0.33, 0.13, 0.1, wheels);
      for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.02), 0.26, L * 0.25, 0.26, 0.16, wheels);
      eyeY = 0.42; eyeZ = -L / 2 - 0.02;
      break;
    }
    case 'truck': {
      const { cargoZ, cargoL } = truckBase(col);
      const lc = gold ? M.gold() : M.matte(new THREE.Color(v.color).lerp(new THREE.Color(0xffffff), 0.55).getHex());
      mesh(rbox(W * 0.98, 0.56, cargoL, 0.05), lc, 0, 0.5, cargoZ, body);
      for (let i = 1; i < 6; i++) for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.48, 0.025), P(col), s * (W * 0.49 + 0.003), 0.5, cargoZ - cargoL / 2 + (i * cargoL) / 6, body);
      if (v.pattern && !gold) decal(body, v.pattern, W * 0.9, cargoL * 0.95, 0.782, cargoZ);
      break;
    }
    case 'bus': {
      mesh(rbox(W * 0.94, 0.1, L * 0.97, 0.04), M.dark(), 0, 0.15, 0, body);
      mesh(rbox(W, 0.55, L, 0.1), M.paint(0xffc01a), 0, 0.46, 0, body);
      mesh(rbox(W + 0.012, 0.15, L * 0.82, 0.04), M.glass(), 0, 0.56, L * 0.06, body);
      mesh(rbox(W * 0.86, 0.2, 0.06, 0.03), M.glass(), 0, 0.55, -L / 2 + 0.01, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.012, 0.03, L * 0.98), M.matte(0x1a1a1a), s * (W / 2 + 0.003), 0.4, 0, body);
      mesh(rbox(W * 0.7, 0.03, L * 0.8, 0.015), M.matte(0xf3f3f3), 0, 0.75, 0, body);
      lights(body, W, L, 0.3);
      for (const z of [-L / 2 + 0.4, L / 2 - 0.45]) for (const s of [-1, 1]) wheel(body, s * (W / 2 - 0.04), 0.16, z, 0.16, 0.12, wheels);
      eyeY = 0.56; eyeZ = -L / 2 - 0.03;
      break;
    }
    case 'firetruck': {
      const { cargoZ, cargoL } = truckBase(0xe32222);
      mesh(rbox(W * 0.98, 0.42, cargoL, 0.05), M.paint(0xd11c1c), 0, 0.43, cargoZ, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.012, 0.05, cargoL * 0.95), M.chrome(), s * (W * 0.49 + 0.004), 0.5, cargoZ, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.04, L * 0.9), M.chrome(), s * 0.18, 0.7, cargoZ - 0.2, body);
      for (let i = 0; i < 12; i++) mesh(new THREE.BoxGeometry(0.36, 0.025, 0.025), M.chrome(), 0, 0.7, cargoZ - 0.2 - L * 0.42 + i * (L * 0.84) / 11, body);
      lightBar(body, 0.65, -L / 2 + 0.45, 0xff2020, 0xffaa10, sirens);
      break;
    }
    case 'icecream': {
      const { cargoZ, cargoL } = truckBase(0xff8fc8);
      mesh(rbox(W * 0.98, 0.58, cargoL, 0.08), M.paint(0xfff4fa), 0, 0.51, cargoZ, body);
      mesh(rbox(W + 0.01, 0.12, cargoL * 0.96, 0.04), M.paint(0xff8fc8), 0, 0.3, cargoZ, body);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.01, 0.2, cargoL * 0.5), M.glass(), s * (W * 0.49 + 0.003), 0.55, cargoZ, body);
      const cz = cargoZ;
      const c = mesh(cone(0.11, 0.26, 12), M.flat(0xdca35e), 0, 0.92, cz, body);
      c.rotation.x = Math.PI;
      mesh(sph(0.13, 14), M.matte(0xff9ccc), 0, 1.08, cz, body);
      mesh(sph(0.1, 14), M.matte(0xfff1a8), 0, 1.2, cz, body);
      mesh(sph(0.04, 10), M.glow(0xff2a4a, 0.3), 0, 1.31, cz, body);
      break;
    }
    case 'garbage': {
      const { cargoZ, cargoL } = truckBase(0x23a45a);
      mesh(rbox(W * 0.98, 0.6, cargoL, 0.08), M.paint(0x2fbf6a), 0, 0.52, cargoZ, body);
      for (let i = 1; i < 5; i++) mesh(rbox(W * 1.0, 0.03, 0.04, 0.01), M.paint(0x1d7d45), 0, 0.82, cargoZ - cargoL / 2 + (i * cargoL) / 5, body);
      mesh(rbox(W * 0.9, 0.2, 0.08, 0.03), M.dark(), 0, 0.4, L / 2 + 0.02, body);
      break;
    }
    case 'mixer': {
      const { cargoZ, cargoL } = truckBase(0xff8c1a);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.55, cargoZ);
      pivot.rotation.x = -0.18;
      body.add(pivot);
      const dg = geo('drum' + cargoL, () => {
        const pts = [];
        const n = 12;
        for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(0.1 + 0.26 * Math.sin(Math.PI * Math.min(1, t * 1.1)), (t - 0.5) * cargoL)); }
        return new THREE.LatheGeometry(pts, 20);
      });
      const tex = mat('drumTex', () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d'); x.fillStyle = '#e8ecf0'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#ff8c1a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(20, 0); x.lineTo(64, 44); x.lineTo(64, 64); x.lineTo(44, 64); x.lineTo(0, 20); x.fill();
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.3 });
      });
      drum = mesh(dg, tex, 0, 0, 0, pivot);
      drum.rotation.x = Math.PI / 2;
      break;
    }
    default: {
      const top = sedan(col);
      if (v.pattern && !gold) decal(body, v.pattern, W * 0.92, L * 0.94, top + 0.003);
    }
  }

  if (v.pattern === 'crown') {
    const cg = new THREE.Group();
    const top = new THREE.Box3().setFromObject(body).max.y;
    mesh(cyl(0.11, 0.11, 0.07, 16), M.gold(), 0, 0, 0, cg);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(cone(0.035, 0.08, 6), M.gold(), Math.cos(a) * 0.1, 0.07, Math.sin(a) * 0.1, cg); }
    mesh(sph(0.03, 8), M.glow(0xff2a4a, 0.5), 0, 0.06, -0.1, cg);
    cg.position.set(0, top + 0.035, kind === 'car' ? L * 0.06 : -L / 2 + 0.4);
    body.add(cg);
  }

  let eyeGroup = null;
  if (opts.faces) eyeGroup = eyes(body, eyeY, eyeZ);

  root.userData = { body, wheels, sirens, drum, eyes: eyeGroup, len, L };
  root.traverse((o) => { o.userData.vroot = root; });
  return root;
}

// ------------------------------------------------------------ obstacles ---

export function buildObstacle(type) {
  const g = new THREE.Group();
  if (type === 'tree' || type === 'bush') {
    if (type === 'tree') {
      mesh(cyl(0.06, 0.08, 0.35, 8), M.flat(0x7a4a2a), 0, 0.17, 0, g);
      mesh(ico(0.34, 0), M.flat(0x2f9a4c), 0, 0.5, 0, g);
      mesh(ico(0.26, 0), M.flat(0x3fb35c), 0.05, 0.75, -0.03, g).rotation.y = 0.6;
      mesh(sph(0.04, 8), M.matte(0xe63946), 0.2, 0.55, 0.2, g);
      mesh(sph(0.04, 8), M.matte(0xe63946), -0.22, 0.48, 0.1, g);
    } else {
      mesh(ico(0.24, 1), M.flat(0x4fbf5a), -0.1, 0.2, 0.05, g);
      mesh(ico(0.2, 1), M.flat(0x62cf6a), 0.14, 0.18, -0.06, g);
      mesh(ico(0.18, 1), M.flat(0x3faa4c), 0.02, 0.32, -0.02, g);
      for (const [x, z, c] of [[-0.15, 0.2, 0xff6b9a], [0.18, 0.12, 0xffd23f], [0.05, -0.2, 0xffffff]]) mesh(sph(0.045, 8), M.matte(c), x, 0.33, z, g);
    }
  } else if (type === 'cone') {
    mesh(rbox(0.34, 0.04, 0.34, 0.02), M.matte(0xff6a1a), 0, 0.02, 0, g);
    mesh(cone(0.14, 0.46, 18), M.matte(0xff6a1a), 0, 0.27, 0, g);
    mesh(cyl(0.092, 0.11, 0.07, 18), M.matte(0xffffff), 0, 0.22, 0, g);
    mesh(cyl(0.05, 0.065, 0.05, 18), M.matte(0xffffff), 0, 0.37, 0, g);
  } else if (type === 'hay') {
    const h = mesh(cyl(0.26, 0.26, 0.72, 20), M.matte(0xf0c548), 0, 0.26, 0, g);
    h.rotation.z = Math.PI / 2;
    for (const x of [-0.18, 0.18]) { const b = mesh(cyl(0.265, 0.265, 0.04, 20), M.matte(0xa0522d), x, 0.26, 0, g); b.rotation.z = Math.PI / 2; }
  } else if (type === 'snowman') {
    const snow = M.matte(0xfbfdff);
    mesh(sph(0.27, 18), snow, 0, 0.25, 0, g);
    mesh(sph(0.19, 18), snow, 0, 0.6, 0, g);
    mesh(sph(0.14, 16), snow, 0, 0.86, 0, g);
    const n = mesh(cone(0.03, 0.16, 8), M.matte(0xff8a1a), 0, 0.86, 0.2, g);
    n.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) mesh(sph(0.022, 8), M.matte(0x111111), s * 0.05, 0.9, 0.12, g);
    mesh(cyl(0.11, 0.11, 0.14, 16), M.matte(0x222222), 0, 1.02, 0, g);
    mesh(cyl(0.17, 0.17, 0.02, 16), M.matte(0x222222), 0, 0.95, 0, g);
    mesh(torus(0.15, 0.035), M.matte(0xe63946), 0, 0.74, 0, g).rotation.x = Math.PI / 2;
  }
  return g;
}

// ------------------------------------------------------------ pets ---

export function buildPet(type) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const eyesAt = (y, z, sp, r = 0.03) => { for (const s of [-1, 1]) { mesh(sph(r, 10), M.matte(0x111111), s * sp, y, z, body); mesh(sph(r * 0.35, 6), M.glow(0xffffff, 0.6), s * sp + r * 0.3, y + r * 0.35, z + r * 0.8, body); } };
  switch (type) {
    case 'duck': case 'chick': {
      const c = type === 'duck' ? 0xfaf7ee : 0xffd93b;
      const b = mesh(sph(0.22, 18), M.matte(c), 0, 0.2, 0, body); b.scale.set(1, 0.85, 1.15);
      mesh(sph(0.15, 16), M.matte(c), 0, 0.42, 0.1, body);
      const bk = mesh(rbox(0.12, 0.04, 0.1, 0.02), M.matte(0xff9a1a), 0, 0.4, 0.25, body); void bk;
      eyesAt(0.47, 0.22, 0.07);
      if (type === 'chick') mesh(cone(0.03, 0.08, 6), M.matte(0xffc81a), 0, 0.59, 0.08, body);
      break;
    }
    case 'pig': {
      const b = mesh(sph(0.24, 18), M.matte(0xffaccb), 0, 0.24, 0, body); b.scale.set(1, 0.9, 1.2);
      mesh(sph(0.17, 16), M.matte(0xffaccb), 0, 0.33, 0.22, body);
      const sn = mesh(cyl(0.07, 0.07, 0.06, 14), M.matte(0xff86b2), 0, 0.31, 0.38, body); sn.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) { mesh(sph(0.015, 6), M.matte(0x9b3d61), s * 0.025, 0.31, 0.415, body); const e = mesh(cone(0.05, 0.08, 4), M.matte(0xff86b2), s * 0.11, 0.48, 0.2, body); e.rotation.z = -s * 0.4; }
      eyesAt(0.38, 0.35, 0.07, 0.025);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.04, 0.04, 0.12, 8), M.matte(0xff9cc0), x * 0.12, 0.06, z * 0.14, body);
      break;
    }
    case 'puppy': {
      const b = mesh(sph(0.2, 16), M.matte(0xd29a5c), 0, 0.22, -0.02, body); b.scale.set(1, 0.9, 1.25);
      mesh(sph(0.17, 16), M.matte(0xd29a5c), 0, 0.42, 0.18, body);
      mesh(sph(0.08, 12), M.matte(0xf3d6b0), 0, 0.38, 0.32, body);
      mesh(sph(0.03, 8), M.matte(0x111111), 0, 0.41, 0.4, body);
      for (const s of [-1, 1]) { const e = mesh(sph(0.07, 10), M.matte(0x8b5a2b), s * 0.16, 0.44, 0.15, body); e.scale.set(0.6, 1.4, 0.9); }
      eyesAt(0.47, 0.32, 0.065);
      mesh(cyl(0.025, 0.02, 0.18, 6), M.matte(0xd29a5c), 0, 0.33, -0.27, body).rotation.x = -0.8;
      break;
    }
    case 'kitty': {
      const b = mesh(sph(0.2, 16), M.matte(0xa9b0bf), 0, 0.2, -0.02, body); b.scale.set(1, 0.9, 1.2);
      mesh(sph(0.16, 16), M.matte(0xa9b0bf), 0, 0.4, 0.16, body);
      for (const s of [-1, 1]) { const e = mesh(cone(0.06, 0.12, 4), M.matte(0x8f96a6), s * 0.09, 0.56, 0.16, body); e.rotation.z = -s * 0.2; }
      mesh(sph(0.025, 8), M.matte(0xff7aa8), 0, 0.39, 0.32, body);
      eyesAt(0.44, 0.29, 0.06);
      const t = mesh(cyl(0.03, 0.025, 0.32, 8), M.matte(0x8f96a6), 0, 0.3, -0.28, body); t.rotation.x = -0.6;
      break;
    }
    case 'bunny': {
      const b = mesh(sph(0.2, 16), M.matte(0xf6f3fa), 0, 0.2, 0, body); b.scale.set(1, 0.95, 1.1);
      mesh(sph(0.15, 16), M.matte(0xf6f3fa), 0, 0.42, 0.12, body);
      for (const s of [-1, 1]) { const e = mesh(sph(0.05, 10), M.matte(0xf6f3fa), s * 0.06, 0.62, 0.08, body); e.scale.set(0.7, 2.4, 0.6); e.rotation.z = -s * 0.15; }
      mesh(sph(0.025, 8), M.matte(0xff7aa8), 0, 0.42, 0.27, body);
      mesh(sph(0.06, 10), M.matte(0xffffff), 0, 0.2, -0.22, body);
      eyesAt(0.46, 0.24, 0.06);
      break;
    }
    case 'penguin': {
      const b = mesh(sph(0.2, 18), M.matte(0x252a36), 0, 0.3, 0, body); b.scale.set(1, 1.45, 1);
      const w = mesh(sph(0.17, 18), M.matte(0xffffff), 0, 0.28, 0.06, body); w.scale.set(0.9, 1.35, 1);
      const bk = mesh(cone(0.04, 0.1, 8), M.matte(0xff9a1a), 0, 0.5, 0.21, body); bk.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) mesh(rbox(0.09, 0.03, 0.12, 0.015), M.matte(0xff9a1a), s * 0.08, 0.02, 0.06, body);
      eyesAt(0.56, 0.15, 0.06);
      break;
    }
  }
  g.userData.body = body;
  g.traverse((o) => { o.userData.proot = g; });
  return g;
}

// ------------------------------------------------------------ scenery ---

export function buildDeco(type, rand) {
  const g = new THREE.Group();
  const r = () => rand();
  switch (type) {
    case 'tree': {
      const s = 0.8 + r() * 0.6;
      mesh(cyl(0.07 * s, 0.1 * s, 0.4 * s, 7), M.flat(0x7a4a2a), 0, 0.2 * s, 0, g);
      mesh(ico(0.42 * s, 0), M.flat([0x2f9a4c, 0x3aa858, 0x4cb860][Math.floor(r() * 3)]), 0, 0.65 * s, 0, g);
      mesh(ico(0.3 * s, 0), M.flat(0x56c46a), 0.08, 0.95 * s, 0, g).rotation.y = r() * 3;
      break;
    }
    case 'pine': case 'snowpine': {
      const s = 0.8 + r() * 0.7;
      mesh(cyl(0.06 * s, 0.08 * s, 0.3 * s, 6), M.flat(0x6b4226), 0, 0.15 * s, 0, g);
      for (let i = 0; i < 3; i++) {
        mesh(cone((0.45 - i * 0.11) * s, 0.5 * s, 7), M.flat(type === 'snowpine' && i === 2 ? 0xf3f8ff : [0x23764a, 0x2a8a55, 0x349b60][i]), 0, (0.45 + i * 0.3) * s, 0, g);
      }
      break;
    }
    case 'rock': {
      const o = mesh(ico(0.2 + r() * 0.2, 0), M.flat(0xb7a07a), 0, 0.1, 0, g);
      o.scale.y = 0.6; o.rotation.y = r() * 3;
      break;
    }
    case 'cactus': {
      const c = M.flat(0x3e9c4a);
      mesh(cyl(0.09, 0.1, 0.8, 8), c, 0, 0.4, 0, g);
      mesh(cyl(0.06, 0.06, 0.3, 8), c, 0.18, 0.5, 0, g);
      mesh(cyl(0.06, 0.06, 0.15, 8), c, 0.11, 0.38, 0, g).rotation.z = Math.PI / 2;
      mesh(cyl(0.06, 0.06, 0.25, 8), c, -0.16, 0.6, 0, g);
      mesh(cyl(0.06, 0.06, 0.12, 8), c, -0.1, 0.48, 0, g).rotation.z = Math.PI / 2;
      break;
    }
    case 'flowers': {
      for (let i = 0; i < 5; i++) {
        const x = (r() - 0.5) * 0.7, z = (r() - 0.5) * 0.7;
        mesh(cyl(0.01, 0.01, 0.12, 4), M.flat(0x3a9a4a), x, 0.06, z, g);
        mesh(sph(0.05, 8), M.matte([0xff6b9a, 0xffd23f, 0xffffff, 0x9b5de5, 0xff9f1c][Math.floor(r() * 5)]), x, 0.13, z, g);
      }
      break;
    }
    case 'house': case 'building': {
      const night = type === 'building';
      const w = 1.2 + r() * 0.8, d = 1.1 + r() * 0.6, h = night ? 1.2 + r() * 2.2 : 0.8 + r() * 0.4;
      const wallC = night ? [0x3d4466, 0x4a3f66, 0x2f4a66][Math.floor(r() * 3)] : [0xfff1d6, 0xffe0e0, 0xe0f0ff, 0xf0ffe0][Math.floor(r() * 4)];
      mesh(rbox(w, h, d, 0.04), M.matte(wallC), 0, h / 2, 0, g);
      if (!night) {
        const roof = new THREE.Mesh(geo('roof' + w.toFixed(2) + d.toFixed(2), () => {
          const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.08, 0); s.lineTo(w / 2 + 0.08, 0); s.lineTo(0, 0.5); s.closePath();
          const e = new THREE.ExtrudeGeometry(s, { depth: d + 0.1, bevelEnabled: false }); e.translate(0, 0, -(d + 0.1) / 2); return e;
        }), M.flat([0xe0584a, 0x4a7fe0, 0x8a5a3a][Math.floor(r() * 3)]));
        roof.position.y = h; roof.castShadow = true; g.add(roof);
        mesh(rbox(0.22, 0.38, 0.04, 0.02), M.matte(0x8a5a3a), 0, 0.19, d / 2 + 0.01, g);
        for (const s of [-1, 1]) mesh(rbox(0.22, 0.2, 0.03, 0.02), M.glass(), s * w * 0.28, h * 0.6, d / 2 + 0.01, g);
      } else {
        const lit = M.glow(0xffd77a, 1.2), off = M.matte(0x252a40);
        for (let y = 0.3; y < h - 0.2; y += 0.35) for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.3) mesh(new THREE.BoxGeometry(0.14, 0.18, 0.02), r() < 0.55 ? lit : off, x, y, d / 2 + 0.01, g);
      }
      break;
    }
    case 'fence': {
      for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), M.matte(0xffffff), i * 0.25, 0.16, 0, g);
      for (const y of [0.12, 0.25]) mesh(new THREE.BoxGeometry(1.1, 0.05, 0.03), M.matte(0xffffff), 0, y, 0, g);
      break;
    }
    case 'barn': {
      mesh(rbox(1.4, 0.9, 1.1, 0.03), M.matte(0xc0392b), 0, 0.45, 0, g);
      const roof = mesh(cyl(0.72, 0.72, 1.14, 4, 1), M.flat(0x6b3a2a), 0, 0.9, 0, g);
      roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 4; roof.scale.set(1, 1, 0.55);
      mesh(new THREE.BoxGeometry(0.5, 0.55, 0.02), M.matte(0xffffff), 0, 0.28, 0.56, g);
      break;
    }
    case 'lamp': {
      mesh(cyl(0.03, 0.04, 1.3, 8), M.dark(), 0, 0.65, 0, g);
      mesh(rbox(0.12, 0.06, 0.3, 0.02), M.dark(), 0, 1.3, 0.12, g);
      mesh(rbox(0.1, 0.02, 0.24, 0.01), M.glow(0xffe6a0, 2.2), 0, 1.265, 0.12, g);
      break;
    }
    case 'snowpile': {
      mesh(sph(0.3, 10), M.matte(0xffffff), 0, 0, 0, g).scale.y = 0.5;
      break;
    }
  }
  return g;
}
