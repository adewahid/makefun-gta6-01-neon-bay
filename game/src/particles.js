// Solmar Bay — particles and transient effects: bursts, smoke, skid marks,
// tracers, explosions and floating score text. All drawn in render.js.
export function createParticles() {
  const parts = [];   // short-lived dots
  const skids = [];   // fading tyre marks
  const tracers = []; // gunshot lines
  const floats = [];  // floating text
  return {
    parts, skids, tracers, floats,
    burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 180;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, r: 2 + Math.random() * 3 });
      }
    },
    smoke(x, y) {
      parts.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20, life: 0.9, max: 0.9, color: '#888888', r: 5 + Math.random() * 4, smoke: true });
    },
    skid(x, y, angle) {
      skids.push({ x, y, angle, life: 4 });
      if (skids.length > 220) skids.shift();
    },
    tracer(x1, y1, x2, y2) {
      tracers.push({ x1, y1, x2, y2, life: 0.09 });
    },
    punch(x, y, angle) {
      parts.push({ x, y, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.18, max: 0.18, color: '#ffffff', r: 9 });
    },
    explosion(x, y) {
      this.burst(x, y, 26, '#ff7a1a');
      this.burst(x, y, 18, '#ffd24d');
      this.burst(x, y, 10, '#5a5a5a');
      for (let i = 0; i < 6; i++) this.smoke(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    },
    floatText(x, y, text, color) {
      floats.push({ x, y, text, color: color || '#ffd24d', life: 1.4 });
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        if (p.life <= 0) parts.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i--) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
      for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; if (tracers[i].life <= 0) tracers.splice(i, 1); }
      for (let i = floats.length - 1; i >= 0; i--) { floats[i].life -= dt; floats[i].y -= 26 * dt; if (floats[i].life <= 0) floats.splice(i, 1); }
    },
  };
}
