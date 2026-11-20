// All artwork is drawn in code (no image files) so the game is tiny and offline.

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function star(ctx, x, y, r, points = 5, inner = 0.5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr2 = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
}
export { star as starPath };

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.4, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.closePath();
}
export { heart as heartPath };

// ---------------------------------------------------------------- eyes ---

/** mood: 'idle' | 'happy' | 'oops' | 'sleep' */
export function drawEyes(ctx, cx, cy, s, mood, blink, look = 0) {
  const ex = s * 0.22;
  const r = s * 0.13;
  for (const sx of [-1, 1]) {
    const x = cx + sx * ex;
    if (mood === 'happy') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = s * 0.05;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, cy + r * 0.3, r * 0.75, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    if (mood === 'sleep' || blink) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = s * 0.045;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, cy - r * 0.2, r * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    const big = mood === 'oops' ? 1.25 : 1;
    circle(ctx, x, cy, r * big, '#fff');
    ctx.lineWidth = s * 0.025;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    const pr = mood === 'oops' ? r * 0.42 : r * 0.58;
    circle(ctx, x + look * r * 0.3, cy - r * 0.35, pr, '#1d1d2b');
    circle(ctx, x + look * r * 0.3 + pr * 0.35, cy - r * 0.35 - pr * 0.35, pr * 0.35, '#fff');
  }
}

// ------------------------------------------------------------ vehicles ---

function wheels(ctx, W, L, s, ys, big) {
  ctx.fillStyle = '#26262e';
  for (const y of ys) {
    const ww = s * (big ? 0.2 : 0.14);
    const wh = s * (big ? 0.42 : 0.3);
    rr(ctx, -W / 2 - ww * 0.45, y - wh / 2, ww, wh, ww * 0.4); ctx.fill();
    rr(ctx, W / 2 - ww * 0.55, y - wh / 2, ww, wh, ww * 0.4); ctx.fill();
  }
}

function bodyShape(ctx, W, L, r) { rr(ctx, -W / 2, -L / 2, W, L, r); }

function fillBody(ctx, W, L, r, color, s) {
  bodyShape(ctx, W, L, r);
  const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  g.addColorStop(0, shade(color, -0.12));
  g.addColorStop(0.35, shade(color, 0.12));
  g.addColorStop(1, shade(color, -0.18));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = s * 0.035;
  ctx.strokeStyle = shade(color, -0.4);
  ctx.stroke();
}

function lights(ctx, W, L, s) {
  ctx.fillStyle = '#fff6b0';
  rr(ctx, -W / 2 + s * 0.06, -L / 2 + s * 0.02, s * 0.16, s * 0.08, s * 0.04); ctx.fill();
  rr(ctx, W / 2 - s * 0.22, -L / 2 + s * 0.02, s * 0.16, s * 0.08, s * 0.04); ctx.fill();
  ctx.fillStyle = '#e63946';
  rr(ctx, -W / 2 + s * 0.06, L / 2 - s * 0.09, s * 0.14, s * 0.07, s * 0.03); ctx.fill();
  rr(ctx, W / 2 - s * 0.2, L / 2 - s * 0.09, s * 0.14, s * 0.07, s * 0.03); ctx.fill();
}

function glass(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#d9f3ff');
  g.addColorStop(1, '#8ccdf0');
  ctx.fillStyle = g;
  ctx.fill();
}

