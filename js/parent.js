// Settings panel, plus an optional grown-up check (a simple sum) in front of it.
import { settings, progress, save, completedCount, totalStars, resetProgress, resetSettings, setKidMode } from './storage.js';
import { CAMPAIGN_LEVELS } from './levels.js';
import { REWARDS, rewardName } from './vehicles.js';

const $ = (s) => document.querySelector(s);
let api = null;

export function initParent(hooks) {
  api = hooks;
  $('#gate-cancel').addEventListener('click', closeGate);
  $('#pp-close').addEventListener('click', closePanel);
  $('#overlay-parent').addEventListener('click', (e) => { if (e.target.id === 'overlay-parent') closePanel(); });
}

/** Open settings, asking the grown-up question first when the lock is on. */
export function requestSettings() {
  if (settings.parentLock) openGate(openPanel);
  else openPanel();
}

// ------------------------------------------------------------- gate ---

let gateCb = null;
export function openGate(cb) {
  gateCb = cb;
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 4 + Math.floor(Math.random() * 6);
  const ans = a * b > 40 ? a + b : a * b;
  const q = a * b > 40 ? `${a} + ${b}` : `${a} × ${b}`;
  const opts = new Set([ans]);
  while (opts.size < 4) {
    const d = ans + Math.floor(Math.random() * 11) - 5;
    if (d > 1 && d !== ans) opts.add(d);
  }
  $('#gate-q').textContent = `${q} = ?`;
  const box = $('#gate-answers');
  box.innerHTML = '';
  [...opts].sort(() => Math.random() - 0.5).forEach((n) => {
    const bt = document.createElement('button');
    bt.textContent = n;
    bt.addEventListener('click', () => {
      closeGate();
      if (n === ans) gateCb && gateCb();
      else api?.toast('Not quite. Try again.');
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

function toggleRow(key, label, note = '', onChange) {
  const row = el(`<div class="pp-row"><label for="s-${key}">${label}${note ? `<small>${note}</small>` : ''}</label>
    <span class="switch"><input type="checkbox" role="switch" id="s-${key}"><span></span></span></div>`);
  const input = row.querySelector('input');
  input.checked = !!settings[key];
  input.addEventListener('change', () => {
    if (onChange) onChange(input.checked);
    else settings[key] = input.checked;
    changed(key);
  });
  return row;
}

function segRow(key, label, options, note = '') {
  const row = el(`<div class="pp-row stack"><span class="lbl">${label}${note ? `<small>${note}</small>` : ''}</span><div class="seg" role="radiogroup"></div></div>`);
  const seg = row.querySelector('.seg');
  const sync = () => seg.querySelectorAll('button').forEach((x) => {
    const on = x.dataset.val === String(settings[key]);
    x.classList.toggle('on', on);
    x.setAttribute('aria-checked', on);
  });
  for (const [val, text] of options) {
    const b = document.createElement('button');
    b.textContent = text;
    b.setAttribute('role', 'radio');
    b.dataset.val = String(val);
    b.addEventListener('click', () => { settings[key] = val; sync(); changed(key); });
    seg.appendChild(b);
  }
  sync();
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

// Two-tap confirm (window.confirm is unavailable in some embedded views).
function confirmButton(btn, label, action) {
  let armed = null;
  const original = btn.textContent;
  btn.addEventListener('click', () => {
    if (armed) { clearTimeout(armed); armed = null; btn.textContent = original; btn.classList.remove('armed'); action(); return; }
    btn.textContent = label;
    btn.classList.add('armed');
    armed = setTimeout(() => { armed = null; btn.textContent = original; btn.classList.remove('armed'); }, 3000);
  });
}

function changed(key) {
  save();
  api?.onSettings(key);
}

function nextRewardText() {
  const r = REWARDS.find((x) => x.at > completedCount());
  if (!r) return 'Everything unlocked!';
  return `${rewardName(r)} at ${r.at} levels completed`;
}

export function openPanel() {
  const body = $('#pp-body');
  const scroll = body.scrollTop;
  body.innerHTML = '';
  const done = completedCount();
  body.appendChild(el(`<div class="pp-group"><h4>Progress</h4><div class="pp-stats">
      <div class="pp-stat"><b>${done}</b><span>Levels completed</span></div>
      <div class="pp-stat"><b>${totalStars()}</b><span>Stars</span></div>
      <div class="pp-stat"><b>${Math.min(progress.unlocked, 9999)}</b><span>Furthest level (${CAMPAIGN_LEVELS} + bonus)</span></div>
      <div class="pp-stat"><b>${progress.carsCleared}</b><span>Vehicles cleared</span></div>
      <div class="pp-stat"><b>${fmtTime(progress.day === api.today() ? progress.daySeconds : 0)}</b><span>Played today</span></div>
      <div class="pp-stat"><b>${fmtTime(progress.playSeconds)}</b><span>Played in total</span></div>
    </div><div class="pp-note">Next unlock: ${nextRewardText()}</div></div>`));

  body.appendChild(group('Sound',
    toggleRow('sfx', 'Sound effects'),
    rangeRow('sfxVol', 'Effects volume'),
    toggleRow('music', 'Music'),
    rangeRow('musicVol', 'Music volume'),
    toggleRow('voice', 'Spoken cheers', 'Uses the device voice'),
    toggleRow('haptics', 'Vibration', 'On phones that support it'),
  ));

  body.appendChild(group('Gameplay',
    toggleRow('kidMode', 'Kid mode', 'Cartoon faces, always 3 stars, slower cars, automatic hints and spoken cheers', (on) => { setKidMode(on); setTimeout(openPanel, 0); }),
    segRow('hints', 'Automatic hint', [[0, 'Off'], [5, '5 s'], [10, '10 s'], [20, '20 s']], 'Highlights a car that can leave after a pause. The bulb button always works.'),
    segRow('speed', 'Car speed', [[0.7, 'Slow'], [1, 'Normal'], [1.4, 'Fast']]),
    segRow('stars', 'Stars', [['bumps', 'Fewer for bumps'], ['gentle', 'Always 3']]),
    toggleRow('faces', 'Cartoon faces on vehicles', 'Takes effect from the next level'),
    toggleRow('reduceMotion', 'Calmer effects', 'Less confetti, no screen shake'),
    toggleRow('showLevelNumbers', 'Show level numbers'),
  ));

  body.appendChild(group('Parental controls',
    toggleRow('parentLock', 'Lock settings', 'Asks a quick sum before settings open, so little ones can’t change things'),
    segRow('timeLimit', 'Play-time limit', [[0, 'Off'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [45, '45'], [60, '60']], 'Minutes per session. Then a “time for a rest” screen appears.'),
  ));

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
    toggleRow('unlockAll', 'Unlock all levels'),
    toggleRow('allVehicles', 'Unlock all vehicles & paint'),
    jump,
  ));

  const resetP = el(`<div class="pp-row"><span class="lbl">Reset progress<small>Levels, stars and unlocks start over</small></span><button class="pp-btn danger">Reset</button></div>`);
  confirmButton(resetP.querySelector('button'), 'Tap to confirm', () => {
    resetProgress();
    api.onReset();
    openPanel();
    api.toast('Progress reset');
  });
  const resetS = el(`<div class="pp-row"><span class="lbl">Reset settings<small>Back to the defaults</small></span><button class="pp-btn ghost">Reset</button></div>`);
  confirmButton(resetS.querySelector('button'), 'Tap to confirm', () => {
    resetSettings();
    api.onSettings('*');
    openPanel();
    api.toast('Settings reset');
  });
  body.appendChild(group('Reset', resetP, resetS));

  body.appendChild(el(`<div class="pp-group"><h4>About</h4><div class="pp-note">
    <b>Beep Beep Jam</b>: no ads, no tracking, no purchases. Progress is saved on this device only.<br>
    Offline play: ${api.offlineStatus()}<br>
    Install: Safari → Share → <i>Add to Home Screen</i>; Chrome → menu → <i>Install app</i>.
    </div></div>`));

  $('#overlay-parent').classList.add('show');
  body.scrollTop = scroll;
  api.onPanel?.(true);
}

export function closePanel() {
  if (!$('#overlay-parent').classList.contains('show')) return;
  $('#overlay-parent').classList.remove('show');
  api?.onPanel?.(false);
}
