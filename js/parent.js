// Grown-ups area: a press-and-hold + sum gate, then settings & progress tools.
import { settings, progress, save, completedCount, totalStars, resetProgress, resetSettings } from './storage.js';
import { CAMPAIGN_LEVELS } from './levels.js';
import { REWARDS, rewardName } from './vehicles.js';

const $ = (s) => document.querySelector(s);
let api = null;

export function initParent(hooks) {
  api = hooks;
  document.querySelectorAll('[data-parent]').forEach(attachHold);
  $('#gate-cancel').addEventListener('click', closeGate);
  $('#pp-close').addEventListener('click', closePanel);
}

function attachHold(btn) {
  let timer = null;
  let fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fired = false;
    btn.classList.add('holding');
    timer = setTimeout(() => { cancel(); fired = true; openGate(() => openPanel()); }, 1600);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, cancel);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!fired) api?.toast('Grown-ups: press and hold the gear');
  });
}

// ------------------------------------------------------------- gate ---

let gateCb = null;
export function openGate(cb) {
  gateCb = cb;
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 2 + Math.floor(Math.random() * 8);
  const ans = a + b;
  const opts = new Set([ans]);
  while (opts.size < 4) {
    const d = ans + Math.floor(Math.random() * 9) - 4;
    if (d > 1 && d !== ans) opts.add(d);
  }
  $('#gate-q').textContent = `${a} + ${b} = ?`;
  const box = $('#gate-answers');
  box.innerHTML = '';
  [...opts].sort(() => Math.random() - 0.5).forEach((n) => {
    const bt = document.createElement('button');
    bt.textContent = n;
    bt.addEventListener('click', () => {
      if (n === ans) { closeGate(); gateCb && gateCb(); }
      else closeGate();
    });
    box.appendChild(bt);
  });
  $('#overlay-gate').classList.add('show');
}

export function closeGate() { $('#overlay-gate').classList.remove('show'); }
export function isOpen() { return $('#overlay-gate').classList.contains('show') || $('#overlay-parent').classList.contains('show'); }
export function closeAll() { closeGate(); closePanel(); }

// ------------------------------------------------------------- panel ---

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function toggleRow(key, label, note = '') {
  const row = el(`<div class="pp-row"><label for="s-${key}">${label}${note ? `<small>${note}</small>` : ''}</label>
    <span class="switch"><input type="checkbox" id="s-${key}"><span></span></span></div>`);
  const input = row.querySelector('input');
  input.checked = !!settings[key];
  input.addEventListener('change', () => { settings[key] = input.checked; changed(key); });
  row.querySelector('.switch').addEventListener('click', (e) => { if (e.target !== input) { input.checked = !input.checked; input.dispatchEvent(new Event('change')); } });
  return row;
}

function segRow(key, label, options, note = '') {
  const row = el(`<div class="pp-row"><span class="lbl">${label}${note ? `<small>${note}</small>` : ''}</span><div class="seg"></div></div>`);
  const seg = row.querySelector('.seg');
  for (const [val, text] of options) {
    const b = document.createElement('button');
    b.textContent = text;
    b.classList.toggle('on', settings[key] === val);
    b.addEventListener('click', () => {
      settings[key] = val;
      seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      changed(key);
    });
    seg.appendChild(b);
  }
  return row;
}

function rangeRow(key, label) {
  const row = el(`<div class="pp-row"><label for="s-${key}">${label}</label><input type="range" id="s-${key}" min="0" max="1" step="0.05"></div>`);
  const input = row.querySelector('input');
  input.value = settings[key];
  input.addEventListener('input', () => { settings[key] = parseFloat(input.value); changed(key); });
  return row;
}

function group(title, ...rows) {
  const g = el(`<div class="pp-group"><h4>${title}</h4></div>`);
  rows.forEach((r) => g.appendChild(r));
  return g;
}

function changed(key) {
  save();
  api?.onSettings(key);
}

function nextRewardText() {
  const r = REWARDS.find((x) => x.at > completedCount());
  if (!r) return 'All surprises found!';
  return `${rewardName(r)} after ${r.at} levels`;
}

