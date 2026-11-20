// Vehicle catalogue, colours, patterns and the reward (sticker) track.

export const COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ccf6e', '#2ec4b6', '#3a86ff', '#9b5de5', '#f15bb5'];

export const KINDS = {
  car: { len: 2, name: 'Car', sound: 'honk' },
  taxi: { len: 2, name: 'Taxi', sound: 'honk2' },
  police: { len: 2, name: 'Police Car', sound: 'siren' },
  racecar: { len: 2, name: 'Race Car', sound: 'race' },
  ambulance: { len: 2, name: 'Ambulance', sound: 'siren2' },
  tractor: { len: 2, name: 'Tractor', sound: 'chug' },
  jeep: { len: 2, name: 'Jeep', sound: 'honk3' },
  truck: { len: 3, name: 'Truck', sound: 'horn' },
  bus: { len: 3, name: 'School Bus', sound: 'horn' },
  firetruck: { len: 3, name: 'Fire Truck', sound: 'fire' },
  icecream: { len: 3, name: 'Ice Cream Truck', sound: 'jingle' },
  garbage: { len: 3, name: 'Garbage Truck', sound: 'reverse' },
  mixer: { len: 3, name: 'Cement Mixer', sound: 'horn' },
};

export const PATTERNS = {
  dots: 'Polka Dots', stripes: 'Racing Stripes', hearts: 'Hearts', stars: 'Stars',
  flames: 'Flames', rainbow: 'Rainbow', gold: 'Shiny Gold', crown: 'Royal Crowns',
};

export const STARTER = ['car', 'truck'];

// Rewards unlock by number of different levels completed.
export const REWARDS = [
  { at: 3, kind: 'taxi' },
  { at: 6, pattern: 'dots' },
  { at: 9, kind: 'police' },
  { at: 13, pattern: 'stripes' },
  { at: 17, kind: 'racecar' },
  { at: 21, kind: 'bus' },
  { at: 25, pattern: 'hearts' },
  { at: 30, kind: 'firetruck' },
  { at: 35, kind: 'ambulance' },
  { at: 40, pattern: 'stars' },
  { at: 45, kind: 'icecream' },
  { at: 50, kind: 'tractor' },
  { at: 56, pattern: 'flames' },
  { at: 62, kind: 'garbage' },
  { at: 68, kind: 'jeep' },
  { at: 75, kind: 'mixer' },
  { at: 83, pattern: 'rainbow' },
  { at: 95, pattern: 'gold' },
  { at: 110, pattern: 'crown' },
];

export function unlockedSet(completedCount, all = false) {
  const kinds = new Set(STARTER);
  const patterns = new Set();
  for (const r of REWARDS) {
    if (all || completedCount >= r.at) {
      if (r.kind) kinds.add(r.kind);
      if (r.pattern) patterns.add(r.pattern);
    }
  }
  return { kinds, patterns };
}

export function rewardName(r) {
  return r.kind ? KINDS[r.kind].name : PATTERNS[r.pattern];
}

/** Decorate a level's vehicles with kind/colour/pattern using a seeded rng. */
export function dressVehicles(vehicles, unlocked, rand) {
  const small = [...unlocked.kinds].filter((k) => KINDS[k].len === 2 && k !== 'car');
  const big = [...unlocked.kinds].filter((k) => KINDS[k].len === 3 && k !== 'truck');
  const pats = [...unlocked.patterns];
  let lastColor = -1;
  return vehicles.map((v) => {
    let kind;
    if (v.len === 2) kind = small.length && rand() < 0.45 ? small[Math.floor(rand() * small.length)] : 'car';
    else kind = big.length && rand() < 0.6 ? big[Math.floor(rand() * big.length)] : 'truck';
    let ci = Math.floor(rand() * COLORS.length);
    if (ci === lastColor) ci = (ci + 3) % COLORS.length;
    lastColor = ci;
    const pattern = pats.length && (kind === 'car' || kind === 'truck') && rand() < 0.35
      ? pats[Math.floor(rand() * pats.length)] : null;
    return { ...v, kind, color: COLORS[ci], color2: COLORS[(ci + 4) % COLORS.length], pattern };
  });
}
