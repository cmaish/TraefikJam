import { Game } from './game.js';
import * as audio from './audio.js';
import { settings, progress, save, completedCount, totalStars, addPlayTime, today } from './storage.js';
import { getLevel, CAMPAIGN_LEVELS } from './levels.js';
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';
import { KINDS, PATTERNS, REWARDS, COLORS, unlockedSet, rewardName } from './vehicles.js';
import { drawVehicle } from './draw.js';
import { initParent, openGate, openPanel, closeAll, isOpen } from './parent.js';

const $ = (s) => document.querySelector(s);
const VERSION = '1.0.1';

// ------------------------------------------------------------ helpers ---

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function haptic(p) {
  if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch { /* ignore */ } }
}

function applyAudio() {
  audio.configure({ sfx: settings.sfx, music: settings.music, sfxVol: settings.sfxVol, musicVol: settings.musicVol, voice: settings.voice });
}

const unlocked = () => unlockedSet(completedCount(), settings.allVehicles);

let audioReady = false;
function firstInput() {
  audio.unlock();
  if (!audioReady) { audioReady = true; applyAudio(); }
}
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, firstInput, { capture: true, passive: true });

// ------------------------------------------------------------ screens ---

let screen = 'home';
let pushed = false;
// Use the browser history (so Android's back button returns home) only when
// running as the top-level page; inside an embedded frame it could move the host page.
let useHistory = false;
try { useHistory = window.top === window; } catch { useHistory = false; }

function push(name) {
  if (!useHistory) return false;
  try { history.pushState({ s: name }, ''); return true; } catch { return false; }
}

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  screen = name;
  if (name !== 'game') game.stop();
  if (name === 'home') { renderHome(); homeRoad.start(); } else homeRoad.stop();
  if (name === 'levels') renderLevels();
  if (name === 'garage') renderGarage();
  if (name !== 'home' && !pushed) pushed = push(name);
}

function goHome() {
  hideOverlays();
  if (pushed) history.back();
  else show('home');
}

window.addEventListener('popstate', () => {
  pushed = false;
  if (isOpen()) { closeAll(); pushed = screen !== 'home' && push(screen); return; }
  hideOverlays();
  show('home');
});

function hideOverlays() {
  for (const id of ['#overlay-win', '#overlay-reward']) $(id).classList.remove('show');
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { audio.sfx.tap(); goHome(); }));

// ------------------------------------------------------------ game ---

const game = new Game($('#board'), {
  settings: () => settings,
  sfx: audio.sfx,
  haptic,
  onFirstInput: firstInput,
  onExit: (n, total) => updateProgressBar(n, total),
  onWin: (st) => onWin(st),
});

let current = 1;

function startLevel(n) {
  current = n;
  progress.current = n;
  if (!progress.firstPlayed) progress.firstPlayed = Date.now();
  save();
  hideOverlays();
  show('game');
  const lvl = getLevel(n, unlocked());
  const W = lvl.world;
  $('#level-tag').textContent = settings.showLevelNumbers ? `${W.icon} ${n}` : W.icon;
  $('#screen-game').style.background = { sunny: '#9be38f', trucks: '#f3d98b', forest: '#6cc070', farm: '#a9df7a', snow: '#eef6ff', night: '#25305a' }[lvl.theme];
  updateProgressBar(0, lvl.vehicles.length);
  // wait a frame so the board has its size
  requestAnimationFrame(() => { game.load(lvl); });
}

function updateProgressBar(n, total) {
  const pct = total ? (n / total) * 100 : 0;
  $('#progress-fill').style.width = pct + '%';
  $('#progress-car').style.left = pct + '%';
}

function starsFor(st) {
  if (settings.stars === 'gentle') return 3;
  const ok3 = Math.max(1, Math.floor(st.total * 0.15));
  if (st.bumps <= ok3) return 3;
  if (st.bumps <= Math.max(3, st.total * 0.5)) return 2;
  return 1;
}

function onWin(st) {
  const n = current;
  const stars = starsFor(st);
  progress.stars[n] = Math.max(progress.stars[n] || 0, stars);
  progress.unlocked = Math.max(progress.unlocked, n + 1);
  progress.current = n + 1;
  progress.carsCleared += st.total;
  progress.bumps += st.bumps;
  save();
  setTimeout(() => {
    game.celebrate();
    audio.sfx.win();
    setTimeout(() => audio.cheer(), 500);
    haptic([30, 50, 30, 50, 60]);
    const titles = ['Yay!', 'Hooray!', 'Super!', 'Wow!', 'Beep beep!', 'Great!'];
    $('#win-title').textContent = titles[Math.floor(Math.random() * titles.length)];
    const ws = document.querySelectorAll('.wstar');
    ws.forEach((s) => s.classList.remove('on'));
    $('#overlay-win').classList.add('show');
    for (let i = 0; i < stars; i++) setTimeout(() => { ws[i].classList.add('on'); audio.sfx.star(i); }, 500 + i * 350);
  }, 350);
}

