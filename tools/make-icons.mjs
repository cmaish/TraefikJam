// Renders the app icons with the game's own drawing code.
// Usage: (serve the repo root on :8123) node tools/make-icons.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { writeFileSync } from 'node:fs';

const base = process.env.BASE || 'http://localhost:8123/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + 'tools/icon.html');
const out = await page.evaluate(async () => {
  const { drawVehicle } = await import('../js/draw.js');
  const make = (size, maskable) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#4cc3ff');
    g.addColorStop(1, '#9be3ff');
    x.fillStyle = g;
    if (maskable) x.fillRect(0, 0, size, size);
    else { x.beginPath(); x.roundRect(0, 0, size, size, size * 0.22); x.fill(); }
    x.fillStyle = '#7ed957';
    x.beginPath(); x.ellipse(size / 2, size * 0.98, size * 0.75, size * 0.3, 0, 0, Math.PI * 2); x.fill();
    const s = size * (maskable ? 0.27 : 0.33);
    x.save();
    x.translate(size / 2, size * 0.5);
    x.rotate(-0.35);
    drawVehicle(x, { kind: 'car', len: 2, color: '#ff5a5f' }, s, { mood: 'idle', t: 0 });
    x.restore();
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
