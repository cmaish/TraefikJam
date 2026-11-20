// "Realistic" vehicles: Kenney's Car Kit (CC0) glTF models, bundled in models/carkit/.
// Loaded once on demand; every vehicle on the board shares the same geometry and texture.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { buildVehicle } from './models.js';

const BASE = 'models/carkit/';

// Which Car Kit models stand in for each kind. Plain cars rotate through several body styles.
export const REAL = {
  car: ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'van'],
  taxi: ['taxi'],
  police: ['police'],
  racecar: ['race', 'race-future'],
  ambulance: ['ambulance'],
  tractor: ['tractor'],
  jeep: ['suv'],
  truck: ['truck', 'delivery', 'truck-flat'],
  firetruck: ['firetruck'],
  garbage: ['garbage-truck'],
  // bus, ice cream truck and cement mixer have no Car Kit equivalent: they stay toy-style
};
export const REAL_FILES = [...new Set(Object.values(REAL).flat())].map((n) => `${BASE}${n}.glb`).concat([`${BASE}Textures/colormap.png`]);

const templates = new Map();
let loading = null;

export const realisticReady = () => templates.size > 0;

/** Load all realistic models (once). Resolves when ready; rejects if they can't be fetched. */
export function loadRealistic() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const names = [...new Set(Object.values(REAL).flat())];
  // .glb normally; some hosts (e.g. embedded previews) only serve plain-JSON glTF, so fall back to that
  const load = (n) => loader.loadAsync(`${BASE}${n}.glb`).catch(() => loader.loadAsync(`${BASE}${n}.gltf.json`));
  loading = Promise.all(names.map((n) => load(n).then((gltf) => templates.set(n, prepare(gltf.scene)))))
    .catch((err) => { loading = null; templates.clear(); throw err; });
  return loading;
}

function prepare(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // shared by every copy: never dispose these when a level is torn down
    o.geometry.userData.cached = true;
    o.material.userData.cached = true;
    o.material.envMapIntensity = 0.7;
    o.material.roughness = Math.min(o.material.roughness ?? 1, 0.55);
    if (o.material.map) { o.material.map.userData.cached = true; o.material.map.anisotropy = 4; }
  });
  return scene;
}

/** Build a realistic vehicle facing -Z that fills `len` cells, or null if there's no model for it. */
export function buildReal(v) {
  const names = REAL[v.kind || (v.len === 3 ? 'truck' : 'car')];
  if (!names || !templates.size) return null;
  const pick = Math.abs((v.variant ?? v.id ?? 0) * 7 + (v.color ? v.color.charCodeAt(1) : 0)) % names.length;
  const tpl = templates.get(names[pick]);
  if (!tpl) return null;
  const len = v.len || 2;
  const model = tpl.clone(true); // shares geometry + material
  model.rotation.y = Math.PI; // Car Kit faces +Z, the game faces -Z
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  // fit the slot: width across the cell, length along the cells (a little stretch is fine for trucks)
  const sx = 0.8 / size.x, sz = (len - 0.12) / size.z;
  const sy = Math.min(sx, sz) * 1.08;
  holder.scale.set(sx, sy, sz);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(holder);
  root.add(body);
  const wheels = [];
  model.traverse((o) => { if (/^wheel/.test(o.name)) wheels.push({ g: o, r: 0.3 * sy }); });
  root.userData = { body, wheels, sirens: [], drum: null, eyes: null, len, L: len - 0.12, real: true };
  root.traverse((o) => { o.userData.vroot = root; });
  return root;
}

/** The model for a vehicle in the current style. Falls back to the toy model when needed. */
export function vehicleModel(v, opts = {}) {
  if (opts.realistic) {
    const r = buildReal(v);
    if (r) return r;
  }
  return buildVehicle(v, opts);
}