function applyPattern(ctx, v, W, L, r, s, t) {
  if (!v.pattern) return;
  ctx.save();
  bodyShape(ctx, W, L, r);
  ctx.clip();
  const p = v.pattern;
  if (p === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let y = -L / 2; y < L / 2; y += s * 0.28)
      for (let x = -W / 2 + ((y / (s * 0.28)) & 1 ? s * 0.14 : 0); x < W / 2; x += s * 0.28) circle(ctx, x, y, s * 0.07, 'rgba(255,255,255,0.75)');
  } else if (p === 'stripes') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-s * 0.13, -L / 2, s * 0.08, L);
    ctx.fillRect(s * 0.05, -L / 2, s * 0.08, L);
  } else if (p === 'hearts') {
    ctx.fillStyle = 'rgba(255,240,245,0.85)';
    for (let y = -L / 2 + s * 0.2; y < L / 2; y += s * 0.42)
      for (const x of [-W * 0.3, W * 0.3]) { heart(ctx, x, y, s * 0.1); ctx.fill(); }
  } else if (p === 'stars') {
    ctx.fillStyle = 'rgba(255,250,200,0.95)';
    for (let y = -L / 2 + s * 0.2; y < L / 2; y += s * 0.4)
      for (const x of [-W * 0.3, W * 0.3]) { star(ctx, x, y + (x > 0 ? s * 0.2 : 0), s * 0.09); ctx.fill(); }
  } else if (p === 'flames') {
    const g = ctx.createLinearGradient(0, -L / 2, 0, -L / 2 + s * 0.9);
    g.addColorStop(0, '#ffd23f');
    g.addColorStop(1, '#ff5a1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-W / 2, -L / 2);
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (W * i) / n;
      const len = s * (0.55 + 0.3 * Math.sin(i * 2.1 + t * 6));
      ctx.lineTo(x - W / n / 2, -L / 2 + len);
      ctx.lineTo(x, -L / 2 + len * 0.55);
    }
    ctx.lineTo(W / 2, -L / 2);
    ctx.closePath();
    ctx.fill();
  } else if (p === 'rainbow') {
    const cols = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ccf6e', '#3a86ff', '#9b5de5'];
    const bw = W / cols.length;
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.75; ctx.fillRect(-W / 2 + i * bw, -L / 2, bw + 0.5, L); });
    ctx.globalAlpha = 1;
  } else if (p === 'gold') {
    const g = ctx.createLinearGradient(-W / 2, -L / 2, W / 2, L / 2);
    g.addColorStop(0, '#fff1a8');
    g.addColorStop(0.4, '#f5c518');
    g.addColorStop(0.6, '#fff7c9');
    g.addColorStop(1, '#d39e00');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-W / 2, -L / 2, W, L);
    ctx.globalAlpha = 1;
    const sx = ((t * 0.6) % 2) * L - L;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(-W / 2, sx); ctx.lineTo(W / 2, sx - s * 0.3); ctx.lineTo(W / 2, sx - s * 0.1); ctx.lineTo(-W / 2, sx + s * 0.2);
    ctx.fill();
  }
  ctx.restore();
}

function crown(ctx, y, s) {
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#c99700';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  const w = s * 0.32;
  ctx.moveTo(-w / 2, y + s * 0.1);
  ctx.lineTo(-w / 2, y - s * 0.06);
  ctx.lineTo(-w / 4, y + s * 0.02);
  ctx.lineTo(0, y - s * 0.1);
  ctx.lineTo(w / 4, y + s * 0.02);
  ctx.lineTo(w / 2, y - s * 0.06);
  ctx.lineTo(w / 2, y + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  circle(ctx, 0, y - s * 0.1, s * 0.03, '#ff5a5f');
}

function lightBar(ctx, y, s, t, a = '#ff3b3b', b = '#3b7bff', active = true) {
  const on = active ? Math.floor(t * 6) % 2 : 0;
  rr(ctx, -s * 0.24, y - s * 0.06, s * 0.24, s * 0.12, s * 0.04);
  ctx.fillStyle = on ? shade(a, 0.3) : shade(a, -0.2); ctx.fill();
  rr(ctx, 0, y - s * 0.06, s * 0.24, s * 0.12, s * 0.04);
  ctx.fillStyle = on ? shade(b, -0.2) : shade(b, 0.3); ctx.fill();
  if (active) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    circle(ctx, on ? -s * 0.12 : s * 0.12, y, s * 0.3, on ? a : b);
    ctx.restore();
  }
}

/**
 * Draw a vehicle centred at 0,0 with its front pointing to -Y.
 * s = cell size in px. st = { mood, blink, t, siren }
 */