export function openPanel() {
  const body = $('#pp-body');
  body.innerHTML = '';
  const done = completedCount();
  const stats = el(`<div class="pp-group"><h4>Progress</h4><div class="pp-stats">
      <div class="pp-stat"><b>${Math.min(progress.unlocked, 9999)}</b><span>Furthest level (of ${CAMPAIGN_LEVELS} + bonus)</span></div>
      <div class="pp-stat"><b>${done}</b><span>Levels completed</span></div>
      <div class="pp-stat"><b>${totalStars()}</b><span>Stars collected</span></div>
      <div class="pp-stat"><b>${progress.carsCleared}</b><span>Vehicles parked out</span></div>
      <div class="pp-stat"><b>${fmtTime(progress.day === api.today() ? progress.daySeconds : 0)}</b><span>Played today</span></div>
      <div class="pp-stat"><b>${fmtTime(progress.playSeconds)}</b><span>Played in total</span></div>
    </div><div class="pp-note">Next surprise: ${nextRewardText()}</div></div>`);
  body.appendChild(stats);

  body.appendChild(group('Sound',
    toggleRow('sfx', 'Sound effects'),
    rangeRow('sfxVol', 'Effects volume'),
    toggleRow('music', 'Music'),
    rangeRow('musicVol', 'Music volume'),
    toggleRow('voice', 'Spoken cheers', 'Uses the device voice ("Great job!")'),
    toggleRow('haptics', 'Vibration', 'On supported phones'),
  ));

  body.appendChild(group('Play',
    segRow('hints', 'Helping hand', [[0, 'Off'], [4, '4s'], [8, '8s'], [15, '15s']], 'Shows which car can go after a pause'),
    segRow('speed', 'Car speed', [[0.7, 'Slow'], [1, 'Normal'], [1.4, 'Fast']]),
    segRow('stars', 'Stars', [['gentle', 'Always 3'], ['bumps', 'Count bumps']], 'Count bumps gives fewer stars for bumping into things'),
    toggleRow('reduceMotion', 'Calmer effects', 'Less confetti and no screen shake'),
    toggleRow('showLevelNumbers', 'Show level numbers'),
  ));

  body.appendChild(group('Play time',
    segRow('timeLimit', 'Session limit', [[0, 'Off'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [45, '45'], [60, '60']], 'Minutes, then a "time for a rest" screen appears. A grown-up can continue.'),
  ));

  // Levels & unlocks
  const jump = el(`<div class="pp-row"><label for="jump-n">Jump to level<small>Skip ahead or go back</small></label>
    <input type="number" id="jump-n" min="1" max="999" inputmode="numeric"><button class="pp-btn">Go</button></div>`);
  const jn = jump.querySelector('input');
  jn.value = progress.current;
  jump.querySelector('button').addEventListener('click', () => {
    const n = Math.max(1, Math.min(999, parseInt(jn.value, 10) || 1));
    progress.current = n;
    progress.unlocked = Math.max(progress.unlocked, n);
    save();
    closePanel();
    api.startLevel(n);
  });
  body.appendChild(group('Levels & garage',
    toggleRow('unlockAll', 'Unlock all levels', 'Every level can be picked from the level map'),
    toggleRow('allVehicles', 'Unlock all vehicles', 'Fire trucks, ice cream vans & paint jobs right away'),
    jump,
  ));

  // Reset
  const resetP = el(`<div class="pp-row"><span class="lbl">Reset progress<small>Levels, stars and garage start over</small></span><button class="pp-btn danger">Reset</button></div>`);
  resetP.querySelector('button').addEventListener('click', () => {
    if (confirm('Reset all progress? Levels, stars and garage surprises will start over.')) {
      resetProgress();
      api.onReset();
      openPanel();
      api.toast('Progress reset');
    }
  });
  const resetS = el(`<div class="pp-row"><span class="lbl">Reset settings<small>Back to the defaults</small></span><button class="pp-btn ghost">Reset</button></div>`);
  resetS.querySelector('button').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      resetSettings();
      api.onSettings('*');
      openPanel();
      api.toast('Settings reset');
    }
  });
  body.appendChild(group('Reset', resetP, resetS));

  const sw = api.offlineStatus();
  body.appendChild(el(`<div class="pp-group"><h4>About</h4><div class="pp-note">
    <b>Beep Beep Jam</b> — no ads, no tracking, no in-app purchases. Everything is stored on this device only.<br><br>
    Offline: ${sw}<br>
    Install: in Safari tap Share → <i>Add to Home Screen</i>; in Chrome use the menu → <i>Install app</i>.<br><br>
    Tip: guided access (iPhone/iPad) or screen pinning (Android) keeps little hands inside the game.
    </div></div>`));

  $('#overlay-parent').classList.add('show');
  api.onPanel?.(true);
}

export function closePanel() {
  if (!$('#overlay-parent').classList.contains('show')) return;
  $('#overlay-parent').classList.remove('show');
  api?.onPanel?.(false);
}
