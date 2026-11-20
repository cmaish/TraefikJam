import { starPath, heartPath } from './draw.js';

const CONFETTI = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ccf6e', '#2ec4b6', '#3a86ff', '#9b5de5', '#f15bb5'];

export class FX {
  constructor() { this.p = []; this.scale = 1; }

  clear() { this.p.length = 0; }

  add(o) { if (this.p.length < 600) this.p.push({ rot: 0, vr: 0, g: 0, drag: 1, ...o, age: 0 }); }

  puff(x, y, s, n = 3) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'puff', x: x + (Math.random() - 0.5) * s * 0.3, y: y + (Math.random() - 0.5) * s * 0.3,
        vx: (Math.random() - 0.5) * s * 0.6, vy: (Math.random() - 0.5) * s * 0.6, life: 0.6 + Math.random() * 0.3, size: s * (0.12 + Math.random() * 0.1), color: 'rgba(255,255,255,0.8)' });
    }
  }

  stars(x, y, s, n = 8, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = s * (2 + Math.random() * 2.5);
      this.add({ type: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.92, life: 0.7 + Math.random() * 0.3,
        size: s * (0.1 + Math.random() * 0.08), color: color || CONFETTI[i % CONFETTI.length], vr: (Math.random() - 0.5) * 8 });
    }
  }

  hearts(x, y, s, n = 5) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'heart', x: x + (Math.random() - 0.5) * s * 0.5, y, vx: (Math.random() - 0.5) * s * 0.8, vy: -s * (1.5 + Math.random()),
        life: 1 + Math.random() * 0.4, size: s * (0.12 + Math.random() * 0.08), color: '#ff6b9a' });
    }
  }

  confetti(w, h, n = 140) {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'confetti', x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160,
        g: 120, drag: 0.995, life: 3 + Math.random() * 1.5, size: 6 + Math.random() * 8, color: CONFETTI[i % CONFETTI.length],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, wob: Math.random() * 6 });
    }
  }

  burst(x, y, n = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 350;
      this.add({ type: Math.random() < 0.3 ? 'star' : 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, g: 400, drag: 0.98,
        life: 1.5 + Math.random(), size: 7 + Math.random() * 8, color: CONFETTI[i % CONFETTI.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
    }
  }

  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const o = p[i];
      o.age += dt;
      if (o.age >= o.life) { p.splice(i, 1); continue; }
      o.vy += o.g * dt;
      o.vx *= o.drag; o.vy *= o.drag;
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.rot += o.vr * dt;
    }
  }

  draw(ctx) {
    for (const o of this.p) {
      const k = o.age / o.life;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2));
      ctx.fillStyle = o.color;
      if (o.type === 'puff') {
        ctx.beginPath(); ctx.arc(0, 0, o.size * (1 + k * 1.5), 0, Math.PI * 2); ctx.fill();
      } else if (o.type === 'star') {
        starPath(ctx, 0, 0, o.size); ctx.fill();
      } else if (o.type === 'heart') {
        heartPath(ctx, 0, 0, o.size); ctx.fill();
      } else {
        const w = Math.cos(o.age * (o.wob || 4)) * o.size;
        ctx.fillRect(-w / 2, -o.size * 0.3, w, o.size * 0.6);
      }
      ctx.restore();
    }
  }
}
