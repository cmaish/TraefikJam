// Every sound is synthesised with Web Audio — no audio files, fully offline.

let ctx = null;
let master, sfxBus, musicBus;
let noiseBuf = null;
const state = { sfx: true, music: true, sfxVol: 0.8, musicVol: 0.35, voice: true };

export function configure(opts) {
  Object.assign(state, opts);
  if (!ctx) return;
  sfxBus.gain.value = state.sfx ? state.sfxVol : 0;
  musicBus.gain.value = state.music ? state.musicVol * 0.5 : 0;
  if (state.music) startMusic(); else stopMusic();
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    configure({});
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

const now = () => ctx.currentTime;
const ok = () => ctx && state.sfx && ctx.state === 'running';

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.2, vol = 0.3, a = 0.01, filter = null, q = 1, bus = sfxBus, vib = 0 }) {
  const st = now() + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, st);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, st + dur);
  let node = o;
  if (vib) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vib;
    lg.gain.value = f * 0.04;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(st);
    lfo.stop(st + dur + 0.05);
  }
  if (filter) {
    const fl = ctx.createBiquadFilter();
    fl.type = filter.type || 'lowpass';
    fl.frequency.value = filter.f;
    fl.Q.value = q;
    node.connect(fl);
    node = fl;
  }
  node.connect(g).connect(bus);
  env(g, st, a, vol, dur);
  o.start(st);
  o.stop(st + a + dur + 0.05);
}

function noise({ t = 0, dur = 0.2, vol = 0.2, f = 1000, type = 'bandpass', q = 1, f2 = null }) {
  const st = now() + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, st);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, st + dur);
  fl.Q.value = q;
  const g = ctx.createGain();
  src.connect(fl).connect(g).connect(sfxBus);
  env(g, st, 0.01, vol, dur);
  src.start(st, Math.random() * 0.5);
  src.stop(st + dur + 0.05);
}

const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  tap() { if (!ok()) return; tone({ type: 'sine', f: 660, f2: 990, dur: 0.08, vol: 0.18 }); },
  pop() { if (!ok()) return; tone({ type: 'sine', f: 400, f2: 1200, dur: 0.1, vol: 0.25 }); },
  vroom(big) {
    if (!ok()) return;
    const b = big ? 0.7 : 1;
    tone({ type: 'sawtooth', f: 70 * b, f2: 210 * b, dur: 0.45, vol: 0.16, a: 0.02, filter: { f: 900 }, q: 4 });
    tone({ type: 'square', f: 50 * b, f2: 120 * b, dur: 0.4, vol: 0.08, a: 0.02, filter: { f: 500 } });
    noise({ dur: 0.35, vol: 0.06, f: 600, f2: 2000 });
  },
  honk(kind) {
    if (!ok()) return;
    const sound = kindSounds[kind] || kindSounds.car;
    sound();
  },
  bump() {
    if (!ok()) return;
    tone({ type: 'sine', f: 320, f2: 110, dur: 0.25, vol: 0.32 });
    tone({ type: 'triangle', f: 180, f2: 90, dur: 0.18, vol: 0.2, t: 0.02 });
  },
  boing() {
    if (!ok()) return;
    tone({ type: 'sine', f: 200, f2: 500, dur: 0.18, vol: 0.25, vib: 18 });
  },
  exit(i = 0) {
    if (!ok()) return;
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const base = 392 * Math.pow(2, steps[i % steps.length] / 12);
    tone({ type: 'triangle', f: base, dur: 0.18, vol: 0.18, t: 0.12 });
    tone({ type: 'sine', f: base * 2, dur: 0.25, vol: 0.1, t: 0.15 });
  },
  star(i) {
    if (!ok()) return;
    const f = [784, 988, 1175][i] || 1175;
    tone({ type: 'triangle', f, dur: 0.35, vol: 0.25 });
    tone({ type: 'sine', f: f * 2, dur: 0.4, vol: 0.1, t: 0.02 });
  },
  win() {
    if (!ok()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const ts = [0, 0.12, 0.24, 0.36, 0.52, 0.64];
    notes.forEach((f, i) => {
      tone({ type: 'triangle', f, t: ts[i], dur: i === 5 ? 0.6 : 0.16, vol: 0.25 });
      tone({ type: 'square', f: f / 2, t: ts[i], dur: 0.12, vol: 0.05, filter: { f: 1200 } });
    });
    for (let i = 0; i < 8; i++) tone({ type: 'sine', f: rnd(1500, 3000), t: 0.7 + i * 0.05, dur: 0.15, vol: 0.05 });
  },
  unlock() {
    if (!ok()) return;
    for (let i = 0; i < 12; i++) tone({ type: 'sine', f: 400 * Math.pow(2, i / 7), t: i * 0.05, dur: 0.25, vol: 0.12 });
    tone({ type: 'triangle', f: 1046.5, t: 0.65, dur: 0.8, vol: 0.2 });
    tone({ type: 'triangle', f: 1318.5, t: 0.65, dur: 0.8, vol: 0.15 });
  },
  whoosh() { if (!ok()) return; noise({ dur: 0.4, vol: 0.12, f: 400, f2: 3000, q: 2 }); },
  animal(type) {
    if (!ok()) return;
    (animalSounds[type] || animalSounds.chick)();
  },
  yawn() {
    if (!ok()) return;
    tone({ type: 'sine', f: 300, f2: 180, dur: 1.2, vol: 0.2, vib: 5 });
  },
};

