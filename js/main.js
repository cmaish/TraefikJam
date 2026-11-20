import { Game } from './game.js';
import * as audio from './audio.js';
import { settings, progress, save, completedCount, totalStars, addPlayTime, today } from './storage.js';
import { getLevel, getDailyLevel, CAMPAIGN_LEVELS } from './levels.js';
import { WORLDS, LEVELS_PER_WORLD } from './worlds.js';
import { KINDS, PATTERNS, REWARDS, COLORS, unlockedSet, rewardName } from './vehicles.js';
import { initParent, requestSettings, openGate, openPanel, closeAll, isOpen } from './parent.js';
import * as studio from './studio.js';
import { loadRealistic, realisticReady, REAL, REAL_FILES } from './realistic.js';

const $ = (s) => document.querySelector(s);
const VERSION = '3.0.1';

// ------------------------------------------------------------ helpers ---

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function haptic(p) {
  if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch { /* ignore */ } }
}

function applyAudio() {
  audio.configure({ sfx: settings.sfx, music: settings.music, sfxVol: settings.sfxVol, musicVol: settings.musicVol, voice: settings.voice });
}

const unlocked = () => unlockedSet(completedCount(), settings.allVehicles);
const honkFor = (kind) => (KINDS[kind].sound === 'honk' ? 'car' : KINDS[kind].sound);