$('#btn-next').addEventListener('click', () => {
  audio.sfx.pop();
  $('#overlay-win').classList.remove('show');
  const r = pendingReward();
  if (r) showReward(r);
  else startLevel(current + 1);
});
$('#btn-replay').addEventListener('click', () => { audio.sfx.pop(); startLevel(current); });
$('#btn-restart').addEventListener('click', () => { audio.sfx.whoosh(); startLevel(current); });
$('#btn-game-home').addEventListener('click', () => { audio.sfx.tap(); goHome(); });

// ------------------------------------------------------------ rewards ---

function pendingReward() {
  const r = REWARDS[progress.rewardsSeen];
  return r && completedCount() >= r.at ? r : null;
}

function drawRewardItem(canvas, r, t = 0) {
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  const kind = r.kind || 'car';
  const len = KINDS[kind].len;
  const s = Math.min(H * 0.7, W / (len + 0.4));
  c.translate(W / 2, H / 2);
  c.rotate(Math.PI / 2);
  drawVehicle(c, { kind, len, color: COLORS[(r.at * 3) % COLORS.length], color2: COLORS[(r.at * 3 + 4) % COLORS.length], pattern: r.pattern || null }, s, { mood: 'happy', t, siren: true });
}

function showReward(r) {
  const ov = $('#overlay-reward');
  const gift = $('#gift');
  const cv = $('#reward-canvas');
  gift.classList.remove('open', 'hidden');
  cv.classList.remove('show');
  $('#btn-reward-ok').classList.add('hidden');
  $('#reward-text').textContent = 'A present!';
  ov.classList.add('show');
  audio.say('A present! Tap it!');
  let opened = false;
  gift.onclick = () => {
    if (opened) return;
    opened = true;
    gift.classList.add('open');
    audio.sfx.unlock();
    haptic([40, 40, 80]);
    progress.rewardsSeen++;
    save();
    setTimeout(() => {
      gift.classList.add('hidden');
      cv.classList.add('show');
      let t = 0;
      const anim = () => {
        if (!ov.classList.contains('show')) return;
        t += 1 / 60;
        drawRewardItem(cv, r, t);
        requestAnimationFrame(anim);
      };
      anim();
      const name = rewardName(r);
      $('#reward-text').textContent = r.kind ? `New ${name}!` : `${name}!`;
      audio.say(r.kind ? `You got a new ${name}!` : `New paint: ${name}!`);
      audio.sfx.honk(KINDS[r.kind || 'car'].sound === 'honk' ? 'car' : KINDS[r.kind || 'car'].sound);
      setTimeout(() => $('#btn-reward-ok').classList.remove('hidden'), 700);
    }, 450);
  };
}

$('#btn-reward-ok').addEventListener('click', () => {
  audio.sfx.pop();
  $('#overlay-reward').classList.remove('show');
  const r = pendingReward();
  if (r) showReward(r);
  else startLevel(current + 1);
});

// ------------------------------------------------------------ home ---

function renderHome() {
  const n = progress.current || 1;
  $('#play-label').textContent = settings.showLevelNumbers ? n : '';
}

$('#btn-play').addEventListener('click', () => {
  audio.sfx.vroom(false);
  const r = pendingReward();
  if (r) { show('game'); showReward(r); current = (progress.current || 1) - 1; return; }
  startLevel(progress.current || 1);
});
$('#btn-levels').addEventListener('click', () => { audio.sfx.tap(); show('levels'); });
$('#btn-garage').addEventListener('click', () => { audio.sfx.tap(); show('garage'); });