export function drawVehicle(ctx, v, s, st) {
  const len = v.len;
  const W = s * 0.78;
  const L = len * s - s * 0.2;
  const t = st.t || 0;
  const kind = v.kind || (len === 3 ? 'truck' : 'car');
  const color = v.pattern === 'gold' ? '#f5c518' : v.color || '#ff5a5f';

  // shadow
  ctx.save();
  ctx.translate(s * 0.05, s * 0.07);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rr(ctx, -W / 2, -L / 2, W, L, s * 0.25);
  ctx.fill();
  ctx.restore();

  const front = -L / 2;
  let eyeY;

  switch (kind) {
    case 'tractor': {
      ctx.fillStyle = '#26262e';
      rr(ctx, -W / 2 - s * 0.1, L / 2 - s * 0.62, s * 0.24, s * 0.55, s * 0.08); ctx.fill();
      rr(ctx, W / 2 - s * 0.14, L / 2 - s * 0.62, s * 0.24, s * 0.55, s * 0.08); ctx.fill();
      wheels(ctx, W * 0.8, L, s, [front + s * 0.35]);
      const c = '#3ccf6e';
      // hood (narrow)
      rr(ctx, -W * 0.3, front, W * 0.6, L * 0.55, s * 0.12);
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = shade(c, -0.25);
      for (let i = 0; i < 3; i++) ctx.fillRect(-W * 0.2, front + s * (0.1 + i * 0.1), W * 0.4, s * 0.03);
      // exhaust
      circle(ctx, W * 0.18, front + L * 0.45, s * 0.06, '#555');
      // cab
      rr(ctx, -W / 2, front + L * 0.5, W, L * 0.5, s * 0.14);
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.strokeStyle = '#c99700'; ctx.stroke();
      glass(ctx, -W * 0.36, front + L * 0.55, W * 0.72, L * 0.18, s * 0.06);
      eyeY = front + L * 0.64;
      break;
    }
    case 'racecar': {
      wheels(ctx, W * 0.95, L, s, [front + s * 0.3, L / 2 - s * 0.3], true);
      ctx.beginPath();
      ctx.moveTo(-W * 0.2, front);
      ctx.lineTo(W * 0.2, front);
      ctx.lineTo(W * 0.42, front + L * 0.35);
      ctx.lineTo(W * 0.42, L / 2 - s * 0.1);
      ctx.lineTo(-W * 0.42, L / 2 - s * 0.1);
      ctx.lineTo(-W * 0.42, front + L * 0.35);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = shade(color, -0.4); ctx.lineWidth = s * 0.03; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.05, front, s * 0.1, L - s * 0.1);
      // spoiler
      rr(ctx, -W / 2, L / 2 - s * 0.16, W, s * 0.14, s * 0.04); ctx.fillStyle = shade(color, -0.35); ctx.fill();
      // number
      circle(ctx, 0, front + L * 0.72, s * 0.15, '#fff');
      ctx.fillStyle = '#222';
      ctx.font = `bold ${s * 0.2}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('7', 0, front + L * 0.73);
      glass(ctx, -W * 0.3, front + L * 0.3, W * 0.6, L * 0.2, s * 0.08);
      eyeY = front + L * 0.4;
      break;
    }
    case 'truck': case 'garbage': case 'mixer': case 'icecream': case 'firetruck': case 'bus': {
      wheels(ctx, W, L, s, [front + s * 0.4, L / 2 - s * 0.35, L / 2 - s * 0.75], true);
      if (kind === 'bus') {
        fillBody(ctx, W, L, s * 0.2, '#ffc917', s);
        ctx.fillStyle = '#222';
        ctx.fillRect(-W / 2 + s * 0.02, front + s * 0.62, W - s * 0.04, s * 0.04);
        ctx.fillStyle = '#9fd8f5';
        for (let y = front + s * 0.8; y < L / 2 - s * 0.25; y += s * 0.3) {
          rr(ctx, -W / 2 + s * 0.06, y, s * 0.12, s * 0.2, s * 0.03); ctx.fill();
          rr(ctx, W / 2 - s * 0.18, y, s * 0.12, s * 0.2, s * 0.03); ctx.fill();
        }
        rr(ctx, -W * 0.25, front + s * 0.8, W * 0.5, L - s * 1.1, s * 0.06);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
        lights(ctx, W, L, s);
        glass(ctx, -W * 0.4, front + s * 0.12, W * 0.8, s * 0.42, s * 0.08);
        eyeY = front + s * 0.33;
        break;
      }
      const cabC = kind === 'firetruck' ? '#ef2b2b' : kind === 'icecream' ? '#ff8fc8' : kind === 'garbage' ? '#2fae63' : kind === 'mixer' ? '#ff9f1c' : color;
      // cargo
      const cargoTop = front + s * 0.82;
      const cargoL = L / 2 - cargoTop;
      // chassis ties cab and cargo together
      rr(ctx, -W * 0.44, front + s * 0.3, W * 0.88, L - s * 0.36, s * 0.08);
      ctx.fillStyle = '#3b3f4a';
      ctx.fill();
      if (kind === 'truck') {
        const c2 = color;
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.1);
        ctx.fillStyle = v.pattern ? '#fff' : shade(c2, 0.55); ctx.fill();
        ctx.strokeStyle = shade(c2, -0.3); ctx.lineWidth = s * 0.035; ctx.stroke();
        ctx.save();
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.1); ctx.clip();
        ctx.fillStyle = shade(c2, 0.2);
        for (let x = -W / 2 + s * 0.12; x < W / 2; x += s * 0.2) ctx.fillRect(x, cargoTop, s * 0.04, cargoL);
        if (v.pattern) { ctx.translate(0, cargoTop + cargoL / 2); applyPattern(ctx, v, W, cargoL, s * 0.1, s, t); }
        ctx.restore();
      } else if (kind === 'firetruck') {
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.1);
        ctx.fillStyle = '#d61f1f'; ctx.fill(); ctx.strokeStyle = '#8f0d0d'; ctx.lineWidth = s * 0.035; ctx.stroke();
        // ladder
        ctx.fillStyle = '#d8dde6';
        ctx.fillRect(-W * 0.28, cargoTop - s * 0.25, s * 0.06, cargoL + s * 0.15);
        ctx.fillRect(W * 0.28 - s * 0.06, cargoTop - s * 0.25, s * 0.06, cargoL + s * 0.15);
        for (let y = cargoTop - s * 0.2; y < L / 2 - s * 0.1; y += s * 0.16) ctx.fillRect(-W * 0.28, y, W * 0.56, s * 0.04);
      } else if (kind === 'icecream') {
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.14);
        ctx.fillStyle = '#fff4fa'; ctx.fill(); ctx.strokeStyle = '#e07bb0'; ctx.lineWidth = s * 0.035; ctx.stroke();
        ctx.fillStyle = '#ff8fc8';
        for (let i = 0; i < 5; i++) circle(ctx, -W / 2 + (W * (i + 0.5)) / 5, cargoTop + s * 0.02, W / 10, '#ff8fc8');
        // giant cone
        const cy = cargoTop + cargoL * 0.55;
        ctx.beginPath(); ctx.moveTo(-s * 0.14, cy); ctx.lineTo(s * 0.14, cy); ctx.lineTo(0, cy + s * 0.38); ctx.closePath();
        ctx.fillStyle = '#e8b06a'; ctx.fill();
        circle(ctx, 0, cy - s * 0.04, s * 0.16, '#b9f3ff');
        circle(ctx, -s * 0.06, cy - s * 0.14, s * 0.1, '#ff8fc8');
        circle(ctx, s * 0.06, cy - s * 0.14, s * 0.1, '#fff2a8');
        circle(ctx, 0, cy - s * 0.24, s * 0.05, '#ff3b3b');
      } else if (kind === 'garbage') {
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.08);
        ctx.fillStyle = '#4fd286'; ctx.fill(); ctx.strokeStyle = '#1f7d45'; ctx.lineWidth = s * 0.035; ctx.stroke();
        ctx.fillStyle = '#1f7d45';
        for (let y = cargoTop + s * 0.15; y < L / 2 - s * 0.1; y += s * 0.22) ctx.fillRect(-W / 2 + s * 0.05, y, W - s * 0.1, s * 0.04);
        // recycle-ish circle
        circle(ctx, 0, cargoTop + cargoL / 2, s * 0.16, '#fff');
        ctx.strokeStyle = '#2fae63'; ctx.lineWidth = s * 0.05;
        ctx.beginPath(); ctx.arc(0, cargoTop + cargoL / 2, s * 0.09, t * 2, t * 2 + 4.6); ctx.stroke();
      } else if (kind === 'mixer') {
        rr(ctx, -W / 2, cargoTop, W, cargoL, s * 0.1);
        ctx.fillStyle = '#9aa3ad'; ctx.fill();
        // spinning drum
        ctx.save();
        ctx.beginPath(); ctx.ellipse(0, cargoTop + cargoL / 2, W * 0.46, cargoL * 0.48, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#e8ecf0'; ctx.fill(); ctx.strokeStyle = '#6b7480'; ctx.lineWidth = s * 0.03; ctx.stroke();
        ctx.clip();
        ctx.fillStyle = '#ff9f1c';
        const off = (t * s * 0.8) % (s * 0.4);
        for (let y = cargoTop - s * 0.4 + off; y < L / 2 + s * 0.4; y += s * 0.4) {
          ctx.beginPath(); ctx.moveTo(-W / 2, y); ctx.lineTo(W / 2, y - s * 0.2); ctx.lineTo(W / 2, y - s * 0.08); ctx.lineTo(-W / 2, y + s * 0.12); ctx.fill();
        }
        ctx.restore();
      }
      // cab
      const cabL = s * 0.78;
      rr(ctx, -W / 2, front, W, cabL, s * 0.2);
      const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
      g.addColorStop(0, shade(cabC, -0.12)); g.addColorStop(0.35, shade(cabC, 0.15)); g.addColorStop(1, shade(cabC, -0.18));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = shade(cabC, -0.4); ctx.lineWidth = s * 0.035; ctx.stroke();
      ctx.fillStyle = '#fff6b0';
      rr(ctx, -W / 2 + s * 0.06, front + s * 0.02, s * 0.16, s * 0.08, s * 0.04); ctx.fill();
      rr(ctx, W / 2 - s * 0.22, front + s * 0.02, s * 0.16, s * 0.08, s * 0.04); ctx.fill();
      glass(ctx, -W * 0.38, front + s * 0.15, W * 0.76, s * 0.36, s * 0.08);
      if (kind === 'firetruck') lightBar(ctx, front + s * 0.62, s, t, '#ff3b3b', '#ffb020', st.siren);
      eyeY = front + s * 0.33;
      break;
    }
    default: {
      // two-cell cars: car, taxi, police, ambulance, jeep
      wheels(ctx, W, L, s, [front + s * 0.38, L / 2 - s * 0.38]);
      let c = color;
      if (kind === 'taxi') c = '#ffd23f';
      if (kind === 'police' || kind === 'ambulance') c = '#f7f9fc';
      if (kind === 'jeep') c = '#c9a46a';
      const r = kind === 'jeep' ? s * 0.12 : s * 0.3;
      fillBody(ctx, W, L, r, c, s);
      if (kind === 'car') applyPattern(ctx, v, W, L, r, s, t);
      if (kind === 'police') {
        ctx.save(); bodyShape(ctx, W, L, r); ctx.clip();
        ctx.fillStyle = '#1f2a44';
        ctx.fillRect(-W / 2, front, W, s * 0.32);
        ctx.fillRect(-W / 2, L / 2 - s * 0.32, W, s * 0.32);
        ctx.restore();
      }
      if (kind === 'ambulance') {
        ctx.save(); bodyShape(ctx, W, L, r); ctx.clip();
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(-W / 2, -s * 0.05, W, s * 0.08);
        ctx.restore();
      }
      if (kind === 'taxi') {
        ctx.save(); bodyShape(ctx, W, L, r); ctx.clip();
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#222' : '#fff';
          ctx.fillRect(-W / 2 + (W * i) / 6, s * 0.28, W / 6 + 0.5, s * 0.08);
          ctx.fillStyle = i % 2 ? '#fff' : '#222';
          ctx.fillRect(-W / 2 + (W * i) / 6, s * 0.36, W / 6 + 0.5, s * 0.08);
        }
        ctx.restore();
      }
      lights(ctx, W, L, s);
      glass(ctx, -W * 0.36, front + s * 0.22, W * 0.72, s * 0.38, s * 0.1);
      // roof
      rr(ctx, -W * 0.36, front + s * 0.66, W * 0.72, s * 0.52, s * 0.12);
      ctx.fillStyle = kind === 'jeep' ? '#8a6a3a' : 'rgba(255,255,255,0.22)';
      ctx.fill();
      glass(ctx, -W * 0.32, L / 2 - s * 0.42, W * 0.64, s * 0.2, s * 0.07);
      if (kind === 'taxi') {
        rr(ctx, -s * 0.16, front + s * 0.8, s * 0.32, s * 0.16, s * 0.04);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = s * 0.02; ctx.stroke();
        ctx.fillStyle = '#222'; ctx.font = `bold ${s * 0.1}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TAXI', 0, front + s * 0.885);
      }
      if (kind === 'police') lightBar(ctx, front + s * 0.88, s, t, '#ff3b3b', '#3b7bff', st.siren);
      if (kind === 'ambulance') {
        lightBar(ctx, front + s * 0.72, s, t, '#ff3b3b', '#ff3b3b', st.siren);
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(-s * 0.05, front + s * 0.86, s * 0.1, s * 0.3);
        ctx.fillRect(-s * 0.15, front + s * 0.96, s * 0.3, s * 0.1);
      }
      if (kind === 'jeep') {
        circle(ctx, 0, L / 2 + s * 0.02, s * 0.14, '#26262e');
        circle(ctx, 0, L / 2 + s * 0.02, s * 0.06, '#888');
      }
      eyeY = front + s * 0.42;
    }
  }

  if (v.pattern === 'crown') crown(ctx, (kind === 'car' ? front + s * 0.9 : front + s * 0.66), s);
  drawEyes(ctx, 0, eyeY, s, st.mood, st.blink, st.look || 0);
}

