// 2D overlay helpers (hint hand, star & heart shapes for particles).

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