// Little cars driving across the bottom of the home screen — tap them!
const homeRoad = (() => {
  const cv = $('#home-road');
  const c = cv.getContext('2d');
  let cars = [];
  let running = false;
  let last = 0;
  let W = 0, H = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  };
  const spawn = (lane) => {
    const kinds = [...unlocked().kinds];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const pats = [...unlocked().patterns];
    const dir = lane === 0 ? 1 : 3;
    const s = Math.min(H * 0.27, 64);
    const len = KINDS[kind].len;
    cars.push({ kind, len, dir, lane, s, x: dir === 1 ? -len * s : W + len * s, v: 60 + Math.random() * 50, color: COLORS[Math.floor(Math.random() * COLORS.length)],
      color2: COLORS[Math.floor(Math.random() * COLORS.length)], pattern: pats.length && Math.random() < 0.3 ? pats[Math.floor(Math.random() * pats.length)] : null, hop: 0, t: Math.random() * 10 });
  };
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (cv.clientWidth !== W) size();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const roadY = H * 0.2, roadH = H * 0.7;
    c.fillStyle = '#5b6274';
    c.fillRect(0, roadY, W, roadH);
    c.fillStyle = '#e9ecf2';
    c.fillRect(0, roadY - 6, W, 6);
    c.fillRect(0, roadY + roadH, W, 6);
    c.fillStyle = '#ffd23f';
    for (let x = 14; x < W; x += 60) c.fillRect(x, roadY + roadH / 2 - 3, 32, 6);
    for (const lane of [0, 1]) if (!cars.some((k) => k.lane === lane && Math.abs(k.x - (lane === 0 ? 0 : W)) < k.len * k.s * 2.5) && Math.random() < dt * 0.8) spawn(lane);
    cars = cars.filter((k) => k.x > -k.len * k.s * 2 && k.x < W + k.len * k.s * 2);
    for (const k of cars) {
      k.t += dt;
      k.x += (k.dir === 1 ? 1 : -1) * k.v * dt;
      k.hop = Math.max(0, k.hop - dt * 2);
      const y = roadY + (k.lane === 0 ? roadH * 0.27 : roadH * 0.73) - Math.sin(k.hop * Math.PI) * 30;
      c.save();
      c.translate(k.x, y);
      c.rotate(k.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
      drawVehicle(c, k, k.s, { mood: k.hop > 0 ? 'happy' : 'idle', t: k.t, siren: k.kind === 'police' || k.kind === 'firetruck' || k.kind === 'ambulance' });
      c.restore();
    }
    requestAnimationFrame(frame);
  };
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (const k of cars) {
      const half = (k.len * k.s) / 2;
      const ky = H * 0.2 + (k.lane === 0 ? H * 0.7 * 0.27 : H * 0.7 * 0.73);
      if (Math.abs(x - k.x) < half + 10 && Math.abs(y - ky) < k.s * 0.7) {
        k.hop = 1;
        k.v *= 1.6;
        audio.sfx.honk(KINDS[k.kind].sound === 'honk' ? 'car' : KINDS[k.kind].sound);
        haptic(15);
        break;
      }
    }
  });
  return {
    start() {
      if (running) return;
      running = true;
      size();
      if (!cars.length) {
        spawn(0); spawn(1);
        cars[0].x = W * 0.25; cars[1].x = W * 0.7;
      }
      last = performance.now();
      requestAnimationFrame(frame);
    },
    stop() { running = false; },
  };
})();

// ------------------------------------------------------------ levels ---

function starRow(n) {
  let h = '<span class="ls">';
  for (let i = 0; i < 3; i++) h += `<svg class="${i < n ? 'on' : ''}"><use href="#i-star"/></svg>`;
  return h + '</span>';
}

const WORLD_COLORS = ['#ffb703', '#ff7b54', '#3fae5a', '#8bc34a', '#5aa9e6', '#6c63ff', '#f15bb5'];

