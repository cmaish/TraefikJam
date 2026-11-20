// Settings + progress, persisted in localStorage (works offline, per device).

const KEY = 'beepbeepjam.v1';

export const DEFAULT_SETTINGS = {
  schema: 2,
  sfx: true,
  sfxVol: 0.8,
  music: true,
  musicVol: 0.3,
  voice: false,
  haptics: true,
  hints: 0, // seconds idle before the helping hand appears on its own; 0 = only via the hint button
  speed: 1, // 0.7 slow, 1 normal, 1.4 fast
  stars: 'bumps', // 'bumps' = fewer stars for bumping, 'gentle' = always 3 stars
  faces: false, // cartoon eyes on vehicles
  realistic: false, // use the realistic (Kenney Car Kit) models instead of toy-style ones
  kidMode: false,
  parentLock: false, // require a grown-up check before opening settings
  timeLimit: 0, // minutes per session, 0 = off
  unlockAll: false,
  allVehicles: false,
  reduceMotion: false,
  showLevelNumbers: true,
};

// What "Kid mode" switches on and off in one go.
export const KID_PRESET = { on: { faces: true, stars: 'gentle', hints: 5, speed: 0.8, voice: true }, off: { faces: false, stars: 'bumps', hints: 0, speed: 1, voice: false } };

export function setKidMode(on) {
  settings.kidMode = on;
  Object.assign(settings, on ? KID_PRESET.on : KID_PRESET.off);
  save();
}

const DEFAULT_PROGRESS = {
  unlocked: 1, // highest level number that may be played
  current: 1, // level "Play" continues from
  stars: {}, // level -> best stars
  carsCleared: 0,
  bumps: 0,
  playSeconds: 0,
  daySeconds: 0,
  day: '',
  rewardsSeen: 0, // number of rewards already revealed
  firstPlayed: null,
  daily: {}, // 'YYYY-M-D' -> stars
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode etc. */ }
  return {};
}

const data = load();
const saved = data.settings || {};
if (saved.schema !== DEFAULT_SETTINGS.schema) {
  // v1 was toddler-first; adopt the new defaults for the gameplay feel but keep sound choices.
  for (const k of ['voice', 'hints', 'stars', 'schema']) delete saved[k];
}
export const settings = { ...DEFAULT_SETTINGS, ...saved };
export const progress = { ...DEFAULT_PROGRESS, ...(data.progress || {}) };
progress.stars = { ...(progress.stars || {}) };
progress.daily = { ...(progress.daily || {}) };

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ settings, progress }));
  } catch { /* ignore quota / private mode */ }
}

export function completedCount() {
  return Object.keys(progress.stars).length;
}

export function totalStars() {
  return Object.values(progress.stars).reduce((a, b) => a + b, 0);
}

export function resetProgress() {
  for (const k of Object.keys(progress)) delete progress[k];
  Object.assign(progress, structuredClone(DEFAULT_PROGRESS));
  save();
}

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  save();
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function addPlayTime(sec) {
  const t = today();
  if (progress.day !== t) { progress.day = t; progress.daySeconds = 0; }
  progress.playSeconds += sec;
  progress.daySeconds += sec;
}
