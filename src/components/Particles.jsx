import { useEffect, useRef } from 'react';

// Animated particle layer over the background. Same skeleton as SoundWaves
// (RAF + ResizeObserver + DPR + visibility pause + ref-mirrored props) so live
// setting changes apply without restarting the loop. One effect runs at a time.

const rand = (a, b) => a + Math.random() * (b - a);
const REF_AREA = 1280 * 720; // particle counts are tuned at this CSS area
const MAX_PARTICLES = 320;

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? { r: 255, g: 255, b: 255 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Each effect: baseCount (at REF_AREA), spawn(p, w, h), step(p, env), draw(ctx, p, rgb, env).
// Positions x/y are in device px; base sizes/velocities are in CSS px (scaled by env).
const EFFECTS = {
  dust: {
    baseCount: 70,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(0, h);
      p.r = rand(6, 22);
      p.vx = rand(-8, 8);
      p.vy = rand(-8, 8);
      p.ph = rand(0, Math.PI * 2);
      p.a = rand(0.18, 0.5);
    },
    step(p, e) {
      p.x += p.vx * e.speed * e.boost * e.dt;
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.ph += e.dt * 0.6;
      wrap(p, e);
    },
    draw(ctx, p, rgb, e) {
      const r = p.r * e.size * e.boost;
      const a = p.a * (0.6 + 0.4 * Math.sin(p.ph)) * e.opacity;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
      g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  snow: {
    baseCount: 140,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(-h, h);
      p.r = rand(1.5, 4);
      p.vy = rand(20, 60);
      p.sp = rand(0, Math.PI * 2);
      p.sa = rand(8, 26);
    },
    step(p, e) {
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.x += Math.sin(e.t * 0.5 + p.sp) * p.sa * e.speed * e.dt;
      if (p.y > e.h + p.r * e.size) {
        p.y = -p.r * e.size;
        p.x = rand(0, e.w);
      }
    },
    draw(ctx, p, rgb, e) {
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * e.size * e.boost, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  petals: {
    baseCount: 60,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(-h, h);
      p.r = rand(5, 11);
      p.vy = rand(25, 60);
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-2, 2);
      p.sp = rand(0, Math.PI * 2);
      p.sa = rand(20, 50);
    },
    step(p, e) {
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.x += Math.sin(e.t * 0.7 + p.sp) * p.sa * e.speed * e.dt;
      p.rot += p.vr * e.dt;
      if (p.y > e.h + p.r * e.size * 2) {
        p.y = -p.r * e.size * 2;
        p.x = rand(0, e.w);
      }
    },
    draw(ctx, p, rgb, e) {
      const r = p.r * e.size * e.boost;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  stars: {
    baseCount: 160,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(0, h);
      p.r = rand(0.6, 2.2);
      p.vx = rand(-3, 3);
      p.tp = rand(0, Math.PI * 2);
      p.ts = rand(0.5, 2);
    },
    step(p, e) {
      p.x += p.vx * e.speed * e.dt;
      p.tp += e.dt * p.ts * e.boost;
      wrap(p, e);
    },
    draw(ctx, p, rgb, e) {
      const a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.tp))) * e.opacity;
      glowDot(ctx, p.x, p.y, Math.max(p.r * e.size * 2.4, 1.6), rgb, a);
    },
  },

  fireflies: {
    baseCount: 45,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(0, h);
      p.r = rand(1.5, 3.5);
      p.vx = rand(-15, 15);
      p.vy = rand(-15, 15);
      p.bp = rand(0, Math.PI * 2);
      p.bs = rand(0.5, 1.5);
    },
    step(p, e) {
      // Gentle random walk.
      p.vx += rand(-30, 30) * e.dt;
      p.vy += rand(-30, 30) * e.dt;
      p.vx = Math.max(-25, Math.min(25, p.vx));
      p.vy = Math.max(-25, Math.min(25, p.vy));
      p.x += p.vx * e.speed * e.boost * e.dt;
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.bp += e.dt * p.bs;
      wrap(p, e);
    },
    draw(ctx, p, rgb, e) {
      const a = (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(p.bp))) * e.opacity;
      const r = p.r * e.size * e.boost;
      glowDot(ctx, p.x, p.y, r * 2.8, rgb, a);
    },
  },

  notes: {
    baseCount: 36,
    glyphs: ['♪', '♫', '♬'],
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(0, h * 1.5);
      p.r = rand(14, 30);
      p.vy = rand(-25, -55);
      p.sp = rand(0, Math.PI * 2);
      p.sa = rand(15, 40);
      p.glyph = EFFECTS.notes.glyphs[(Math.random() * 3) | 0];
    },
    step(p, e) {
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.x += Math.sin(e.t + p.sp) * p.sa * e.speed * e.dt;
      if (p.y < -p.r * e.size * 2) {
        p.y = e.h + p.r * e.size * 2;
        p.x = rand(0, e.w);
      }
    },
    draw(ctx, p, rgb, e) {
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
      ctx.font = `${p.r * e.size * e.boost}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.glyph, p.x, p.y);
    },
  },

  embers: {
    baseCount: 70,
    spawn(p, w, h) {
      p.x = rand(0, w);
      p.y = rand(0, h * 1.4);
      p.r = rand(1.5, 4);
      p.vy = rand(-30, -70);
      p.vx = rand(-10, 10);
      p.fp = rand(0, Math.PI * 2);
      p.fs = rand(3, 7);
    },
    step(p, e) {
      p.y += p.vy * e.speed * e.boost * e.dt;
      p.x += (p.vx * e.speed + Math.sin(e.t * 2 + p.fp) * 10) * e.dt;
      p.fp += e.dt * p.fs;
      if (p.y < -p.r * e.size * 2) {
        p.y = e.h + p.r * e.size * 2;
        p.x = rand(0, e.w);
      }
    },
    draw(ctx, p, rgb, e) {
      const a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.fp))) * e.opacity;
      const r = p.r * e.size * e.boost;
      glowDot(ctx, p.x, p.y, r * 2.4, rgb, a);
    },
  },
};

// Soft glowing dot via a radial gradient — much cheaper than ctx.shadowBlur per particle.
function glowDot(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
  g.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.55})`);
  g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Wrap a particle around the canvas edges (for drifting effects).