function renderLevels() {
  const list = $('#world-list');
  list.innerHTML = '';
  $('#levels-stars').textContent = totalStars();
  const maxOpen = settings.unlockAll ? Infinity : progress.unlocked;
  const worlds = WORLDS.map((w, i) => ({ ...w, from: i * LEVELS_PER_WORLD + 1, to: (i + 1) * LEVELS_PER_WORLD, color: WORLD_COLORS[i] }));
  if (progress.unlocked > CAMPAIGN_LEVELS || settings.unlockAll) {
    const to = Math.max(CAMPAIGN_LEVELS + 20, Math.ceil((progress.unlocked + 5) / 5) * 5);
    worlds.push({ name: 'Bonus Lots', icon: '🎁', from: CAMPAIGN_LEVELS + 1, to, color: WORLD_COLORS[6] });
  }
  let scrollTarget = null;
  for (const w of worlds) {
    let ws = 0;
    for (let n = w.from; n <= w.to; n++) ws += progress.stars[n] || 0;
    const sec = document.createElement('div');
    sec.className = 'world';
    sec.innerHTML = `<h3><span class="wicon">${w.icon}</span>${w.name}<span class="wstars"><svg><use href="#i-star"/></svg>${ws}</span></h3><div class="level-grid"></div>`;
    const grid = sec.querySelector('.level-grid');
    for (let n = w.from; n <= w.to; n++) {
      const b = document.createElement('button');
      b.className = 'lvl';
      const locked = n > maxOpen;
      b.style.background = w.color;
      if (locked) {
        b.classList.add('locked');
        b.innerHTML = '<svg><use href="#i-lock"/></svg>';
      } else {
        b.innerHTML = `<span class="num ${settings.showLevelNumbers ? '' : 'hide'}">${n}</span>${starRow(progress.stars[n] || 0)}`;
      }
      if (n === progress.current) { b.classList.add('current'); scrollTarget = sec; }
      b.addEventListener('click', () => {
        if (locked) { audio.sfx.boing(); b.animate([{ transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 300 }); return; }
        audio.sfx.pop();
        startLevel(n);
      });
      grid.appendChild(b);
    }
    list.appendChild(sec);
  }
  if (scrollTarget) requestAnimationFrame(() => scrollTarget.scrollIntoView({ block: 'center' }));
}

// ------------------------------------------------------------ garage ---

function renderGarage() {
  const list = $('#garage-list');
  list.innerHTML = '';
  const un = unlocked();
  const lockMsg = (r) => (r ? `${r.at} levels` : '');
  const mk = (title, items) => {
    const sec = document.createElement('div');
    sec.className = 'garage-section';
    sec.innerHTML = `<h3>${title}</h3><div class="garage-grid"></div>`;
    const grid = sec.querySelector('.garage-grid');
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'g-item' + (it.open ? '' : ' locked');
      const cv = document.createElement('canvas');
      cv.width = 200; cv.height = 150;
      b.appendChild(cv);
      const nm = document.createElement('div');
      nm.className = 'g-name';
      nm.textContent = it.open ? it.name : `🔒 ${lockMsg(it.reward)}`;
      b.appendChild(nm);
      const c = cv.getContext('2d');
      const len = KINDS[it.kind].len;
      const s = Math.min(150 * 0.62, 200 / (len + 0.35));
      c.translate(100, 75);
      c.rotate(Math.PI / 2);
      drawVehicle(c, { kind: it.kind, len, color: it.color, color2: COLORS[5], pattern: it.pattern }, s, { mood: 'idle', t: 0 });
      b.addEventListener('click', () => {
        if (!it.open) { audio.sfx.boing(); return; }
        b.classList.remove('go');
        void b.offsetWidth;
        b.classList.add('go');
        const snd = KINDS[it.kind].sound;
        audio.sfx.honk(snd === 'honk' ? 'car' : snd);
        audio.say(it.name);
        haptic(15);
      });
      grid.appendChild(b);
    }
    list.appendChild(sec);
  };
  const vehicleItems = Object.entries(KINDS).map(([kind, k], i) => ({
    kind, name: k.name, open: un.kinds.has(kind), color: COLORS[i % COLORS.length], reward: REWARDS.find((r) => r.kind === kind),
  }));
  const patternItems = Object.entries(PATTERNS).map(([p, name], i) => ({
    kind: 'car', name, pattern: p, open: un.patterns.has(p), color: COLORS[(i + 2) % COLORS.length], reward: REWARDS.find((r) => r.pattern === p),
  }));
  mk('Vehicles', vehicleItems);
  mk('Paint & fun', patternItems);
}

// ------------------------------------------------------------ play time / rest ---

let sessionSeconds = 0;
let resting = false;

function showRest() {
  resting = true;
  game.stop();
  homeRoad.stop();
  $('#overlay-rest').classList.add('show');
  const cv = $('#rest-canvas');
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.save();
  c.translate(150, 110);
  c.rotate(Math.PI / 2);
  drawVehicle(c, { kind: 'car', len: 2, color: '#3a86ff' }, 90, { mood: 'sleep', t: 0 });
  c.restore();
  audio.say('Time for a rest! Bye bye cars!');
}

function endRest() {
  resting = false;
  sessionSeconds = 0;
  $('#overlay-rest').classList.remove('show');
  if (screen === 'game') game.start();
  if (screen === 'home') homeRoad.start();
}

setInterval(() => {
  if (document.hidden || resting) return;
  sessionSeconds++;
  addPlayTime(1);
  if (sessionSeconds % 15 === 0) save();
  if (settings.timeLimit && sessionSeconds >= settings.timeLimit * 60) showRest();
}, 1000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.suspend(); save(); } else if (audioReady) audio.resume();
});

// ------------------------------------------------------------ parent ---

initParent({
  toast,
  today,
  startLevel,
  onSettings: (key) => {
    applyAudio();
    if (key === 'timeLimit') sessionSeconds = 0;
    if (screen === 'home') renderHome();
  },
  onReset: () => { current = 1; renderHome(); },
  onPanel: (open) => {
    if (open && resting) endRest();
  },
  offlineStatus: () => {
    if (!('serviceWorker' in navigator) || swFailed) return 'not available here. Open the hosted site (see README) to install it for offline play';
    return navigator.serviceWorker.controller ? `ready ✓ (v${VERSION})` : `preparing… (v${VERSION}) — reopen once while online`;
  },
});

// ------------------------------------------------------------ boot ---

let swFailed = false;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    try { navigator.serviceWorker.register('sw.js').catch(() => { swFailed = true; }); } catch { swFailed = true; }
  });
}

if (settings.timeLimit === undefined) settings.timeLimit = 0;
show('home');

// handy for automated tests
window.__app = { game, startLevel, show, settings, progress, openPanel, openGate };