let audioReady = false;
function firstInput() {
  audio.unlock();
  if (!audioReady) { audioReady = true; applyAudio(); }
}
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, firstInput, { capture: true, passive: true });

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function dailyStreak() {
  const d = new Date();
  if (!progress.daily[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (progress.daily[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ------------------------------------------------------------ screens ---

let screen = 'home';
let pushed = false;
let useHistory = false;
try { useHistory = window.top === window; } catch { useHistory = false; }
function push(name) {
  if (!useHistory) return false;
  try { history.pushState({ s: name }, ''); return true; } catch { return false; }
}

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  screen = name;
  if (name === 'home') { renderHome(); showcase(); }
  else if (name === 'game') game.start();
  else game.stop();
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
  for (const id of ['#overlay-win', '#overlay-reward', '#overlay-pause', '#overlay-show']) $(id).classList.remove('show');
  studio.stop();
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { audio.sfx.tap(); goHome(); }));

// ------------------------------------------------------------ game ---

let game;
try {
  game = new Game($('#board'), $('#fx'), {
  settings: () => settings,
  sfx: audio.sfx,
  haptic,
  onFirstInput: firstInput,
  onExit: (n, total) => updateProgress(n, total),
  onWin: (st) => onWin(st),
  onBump: (n) => updateHudStars(n, true),
  hudHeight: () => { const r = $('#hud').getBoundingClientRect(); return r.bottom > 0 ? r.bottom : 70; },
  showInsets: () => {
    const logo = $('.logo').getBoundingClientRect();
    const bottom = $('.home-bottom').getBoundingClientRect();
    return { top: Math.max(0, logo.bottom), bottom: Math.max(0, window.innerHeight - bottom.top) };
  },
  });
} catch (err) {
  $('#splash-msg').textContent = 'This device or browser can’t show 3D graphics (WebGL is turned off or unsupported). Try another browser, or update this one.';
  document.querySelector('.splash-road').remove();
  throw err;
}

let current = 1; // level number being played
let daily = null; // date key when playing the daily puzzle
let showKey = '';

/** Resolve once the models the current style needs are loaded (falls back to toy on failure). */
function ensureModels() {
  if (!settings.realistic || realisticReady()) return Promise.resolve();
  return loadRealistic().catch(() => {
    settings.realistic = false;
    save();
    toast('Couldn’t load the realistic models, so the toy ones are shown instead');
  });
}

function showcase() {
  const n = progress.current || 1;
  const key = `${n}|${settings.faces}|${settings.realistic}|${completedCount()}`;
  if (showKey === key && game.mode === 'show') { game.start(); return; }
  showKey = key;
  ensureModels().then(() => requestAnimationFrame(() => { if (screen === 'home') game.load(getLevel(n, unlocked()), 'show'); }));
}

function startLevel(n) {
  current = n;
  daily = null;
  progress.current = n;
  if (!progress.firstPlayed) progress.firstPlayed = Date.now();
  save();
  hideOverlays();
  show('game');
  const lvl = getLevel(n, unlocked());
  setHud(lvl);
  showKey = '';
  ensureModels().then(() => requestAnimationFrame(() => game.load(lvl, 'play')));
}

function startDaily() {
  daily = dayKey();
  hideOverlays();
  show('game');
  const lvl = getDailyLevel(daily, unlocked());
  setHud(lvl);
  showKey = '';
  ensureModels().then(() => requestAnimationFrame(() => game.load(lvl, 'play')));
}

function setHud(lvl) {
  const W = lvl.world;
  let t;
  if (lvl.daily) t = `📅 Daily · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  else if (lvl.bonus) t = `🎁 Bonus ${settings.showLevelNumbers ? lvl.n - CAMPAIGN_LEVELS : ''}`;
  else t = settings.showLevelNumbers ? `${W.icon} Level ${lvl.n}` : `${W.icon} ${W.name}`;
  $('#level-tag').textContent = t;
  updateProgress(0, lvl.vehicles.length);
  updateHudStars(0, false);
}

function updateProgress(n, total) {
  $('#progress-fill').style.width = (total ? (n / total) * 100 : 0) + '%';
  $('#hud-count').textContent = `${total - n} left`;
}

function updateHudStars(bumps, bumped) {
  const box = $('#hud-stars');
  box.classList.toggle('hide', settings.stars === 'gentle');
  const stars = starsFor({ bumps });
  box.querySelectorAll('svg').forEach((s, i) => s.classList.toggle('lost', i >= stars));
  if (bumped && settings.stars !== 'gentle') { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
}

function starsFor(st) {
  if (settings.stars === 'gentle') return 3;
  if (st.bumps <= 1) return 3;
  if (st.bumps <= 4) return 2;
  return 1;
}

function onWin(st) {
  const stars = starsFor(st);
  let isNewBest = false;
  if (daily) {
    isNewBest = (progress.daily[daily] || 0) < stars;
    progress.daily[daily] = Math.max(progress.daily[daily] || 0, stars);
  } else {
    const n = current;
    isNewBest = (progress.stars[n] || 0) < stars;
    progress.stars[n] = Math.max(progress.stars[n] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, n + 1);
    progress.current = n + 1;
  }
  progress.carsCleared += st.total;
  progress.bumps += st.bumps;
  save();
  setTimeout(() => {
    game.celebrate();
    audio.sfx.win();
    if (settings.voice) setTimeout(() => audio.cheer(), 500);
    haptic([30, 50, 30, 50, 60]);
    const titles = stars === 3 ? ['Perfect!', 'Flawless!', 'Lot cleared!', 'Superb!'] : ['Lot cleared!', 'Nice work!', 'All out!'];
    $('#win-title').textContent = titles[Math.floor(Math.random() * titles.length)];
    $('#win-kicker').textContent = daily ? 'Daily puzzle' : current > CAMPAIGN_LEVELS ? `Bonus ${current - CAMPAIGN_LEVELS}` : `Level ${current}`;
    $('#st-moves').textContent = st.moves;
    $('#st-bumps').textContent = st.bumps;
    $('#st-time').textContent = fmtTime(st.seconds);
    let tip = '';
    if (settings.stars !== 'gentle') {
      if (st.bumps === 0) tip = 'No bumps at all!';
      else if (stars < 3) tip = 'Tip: check which way a car faces before you tap it.';
      else if (isNewBest) tip = 'New best!';
    }
    if (daily) { const s = dailyStreak(); tip = `Daily streak: ${s} day${s === 1 ? '' : 's'}`; }
    $('#win-tip').textContent = tip;
    const reward = !daily && pendingReward();
    $('#next-label').textContent = daily ? 'Done' : reward ? 'Open your present' : 'Next level';
    const ws = document.querySelectorAll('.wstar');
    ws.forEach((s) => s.classList.remove('on'));
    $('#overlay-win').classList.add('show');
    for (let i = 0; i < stars; i++) setTimeout(() => { ws[i].classList.add('on'); audio.sfx.star(i); }, 450 + i * 300);
  }, 450);
}

$('#btn-next').addEventListener('click', () => {
  audio.sfx.pop();
  $('#overlay-win').classList.remove('show');
  if (daily) { goHome(); return; }
  const r = pendingReward();
  if (r) showReward(r);
  else startLevel(current + 1);
});
$('#btn-replay').addEventListener('click', () => { audio.sfx.pop(); if (daily) startDaily(); else startLevel(current); });
$('#btn-win-home').addEventListener('click', () => { audio.sfx.tap(); goHome(); });
$('#btn-restart').addEventListener('click', () => { audio.sfx.whoosh(); if (daily) startDaily(); else startLevel(current); });
$('#btn-hint').addEventListener('click', () => { audio.sfx.tap(); game.showHint(); });

// pause menu
function pause() {
  audio.sfx.tap();
  game.stop();
  $('#overlay-pause').classList.add('show');
}
function resume() {
  $('#overlay-pause').classList.remove('show');
  if (screen === 'game') game.start();
}
$('#btn-pause').addEventListener('click', pause);
$('#p-resume').addEventListener('click', () => { audio.sfx.tap(); resume(); });
$('#p-restart').addEventListener('click', () => { audio.sfx.whoosh(); $('#overlay-pause').classList.remove('show'); if (daily) startDaily(); else startLevel(current); });
$('#p-levels').addEventListener('click', () => { audio.sfx.tap(); $('#overlay-pause').classList.remove('show'); show('levels'); });
$('#p-settings').addEventListener('click', () => { audio.sfx.tap(); requestSettings(); });
$('#p-home').addEventListener('click', () => { audio.sfx.tap(); goHome(); });

// ------------------------------------------------------------ rewards ---

function pendingReward() {
  const r = REWARDS[progress.rewardsSeen];
  return r && completedCount() >= r.at ? r : null;
}

function rewardItem(r) {
  const kind = r.kind || 'car';
  return { kind, len: KINDS[kind].len, color: COLORS[(r.at * 3) % COLORS.length], pattern: r.pattern || null };
}

function showReward(r) {
  const ov = $('#overlay-reward');
  const gift = $('#gift');
  const view = $('#reward-view');
  gift.classList.remove('open', 'hidden');
  view.classList.remove('show');
  $('#btn-reward-ok').classList.add('hidden');
  $('#reward-kicker').textContent = `${r.at} levels completed`;
  $('#reward-text').textContent = 'You earned a present!';
  ov.classList.add('show');
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
      view.classList.add('show');
      studio.showcase(view, rewardItem(r), { faces: settings.faces, realistic: settings.realistic && !r.pattern });
      const name = rewardName(r);
      $('#reward-kicker').textContent = r.kind ? 'New vehicle' : 'New paint job';
      $('#reward-text').textContent = name;
      if (settings.voice) audio.say(r.kind ? `New ${name}!` : `New paint: ${name}!`);
      audio.sfx.honk(honkFor(r.kind || 'car'));
      setTimeout(() => $('#btn-reward-ok').classList.remove('hidden'), 600);
    }, 450);
  };
}

$('#btn-reward-ok').addEventListener('click', () => {
  audio.sfx.pop();
  studio.stop();
  $('#overlay-reward').classList.remove('show');
  const r = pendingReward();
  if (r) showReward(r);
  else startLevel(current + 1);
});

// ------------------------------------------------------------ home ---

function renderHome() {
  const n = progress.current || 1;
  const bonus = n > CAMPAIGN_LEVELS;
  const W = WORLDS[Math.min(WORLDS.length - 1, Math.floor((n - 1) / LEVELS_PER_WORLD))];
  $('#play-world').textContent = bonus ? 'Bonus lots' : W.name;
  $('#play-label').textContent = settings.showLevelNumbers ? (bonus ? `Bonus ${n - CAMPAIGN_LEVELS}` : `Level ${n}`) : 'Play';
  $('#home-stars span').textContent = totalStars();
  const streak = dailyStreak();
  $('#home-streak').classList.toggle('hidden', !streak);
  $('#home-streak span').textContent = streak;
  $('#daily-dot').classList.toggle('hidden', !!progress.daily[dayKey()]);
}

$('#btn-play').addEventListener('click', () => {
  audio.sfx.vroom(false);
  const r = pendingReward();
  if (r) { current = (progress.current || 1) - 1; showReward(r); return; }
  startLevel(progress.current || 1);
});
$('#btn-levels').addEventListener('click', () => { audio.sfx.tap(); show('levels'); });
$('#btn-garage').addEventListener('click', () => { audio.sfx.tap(); show('garage'); });
$('#btn-settings').addEventListener('click', () => { audio.sfx.tap(); requestSettings(); });
$('#btn-daily').addEventListener('click', () => {
  audio.sfx.vroom(false);
  const done = progress.daily[dayKey()];
  if (done) toast(`You've already solved today's puzzle (${'★'.repeat(done)}). Here it is again.`);
  startDaily();
});

// ------------------------------------------------------------ levels ---

function starRow(n) {
  let h = '<span class="ls">';
  for (let i = 0; i < 3; i++) h += `<svg class="${i < n ? 'on' : ''}"><use href="#i-star"/></svg>`;
  return h + '</span>';
}

const WORLD_COLORS = ['#ffad1f', '#ff7a45', '#2fae5b', '#7bb83a', '#3d9be0', '#6c5ce7', '#e0457b'];

function renderLevels() {
  const list = $('#world-list');
  list.innerHTML = '';
  $('#levels-stars').textContent = totalStars();
  const maxOpen = settings.unlockAll ? Infinity : progress.unlocked;
  const worlds = WORLDS.map((w, i) => ({ ...w, from: i * LEVELS_PER_WORLD + 1, to: (i + 1) * LEVELS_PER_WORLD, color: WORLD_COLORS[i] }));
  if (progress.unlocked > CAMPAIGN_LEVELS || settings.unlockAll) {
    const to = Math.max(CAMPAIGN_LEVELS + 20, Math.ceil((progress.unlocked + 5) / 5) * 5);
    worlds.push({ name: 'Bonus Lots', icon: '🎁', from: CAMPAIGN_LEVELS + 1, to, color: WORLD_COLORS[6], bonus: true });
  }
  let scrollTarget = null;
  for (const w of worlds) {
    let ws = 0, done = 0;
    for (let n = w.from; n <= w.to; n++) { ws += progress.stars[n] || 0; if (progress.stars[n]) done++; }
    const count = w.to - w.from + 1;
    const sec = document.createElement('div');
    sec.className = 'world';
    sec.innerHTML = `<div class="world-head"><div class="world-badge" style="background:${w.color}22">${w.icon}</div>
      <div class="grow"><div class="world-name">${w.name}</div><div class="world-meta">${done}/${count} cleared · ${ws}/${count * 3} ★</div>
      <div class="world-bar"><i style="width:${(ws / (count * 3)) * 100}%"></i></div></div></div><div class="level-grid"></div>`;
    const grid = sec.querySelector('.level-grid');
    for (let n = w.from; n <= w.to; n++) {
      const b = document.createElement('button');
      b.className = 'lvl';
      const locked = n > maxOpen;
      b.style.background = w.color;
      const label = w.bonus ? n - CAMPAIGN_LEVELS : n;
      if (locked) {
        b.classList.add('locked');
        b.innerHTML = '<svg><use href="#i-lock"/></svg>';
        b.setAttribute('aria-label', `Level ${label}, locked`);
      } else {
        b.innerHTML = `<span class="num ${settings.showLevelNumbers ? '' : 'hide'}">${label}</span>${starRow(progress.stars[n] || 0)}`;
        b.setAttribute('aria-label', `Level ${label}`);
      }
      if (n === progress.current) { b.classList.add('current'); scrollTarget = sec; }
      b.addEventListener('click', () => {
        if (locked) { audio.sfx.boing(); toast('Clear the level before this one to unlock it'); return; }
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

const thumbs = new Map();
let garageJob = 0;

function syncStyleButtons() {
  document.querySelectorAll('.style-btn').forEach((b) => {
    const on = (b.dataset.style === 'real') === !!settings.realistic;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
}

document.querySelectorAll('.style-btn').forEach((b) => b.addEventListener('click', async () => {
  const want = b.dataset.style === 'real';
  if (want === !!settings.realistic) return;
  audio.sfx.tap();
  if (want && !realisticReady()) {
    b.classList.add('busy');
    b.textContent = 'Loading…';
    try { await loadRealistic(); } catch {
      b.classList.remove('busy');
      b.textContent = 'Realistic';
      toast('Couldn’t load the realistic models. Check your connection and try again.');
      return;
    }
    b.classList.remove('busy');
    b.textContent = 'Realistic';
  }
  settings.realistic = want;
  save();
  showKey = '';
  syncStyleButtons();
  renderGarage();
}));

function renderGarage() {
  syncStyleButtons();
  const list = $('#garage-list');
  list.innerHTML = '';
  if (settings.realistic) {
    const note = document.createElement('p');
    note.className = 'garage-note';
    note.textContent = 'Realistic vehicles from Kenney’s Car Kit (CC0). The school bus, ice cream truck and cement mixer have no realistic version yet, and paint jobs only show on toy-style cars.';
    list.appendChild(note);
  }
  const un = unlocked();
  const items = [];
  const mk = (title, entries) => {
    const sec = document.createElement('div');
    sec.className = 'garage-section';
    sec.innerHTML = `<h3>${title}</h3><div class="garage-grid"></div>`;
    const grid = sec.querySelector('.garage-grid');
    for (const it of entries) {
      const b = document.createElement('button');
      b.className = 'g-item' + (it.open ? '' : ' locked');
      const img = document.createElement('img');
      img.alt = it.open ? it.name : 'Locked';
      b.appendChild(img);
      const nm = document.createElement('div');
      nm.className = 'g-name';
      nm.textContent = it.open ? it.name : `${it.reward ? it.reward.at : '?'} levels`;
      b.appendChild(nm);
      b.addEventListener('click', () => {
        if (!it.open) { audio.sfx.boing(); toast(`Unlocks after ${it.reward.at} levels completed`); return; }
        openShowcase(it);
      });
      grid.appendChild(b);
      items.push({ it, img });
    }
    list.appendChild(sec);
  };
  const vehicleItems = Object.entries(KINDS).map(([kind, k], i) => ({
    kind, len: k.len, name: k.name, open: un.kinds.has(kind), color: COLORS[(i * 3) % COLORS.length], reward: REWARDS.find((r) => r.kind === kind),
  }));
  const patternItems = Object.entries(PATTERNS).map(([p, name], i) => ({
    kind: 'car', len: 2, name, pattern: p, open: un.patterns.has(p), color: COLORS[(i * 3 + 1) % COLORS.length], reward: REWARDS.find((r) => r.pattern === p),
  }));
  const total = vehicleItems.length + patternItems.length;
  const have = [...vehicleItems, ...patternItems].filter((x) => x.open).length;
  $('#garage-count').textContent = `${have}/${total}`;
  mk('Vehicles', vehicleItems);
  mk('Paint jobs', patternItems);
  // render thumbnails a few per frame so the screen appears instantly
  const job = ++garageJob;
  let i = 0;
  const step = () => {
    if (job !== garageJob || screen !== 'garage') return;
    for (let k = 0; k < 3 && i < items.length; k++, i++) {
      const { it, img } = items[i];
      const real = settings.realistic && !it.pattern;
      const key = `${it.kind}|${it.pattern}|${it.color}|${settings.faces}|${real}`;
      if (!thumbs.has(key)) thumbs.set(key, studio.thumbnail(it, 240, 180, { faces: settings.faces, realistic: real }));
      img.src = thumbs.get(key);
    }
    if (i < items.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let showItem = null;
function openShowcase(it) {
  showItem = it;
  audio.sfx.pop();
  $('#show-name').textContent = it.name;
  $('#show-sub').textContent = it.pattern ? 'Paint job for cars and trucks' : `Takes ${it.len} parking spaces`;
  $('#overlay-show').classList.add('show');
  requestAnimationFrame(() => studio.showcase($('#show-view'), it, { faces: settings.faces, realistic: settings.realistic && !it.pattern }));
  audio.sfx.honk(honkFor(it.kind));
}
$('#show-honk').addEventListener('click', () => { if (showItem) { audio.sfx.honk(honkFor(showItem.kind)); haptic(15); } });
$('#show-close').addEventListener('click', () => { studio.stop(); $('#overlay-show').classList.remove('show'); });

// ------------------------------------------------------------ play time / rest ---

let sessionSeconds = 0;
let resting = false;

function showRest() {
  resting = true;
  game.stop();
  $('#overlay-rest').classList.add('show');
  if (settings.voice) audio.say('Time for a rest!');
}

function endRest() {
  resting = false;
  sessionSeconds = 0;
  $('#overlay-rest').classList.remove('show');
  if (screen === 'game' || screen === 'home') game.start();
}
$('#rest-continue').addEventListener('click', () => openGate(endRest));

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

// ------------------------------------------------------------ settings ---

let swFailed = false;

initParent({
  toast,
  today,
  startLevel,
  onSettings: (key) => {
    applyAudio();
    if (key === 'timeLimit') sessionSeconds = 0;
    if (screen === 'home') renderHome();
    if (key === 'faces' || key === 'kidMode' || key === '*' || key === 'allVehicles') { showKey = ''; thumbs.clear(); }
  },
  onReset: () => { current = 1; showKey = ''; if (screen === 'home') { renderHome(); showcase(); } },
  onPanel: (open) => {
    if (open && resting) endRest();
    if (!open && screen === 'home') { renderHome(); showcase(); }
  },
  offlineStatus: () => {
    if (!('serviceWorker' in navigator) || swFailed) return 'not available in this view. Open the hosted site to install it for offline play.';
    return navigator.serviceWorker.controller ? `ready ✓ (v${VERSION})` : `getting ready… (v${VERSION})`;
  },
});

// ------------------------------------------------------------ boot ---

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    try { navigator.serviceWorker.register('sw.js').catch(() => { swFailed = true; }); } catch { swFailed = true; }
  });
}

if (settings.realistic) loadRealistic().catch(() => {});
show('home');
// fade the splash once the first 3D frame is on screen
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
  $('#splash').classList.add('out');
  setTimeout(() => $('#splash').remove(), 500);
}, 250)));

// handy for automated tests
window.__app = { game, startLevel, startDaily, show, settings, progress, openPanel, openGate, requestSettings, loadRealistic, REAL, REAL_FILES };
