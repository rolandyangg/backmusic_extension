import { useEffect, useRef } from 'react';

// Canvas sound-wave animation. Reads the beat engine's getPulse() every frame
// (so it never re-renders React), draws layered organic rings sized by the pulse,
// and emits an expanding ripple on each beat. Amplitude eases down when paused;
// the RAF loop stops entirely when the tab is hidden.
export default function SoundWaves({ getPulse, sizeMul = 1, opacityMul = 1, glowMul = 1 }) {
  const canvasRef = useRef(null);
  const getPulseRef = useRef(getPulse);
  getPulseRef.current = getPulse;
  // Mirror live settings into refs so the RAF loop reads current values.
  const sizeRef = useRef(sizeMul);
  sizeRef.current = sizeMul;
  const opacityRef = useRef(opacityMul);
  opacityRef.current = opacityMul;
  const glowRef = useRef(glowMul);
  glowRef.current = glowMul;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0;
    let running = true;
    let amp = 0; // smoothed amplitude
    let lastPhase = 1;
    let ripples = [];

    function resize() {
      canvas.width = canvas.clientWidth * dpr();
      canvas.height = canvas.clientHeight * dpr();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame() {
      if (!running) return;
      const p = getPulseRef.current();
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h);
      const t = performance.now() / 1000;
      const scale = dpr();

      // Collapse amplitude toward 0 when paused, ease toward the pulse otherwise.
      const target = p.isPlaying ? p.value : 0;
      amp += (target - amp) * 0.12;

      // Emit a ripple at each beat onset (phase wrap-around) while actively beating.
      if (p.mode === 'beat' && p.isPlaying && p.beatPhase < lastPhase - 0.3) {
        ripples.push({ r: base * 0.17 * sizeRef.current, life: 1 });
      }
      lastPhase = p.beatPhase;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const hueBase = (t * 6) % 360;
      const sizeMul = sizeRef.current;
      const opacityMul = opacityRef.current;
      const glowMul = glowRef.current;
      const RINGS = 4;
      for (let i = 0; i < RINGS; i++) {
        const ringR = base * (0.15 + i * 0.05) * (1 + amp * 0.5) * sizeMul;
        const wobble = base * 0.02 * (0.5 + amp) * sizeMul;
        const segs = 120;
        ctx.beginPath();
        for (let a = 0; a <= segs; a++) {
          const ang = (a / segs) * Math.PI * 2;
          const pert =
            Math.sin(ang * (3 + i) + t * (1.2 + i * 0.3)) * wobble +
            Math.sin(ang * (5 + i) - t * 0.8) * wobble * 0.5;
          const r = ringR + pert + amp * base * 0.04 * sizeMul * Math.sin(ang * 2 + t);
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const hue = (hueBase + i * 28) % 360;
        // A touch of glow helps the lines read against busy/bright backgrounds.
        ctx.shadowBlur = scale * (6 + amp * 14) * glowMul;
        ctx.shadowColor = `hsla(${hue}, 85%, 62%, 0.7)`;
        ctx.strokeStyle = `hsla(${hue}, 75%, 68%, ${(0.19 + amp * 0.33) * opacityMul})`;
        ctx.lineWidth = scale * (2 + i * 0.7);
        ctx.stroke();
      }

      ripples = ripples.filter((r) => r.life > 0);
      for (const ring of ripples) {
        ring.r += base * 0.006 * sizeMul;
        ring.life -= 0.018;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.shadowBlur = scale * 9 * glowMul;
        ctx.shadowColor = `hsla(${hueBase}, 85%, 65%, 0.7)`;
        ctx.strokeStyle = `hsla(${hueBase}, 78%, 75%, ${ring.life * 0.32 * opacityMul})`;
        ctx.lineWidth = scale * 2.5;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }
    frame();

    // Pause the loop entirely while the tab is hidden.
    const onVisible = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
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

  return <canvas ref={canvasRef} className="waves" />;
}
