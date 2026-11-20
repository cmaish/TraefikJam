// Settings + progress, persisted in localStorage (works offline, per device).

const KEY = 'beepbeepjam.v1';

export const DEFAULT_SETTINGS = {
  sfx: true,
  sfxVol: 0.8,
  music: true,
  musicVol: 0.35,
  voice: true,
  haptics: true,
  hints: 8, // seconds idle before a helping hand appears; 0 = off
  speed: 1, // 0.7 slow, 1 normal, 1.4 fast
  stars: 'gentle', // 'gentle' = always 3 stars, 'bumps' = fewer stars for bumps
  timeLimit: 0, // minutes per session, 0 = off
  unlockAll: false,
  allVehicles: false,
  reduceMotion: false,
  showLevelNumbers: true,
};

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
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode etc. */ }
  return {};
}

const data = load();
export const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
export const progress = { ...DEFAULT_PROGRESS, ...(data.progress || {}) };
progress.stars = { ...(progress.stars || {}) };

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