// ----------------------------------------------------------- obstacles ---

export function drawObstacle(ctx, type, s, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.1, s * 0.36, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  if (type === 'tree' || type === 'bush') {
    const big = type === 'tree' ? 1 : 0.8;
    const cols = type === 'tree' ? ['#2f8f46', '#3fae5a', '#64c977'] : ['#4caf50', '#6fcf72', '#9be59c'];
    circle(ctx, 0, 0, s * 0.42 * big, cols[0]);
    circle(ctx, -s * 0.1, -s * 0.08, s * 0.3 * big, cols[1]);
    circle(ctx, s * 0.1, -s * 0.12, s * 0.18 * big, cols[2]);
    if (type === 'bush') {
      circle(ctx, -s * 0.15, s * 0.12, s * 0.05, '#ff6b9a');
      circle(ctx, s * 0.18, s * 0.05, s * 0.05, '#ffd23f');
      circle(ctx, s * 0.02, -s * 0.22, s * 0.05, '#ff6b9a');
    } else {
      circle(ctx, s * 0.2, s * 0.15, s * 0.05, '#e63946');
      circle(ctx, -s * 0.2, s * 0.05, s * 0.05, '#e63946');
    }
  } else if (type === 'cone') {
    circle(ctx, 0, 0, s * 0.32, '#ff7b1c');
    circle(ctx, 0, 0, s * 0.22, '#fff');
    circle(ctx, 0, 0, s * 0.14, '#ff7b1c');
    circle(ctx, -s * 0.04, -s * 0.04, s * 0.05, '#ffb27a');
  } else if (type === 'hay') {
    rr(ctx, -s * 0.38, -s * 0.3, s * 0.76, s * 0.6, s * 0.12);
    ctx.fillStyle = '#f2c94c'; ctx.fill(); ctx.strokeStyle = '#c49a1a'; ctx.lineWidth = s * 0.03; ctx.stroke();
    ctx.strokeStyle = '#d9ab2a';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.32, i * s * 0.1); ctx.lineTo(s * 0.32, i * s * 0.1 + s * 0.03); ctx.stroke(); }
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(-s * 0.18, -s * 0.3, s * 0.05, s * 0.6);
    ctx.fillRect(s * 0.13, -s * 0.3, s * 0.05, s * 0.6);
  } else if (type === 'snowman') {
    circle(ctx, 0, s * 0.08, s * 0.34, '#fdfdff');
    ctx.strokeStyle = '#c9d6ea'; ctx.lineWidth = s * 0.03; ctx.stroke();
    circle(ctx, 0, -s * 0.12, s * 0.22, '#ffffff');
    ctx.stroke();
    circle(ctx, -s * 0.07, -s * 0.16, s * 0.03, '#222');
    circle(ctx, s * 0.07, -s * 0.16, s * 0.03, '#222');
    ctx.beginPath(); ctx.moveTo(0, -s * 0.11); ctx.lineTo(s * 0.18, -s * 0.07); ctx.lineTo(0, -s * 0.06); ctx.fillStyle = '#ff8c1a'; ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-s * 0.2, -s * 0.02, s * 0.4, s * 0.07);
    circle(ctx, 0, s * 0.15, s * 0.03, '#333');
    circle(ctx, 0, s * 0.27, s * 0.03, '#333');
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pets ---