function wrap(p, e) {
  const m = (p.r || 4) * e.size + 4;
  if (p.x < -m) p.x = e.w + m;
  else if (p.x > e.w + m) p.x = -m;
  if (p.y < -m) p.y = e.h + m;
  else if (p.y > e.h + m) p.y = -m;
}

export default function Particles({ getPulse, type, density = 1, speed = 1, size = 1, opacity = 1, color = '#ffffff', beat = false }) {
  const canvasRef = useRef(null);
  const refs = useRef({});
  refs.current = { getPulse, type, density, speed, size, opacity, color, beat };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Cap backing-store resolution (see SoundWaves) so fullscreen doesn't balloon pixel count.
    const MAX_DIM = 1920;
    const dpr = () => {
      const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const longest = Math.max(canvas.clientWidth, canvas.clientHeight) || 1;
      return longest * baseDpr > MAX_DIM ? Math.max(0.75, MAX_DIM / longest) : baseDpr;
    };

    let raf = 0;
    let running = true;
    let particles = [];
    let lastType = null;
    let boost = 1;
    let lastTime = performance.now();

    function resize() {
      canvas.width = Math.round(canvas.clientWidth * dpr());
      canvas.height = Math.round(canvas.clientHeight * dpr());
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame() {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = refs.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const effect = EFFECTS[s.type];
      if (!effect) {
        // 'none' (or unknown) — nothing to draw, but keep the loop cheap & alive.
        raf = requestAnimationFrame(frame);
        return;
      }

      if (s.type !== lastType) {
        particles = [];
        lastType = s.type;
      }

      // Reconcile particle count to the target without resetting existing ones.
      const area = canvas.clientWidth * canvas.clientHeight;
      const target = Math.max(
        0,
        Math.min(MAX_PARTICLES, Math.round(effect.baseCount * s.density * (area / REF_AREA))),
      );
      while (particles.length < target) {
        const p = {};
        effect.spawn(p, w, h);
        particles.push(p);
      }
      if (particles.length > target) particles.length = target;

      // Smooth the beat boost.
      const pulse = s.beat && s.getPulse ? s.getPulse() : null;
      const targetBoost = pulse && pulse.isPlaying ? 1 + pulse.value * 0.6 : 1;
      boost += (targetBoost - boost) * 0.15;

      const scale = dpr();
      const env = {
        w,
        h,
        dt,
        t: now / 1000,
        speed: s.speed * scale,
        size: s.size * scale,
        opacity: s.opacity,
        boost,
      };

      for (const p of particles) effect.step(p, env);
      for (const p of particles) effect.draw(ctx, p, hexToRgb(s.color), env);

      raf = requestAnimationFrame(frame);
    }
    frame();

    const onVisible = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        lastTime = performance.now();
        frame();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return <canvas ref={canvasRef} className="particles" />;
}
