// A small turntable renderer for garage thumbnails, the garage showcase and reward reveals.
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { buildVehicle } from './models.js';

let R = null;

function init() {
  if (R) return R;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.ShadowMaterial({ opacity: 0.25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const holder = new THREE.Group();
  scene.add(holder);
  R = { canvas, renderer, scene, camera, holder, raf: 0, container: null };
  return R;
}

function setModel(item, opts = {}) {
  const r = init();
  while (r.holder.children.length) r.holder.remove(r.holder.children[0]);
  const m = buildVehicle(item, opts);
  r.holder.add(m);
  const len = item.len || 2;
  const d = 2.2 + len * 0.95;
  r.camera.position.set(d * 0.55, d * 0.5, d * 0.66);
  r.camera.lookAt(0, 0.28, 0);
  return m;
}

/** Render one item to a data URL (garage thumbnails). */
export function thumbnail(item, w = 240, h = 180, opts = {}) {
  const r = init();
  r.renderer.setPixelRatio(1);
  r.renderer.setSize(w, h, false);
  r.camera.aspect = w / h;
  r.camera.updateProjectionMatrix();
  const m = setModel(item, opts);
  m.rotation.y = -Math.PI / 2 + 0.45;
  r.renderer.render(r.scene, r.camera);
  return r.canvas.toDataURL('image/png');
}

/** Show a spinning model inside `container` until stop() is called. */
export function showcase(container, item, opts = {}) {
  const r = init();
  stop();
  r.container = container;
  container.appendChild(r.canvas);
  r.canvas.style.width = '100%';
  r.canvas.style.height = '100%';
  const size = () => {
    const w = container.clientWidth || 260, h = container.clientHeight || 220;
    r.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.renderer.setSize(w, h, false);
    r.camera.aspect = w / h;
    r.camera.updateProjectionMatrix();
  };
  size();
  const m = setModel(item, opts);
  r.camera.position.multiplyScalar(1.3);
  r.camera.lookAt(0, 0.3, 0);
  let t = 0, last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    m.rotation.y = t * 0.8 - 0.6;
    const ud = m.userData;
    for (const w of ud.wheels) w.g.rotation.x -= dt * 3;
    ud.sirens.forEach((s, i) => { s.material.emissiveIntensity = Math.floor(t * 6) % 2 === i ? 3 : 0.2; });
    if (ud.drum) ud.drum.rotation.y += dt * 2;
    m.position.y = Math.abs(Math.sin(t * 2)) * 0.04;
    r.renderer.render(r.scene, r.camera);
    r.raf = requestAnimationFrame(frame);
  };
  r.raf = requestAnimationFrame(frame);
  return m;
}

export function stop() {
  if (!R) return;
  cancelAnimationFrame(R.raf);
  if (R.container && R.canvas.parentNode === R.container) R.container.removeChild(R.canvas);
  R.container = null;
}
