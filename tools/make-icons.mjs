// Renders the app icons with the game's own 3D models.
// Usage: (serve the repo root on :8123) node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.env.BASE || 'http://localhost:8123/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + 'tools/icon.html');
const out = await page.evaluate(async () => {
  const studio = await import('../js/studio.js');
  const car = studio.thumbnail({ kind: 'car', len: 2, color: '#ff5a5f' }, 600, 450);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = car; });
  const make = (size, maskable) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#2a3666');
    g.addColorStop(1, '#141b33');
    x.fillStyle = g;
    if (maskable) x.fillRect(0, 0, size, size);
    else { x.beginPath(); x.roundRect(0, 0, size, size, size * 0.22); x.fill(); }
    // parking bay lines
    x.strokeStyle = 'rgba(255,214,90,0.9)';
    x.lineWidth = size * 0.025;
    x.lineCap = 'round';
    for (const fx of [0.2, 0.8]) { x.beginPath(); x.moveTo(size * fx, size * 0.22); x.lineTo(size * fx, size * 0.8); x.stroke(); }
    const w = size * (maskable ? 0.78 : 0.95);
    x.drawImage(img, (size - w) / 2, size * 0.5 - (w * 0.75) / 2, w, w * 0.75);
    return c.toDataURL('image/png');
  };
  return { i192: make(192), i512: make(512), m512: make(512, true), a180: make(180, true) };
});
const save = (f, d) => writeFileSync(new URL('../icons/' + f, import.meta.url), Buffer.from(d.split(',')[1], 'base64'));
save('icon-192.png', out.i192);
save('icon-512.png', out.i512);
save('icon-maskable-512.png', out.m512);
save('apple-touch-icon.png', out.a180);
await browser.close();
console.log('icons written');
