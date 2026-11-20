// Plays through levels in headless Chromium and saves screenshots.
// Usage: (serve repo root on :8123) node tools/smoke-test.mjs [outDir]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.env.BASE || 'http://localhost:8123/';
const out = process.argv[2] || '/tmp/bbj-shots';
const levels = (process.env.LEVELS || '1,2,7,25,45,65,85,105,125').split(',').map(Number);
const { mkdirSync } = await import('node:fs');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/home.png` });

async function solve(n, shotMid) {
  await page.evaluate((n) => window.__app.startLevel(n), n);
  await page.waitForTimeout(400);
  if (shotMid) await page.screenshot({ path: `${out}/level-${n}.png` });
  for (let guard = 0; guard < 200; guard++) {
    const target = await page.evaluate(() => {
      const g = window.__app.game;
      if (g.won) return null;
      const h = g.findHint();
      if (!h) return 'wait';
      const s = g.cell;
      if (h.kind === 'vehicle') { const [x, y] = g._centerPx(h.obj); return [x, y]; }
      return [g.ox + (h.obj.x + 0.5) * s, g.oy + (h.obj.y + 0.5) * s];
    });
    if (target === null) break;
    if (target !== 'wait') {
      const box = await page.locator('#board').boundingBox();
      await page.mouse.click(box.x + target[0], box.y + target[1]);
    }
    await page.waitForTimeout(target === 'wait' ? 100 : 60);
  }
  await page.waitForTimeout(1500);
  const won = await page.evaluate(() => window.__app.game.won);
  return won;
}

for (const n of levels) {
  const won = await solve(n, true);
  console.log('level', n, won ? 'WON' : 'NOT WON');
  if (n === levels[0]) await page.screenshot({ path: `${out}/win.png` });
}
// bump test: tap a blocked car
await page.evaluate(() => window.__app.startLevel(30));
await page.waitForTimeout(400);
const bumped = await page.evaluate(() => {
  const g = window.__app.game;
  const v = g.vehicles.find((v) => !g.isFree(v));
  if (!v) return false;
  g.tapVehicle(v);
  return true;
});
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/bump.png` });
console.log('bump', bumped);

await page.evaluate(() => window.__app.show('levels'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/levels.png` });
await page.evaluate(() => window.__app.show('garage'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/garage.png` });
await page.evaluate(() => window.__app.openGate(() => window.__app.openPanel()));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/gate.png` });
await page.evaluate(() => window.__app.openPanel());
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/parent.png` });

// landscape
await page.setViewportSize({ width: 900, height: 420 });
await page.evaluate(() => { document.querySelector('#overlay-parent').classList.remove('show'); document.querySelector('#overlay-gate').classList.remove('show'); window.__app.startLevel(90); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/landscape.png` });
await page.evaluate(() => window.__app.show('home'));
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/home-landscape.png` });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