const kindSounds = {
  car() { tone({ type: 'square', f: 440, dur: 0.12, vol: 0.12, filter: { f: 1800 } }); tone({ type: 'square', f: 554, dur: 0.12, vol: 0.1, filter: { f: 1800 } });
    tone({ type: 'square', f: 440, t: 0.18, dur: 0.14, vol: 0.12, filter: { f: 1800 } }); tone({ type: 'square', f: 554, t: 0.18, dur: 0.14, vol: 0.1, filter: { f: 1800 } }); },
  honk2() { tone({ type: 'square', f: 523, dur: 0.1, vol: 0.12, filter: { f: 2200 } }); tone({ type: 'square', f: 659, t: 0.14, dur: 0.18, vol: 0.12, filter: { f: 2200 } }); },
  honk3() { tone({ type: 'sawtooth', f: 330, dur: 0.25, vol: 0.12, filter: { f: 1400 } }); tone({ type: 'sawtooth', f: 415, dur: 0.25, vol: 0.1, filter: { f: 1400 } }); },
  horn() { tone({ type: 'sawtooth', f: 196, dur: 0.5, vol: 0.14, filter: { f: 1100 } }); tone({ type: 'sawtooth', f: 247, dur: 0.5, vol: 0.12, filter: { f: 1100 } }); tone({ type: 'sawtooth', f: 294, dur: 0.5, vol: 0.1, filter: { f: 1100 } }); },
  siren() { for (let i = 0; i < 4; i++) tone({ type: 'triangle', f: i % 2 ? 950 : 700, t: i * 0.22, dur: 0.2, vol: 0.14 }); },
  siren2() { for (let i = 0; i < 4; i++) tone({ type: 'triangle', f: i % 2 ? 660 : 880, t: i * 0.3, dur: 0.28, vol: 0.14 }); },
  fire() { tone({ type: 'sawtooth', f: 500, f2: 1100, dur: 0.6, vol: 0.1, filter: { f: 2500 } }); tone({ type: 'sawtooth', f: 1100, f2: 500, t: 0.6, dur: 0.6, vol: 0.1, filter: { f: 2500 } }); },
  race() { tone({ type: 'sawtooth', f: 150, f2: 900, dur: 0.6, vol: 0.12, filter: { f: 2500 }, q: 3 }); },
  chug() { for (let i = 0; i < 5; i++) { tone({ type: 'square', f: 70, dur: 0.07, t: i * 0.13, vol: 0.18, filter: { f: 400 } }); noise({ t: i * 0.13, dur: 0.06, vol: 0.08, f: 300 }); } },
  jingle() { [784, 659, 784, 880, 784, 659, 523].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.13, dur: 0.12, vol: 0.18 })); },
  reverse() { for (let i = 0; i < 3; i++) tone({ type: 'square', f: 1000, t: i * 0.3, dur: 0.15, vol: 0.08, filter: { f: 2000 } }); },
};