export function drawPet(ctx, type, s, t, mood) {
  const bob = Math.sin(t * 4) * s * 0.03;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.28, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob);
  const eyes = (y, sp = 0.12, r = 0.06) => {
    for (const sx of [-1, 1]) {
      if (mood === 'happy') {
        ctx.strokeStyle = '#222'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(sx * s * sp, y + s * 0.02, s * r * 0.8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        circle(ctx, sx * s * sp, y, s * r, '#1d1d2b');
        circle(ctx, sx * s * sp + s * r * 0.35, y - s * r * 0.35, s * r * 0.35, '#fff');
      }
    }
  };
  const cheeks = (y, sp = 0.2) => {
    ctx.globalAlpha = 0.5;
    circle(ctx, -s * sp, y, s * 0.05, '#ff7aa8');
    circle(ctx, s * sp, y, s * 0.05, '#ff7aa8');
    ctx.globalAlpha = 1;
  };
  switch (type) {
    case 'duck':
    case 'chick': {
      const c = type === 'duck' ? '#fff8e0' : '#ffd93b';
      circle(ctx, 0, s * 0.08, s * 0.3, c);
      circle(ctx, 0, -s * 0.12, s * 0.22, c);
      if (type === 'chick') { ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.04, s * 0.08, 0.3, 0, Math.PI * 2); ctx.fill(); }
      eyes(-s * 0.16, 0.09);
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.06, s * 0.1, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      cheeks(-s * 0.06, 0.15);
      break;
    }
    case 'pig': {
      circle(ctx, -s * 0.2, -s * 0.24, s * 0.09, '#ff9ec2');
      circle(ctx, s * 0.2, -s * 0.24, s * 0.09, '#ff9ec2');
      circle(ctx, 0, 0, s * 0.33, '#ffb3cf');
      eyes(-s * 0.1, 0.13);
      ctx.beginPath(); ctx.ellipse(0, s * 0.07, s * 0.12, s * 0.09, 0, 0, Math.PI * 2); ctx.fillStyle = '#ff8ab4'; ctx.fill();
      circle(ctx, -s * 0.04, s * 0.07, s * 0.025, '#c2557d');
      circle(ctx, s * 0.04, s * 0.07, s * 0.025, '#c2557d');
      break;
    }
    case 'puppy': {
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.ellipse(-s * 0.28, -s * 0.02, s * 0.1, s * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.28, -s * 0.02, s * 0.1, s * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();
      circle(ctx, 0, 0, s * 0.3, '#d9a066');
      circle(ctx, s * 0.12, -s * 0.12, s * 0.1, '#f2d2a9');
      eyes(-s * 0.06, 0.12);
      ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.12, s * 0.09, 0, 0, Math.PI * 2); ctx.fillStyle = '#f2d2a9'; ctx.fill();
      circle(ctx, 0, s * 0.06, s * 0.045, '#222');
      if (mood === 'happy') { ctx.fillStyle = '#ff6b8a'; rr(ctx, -s * 0.04, s * 0.13, s * 0.08, s * 0.1, s * 0.04); ctx.fill(); }
      break;
    }
    case 'kitty': {
      ctx.fillStyle = '#9aa0ae';
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.05); ctx.lineTo(-s * 0.24, -s * 0.36); ctx.lineTo(-s * 0.05, -s * 0.22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.24, -s * 0.36); ctx.lineTo(s * 0.05, -s * 0.22); ctx.fill();
      circle(ctx, 0, 0, s * 0.3, '#b6bcc9');
      eyes(-s * 0.04, 0.12);
      ctx.beginPath(); ctx.moveTo(-s * 0.04, s * 0.06); ctx.lineTo(s * 0.04, s * 0.06); ctx.lineTo(0, s * 0.1); ctx.fillStyle = '#ff7aa8'; ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = s * 0.015;
      for (const sx of [-1, 1]) for (const dy of [0.08, 0.13]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.1, s * dy); ctx.lineTo(sx * s * 0.3, s * (dy - 0.02)); ctx.stroke(); }
      cheeks(s * 0.06, 0.18);
      break;
    }
    case 'bunny': {
      ctx.fillStyle = '#f4f0f8';
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.32, s * 0.07, s * 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.32, s * 0.07, s * 0.2, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb3cf';
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.32, s * 0.03, s * 0.13, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.32, s * 0.03, s * 0.13, 0.15, 0, Math.PI * 2); ctx.fill();
      circle(ctx, 0, s * 0.04, s * 0.27, '#fbf8ff');
      eyes(-s * 0.0, 0.11);
      circle(ctx, 0, s * 0.1, s * 0.035, '#ff7aa8');
      cheeks(s * 0.1, 0.16);
      break;
    }
    case 'penguin': {
      circle(ctx, 0, 0, s * 0.32, '#2b2f3a');
      ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 0.22, s * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      eyes(-s * 0.06, 0.1);
      ctx.beginPath(); ctx.moveTo(-s * 0.07, s * 0.02); ctx.lineTo(s * 0.07, s * 0.02); ctx.lineTo(0, s * 0.11); ctx.fillStyle = '#ff9f1c'; ctx.fill();
      cheeks(s * 0.04, 0.15);
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- hand ---

export function drawHand(ctx, x, y, s, t) {
  const press = (Math.sin(t * 6) + 1) / 2;
  ctx.save();
  ctx.translate(x + s * 0.15, y + s * 0.25 + press * s * 0.08);
  ctx.rotate(-0.35);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffe0c2';
  ctx.strokeStyle = '#5a3d2b';
  ctx.lineWidth = s * 0.035;
  // finger
  rr(ctx, -s * 0.07, -s * 0.28, s * 0.14, s * 0.4, s * 0.07); ctx.fill(); ctx.stroke();
  // palm
  rr(ctx, -s * 0.14, 0, s * 0.36, s * 0.34, s * 0.12); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (press > 0.7) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.arc(x, y, s * (0.2 + (press - 0.7)), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