const animalSounds = {
  duck() { for (let i = 0; i < 2; i++) { tone({ type: 'sawtooth', f: 520, f2: 330, t: i * 0.22, dur: 0.15, vol: 0.18, filter: { type: 'bandpass', f: 1200 }, q: 3 }); } },
  chick() { for (let i = 0; i < 3; i++) tone({ type: 'sine', f: 2200, f2: 3200, t: i * 0.12, dur: 0.07, vol: 0.14 }); },
  pig() { for (let i = 0; i < 2; i++) { tone({ type: 'sawtooth', f: 180, f2: 120, t: i * 0.25, dur: 0.16, vol: 0.2, filter: { type: 'bandpass', f: 700 }, q: 4 }); noise({ t: i * 0.25, dur: 0.14, vol: 0.06, f: 500 }); } },
  puppy() { for (let i = 0; i < 2; i++) { tone({ type: 'sawtooth', f: 600, f2: 350, t: i * 0.25, dur: 0.1, vol: 0.2, filter: { type: 'bandpass', f: 1000 }, q: 2 }); noise({ t: i * 0.25, dur: 0.08, vol: 0.12, f: 1200 }); } },
  kitty() { tone({ type: 'sawtooth', f: 600, f2: 900, dur: 0.25, vol: 0.12, filter: { type: 'bandpass', f: 1500 }, q: 3, vib: 6 }); tone({ type: 'sawtooth', f: 900, f2: 550, t: 0.25, dur: 0.3, vol: 0.12, filter: { type: 'bandpass', f: 1500 }, q: 3 }); },
  bunny() { tone({ type: 'sine', f: 600, f2: 1400, dur: 0.12, vol: 0.18 }); tone({ type: 'sine', f: 700, f2: 1600, t: 0.16, dur: 0.12, vol: 0.18 }); },
  penguin() { for (let i = 0; i < 3; i++) tone({ type: 'square', f: 400, f2: 650, t: i * 0.14, dur: 0.1, vol: 0.1, filter: { type: 'bandpass', f: 900 }, q: 2 }); },
};

// ----------------------------------------------------------- music ---
// A gentle, looping tune scheduled ahead of time.

let musicTimer = null;
let nextNote = 0;
let step = 0;
const BPM = 96;
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
// chord roots: C, Am, F, G
const ROOTS = [130.81, 110.0, 87.31, 98.0];
const MELODY = [
  [4, -1, 2, -1, 3, 4, 5, -1, 4, -1, 2, -1, 1, -1, -1, -1],
  [2, -1, 0, -1, 1, 2, 4, -1, 2, -1, 1, -1, 0, -1, -1, -1],
  [3, -1, 5, -1, 4, 3, 2, -1, 3, -1, 4, -1, 5, -1, -1, -1],
  [4, -1, 6, -1, 5, 4, 3, -1, 1, -1, 2, -1, 4, -1, -1, -1],
];

function scheduleMusic() {
  if (!ctx) return;
  const spb = 60 / BPM / 2; // eighth notes
  while (nextNote < ctx.currentTime + 0.3) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const n = MELODY[bar][s];
    const t = nextNote - ctx.currentTime;
    if (n >= 0) tone({ type: 'triangle', f: SCALE[n], t, dur: spb * 1.6, vol: 0.12, bus: musicBus });
    if (s % 4 === 0) tone({ type: 'sine', f: ROOTS[bar], t, dur: spb * 3, vol: 0.18, bus: musicBus });
    if (s % 4 === 2) tone({ type: 'sine', f: ROOTS[bar] * 1.5, t, dur: spb * 1.5, vol: 0.08, bus: musicBus });
    nextNote += spb;
    step++;
  }
}

function startMusic() {
  if (!ctx || musicTimer) return;
  nextNote = ctx.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 100);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

// ----------------------------------------------------------- voice ---

const CHEERS = ['Yay!', 'Great job!', 'You did it!', 'Hooray!', 'Super!', 'Beep beep, hooray!', 'Wow!', 'Well done!'];

export function say(text) {
  if (!state.voice || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.4;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* voices unavailable offline on some devices — stay quiet */ }
}

export function cheer() { say(CHEERS[Math.floor(Math.random() * CHEERS.length)]); }
