import { useEffect, useRef } from 'react';

// Canvas sound-wave animation. Reads the beat engine's getPulse() every frame (so it never
// re-renders React) and draws one of two styles, switchable live via the `style` prop:
//   - 'rings' : layered organic rings sized by loudness, outline deformed by frequency
//               (pitch) bands, with an expanding ripple on each beat.
//   - 'bars'  : a centered, mirrored spectrum of bars rising from a baseline, heights driven
//               by the frequency bands + loudness, with a brightness/height kick on each beat.
// Amplitude eases down when paused; the RAF loop stops entirely when the tab is hidden.
export default function SoundWaves({
  getPulse,
  style = 'rings',
  sizeMul = 1,
  opacityMul = 1,
  glowMul = 1,
}) {
  const canvasRef = useRef(null);
  const getPulseRef = useRef(getPulse);
  getPulseRef.current = getPulse;
  // Mirror live settings into refs so the RAF loop reads current values.
  const styleRef = useRef(style);
  styleRef.current = style;
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
    let beatPulse = 0; // decaying 0..1, kicked on each beat (used by bars)
    let ripples = [];
    const bands = new Array(12).fill(0); // smoothed pitch-class bands (audio mode)

    function resize() {
      canvas.width = canvas.clientWidth * dpr();
      canvas.height = canvas.clientHeight * dpr();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // --- Rings ----------------------------------------------------------------
    function drawRings(w, h, base, t, scale, hueBase, sizeMul, opacityMul, glowMul) {
      const cx = w / 2;
      const cy = h / 2;
      const RINGS = 4;
      for (let i = 0; i < RINGS; i++) {
        const ringR = base * (0.15 + i * 0.05) * (1 + amp * 0.5) * sizeMul;
        const wobble = base * 0.02 * (0.5 + amp) * sizeMul;
        const segs = 120;
        ctx.beginPath();
        for (let a = 0; a <= segs; a++) {
          const ang = (a / segs) * Math.PI * 2;
          // Frequency-reactive lobe: interpolate between adjacent pitch-class bands so the
          // outline bulges where the current segment has energy (smooth, no 12-gon stepping).
          const fb = (ang / (Math.PI * 2)) * 12;
          const i0 = Math.floor(fb) % 12;
          const i1 = (i0 + 1) % 12;
          const frac = fb - Math.floor(fb);
          const bandPert = (bands[i0] * (1 - frac) + bands[i1] * frac) * base * 0.045 * sizeMul;
          const pert =
            Math.sin(ang * (3 + i) + t * (1.2 + i * 0.3)) * wobble +
            Math.sin(ang * (5 + i) - t * 0.8) * wobble * 0.5 +
            bandPert;
          const r = ringR + pert + amp * base * 0.04 * sizeMul * Math.sin(ang * 2 + t);
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const hue = (hueBase + i * 28) % 360;
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
    }

    // --- Bars (mirrored spectrum) --------------------------------------------
    function drawBars(w, h, base, scale, hueBase, sizeMul, opacityMul, glowMul) {
      const N = 32;
      const spanW = w * 0.72;
      const x0 = (w - spanW) / 2;
      const slot = spanW / N;
      const bw = slot * 0.58;
      const baseY = h * 0.72;
      const half = (N - 1) / 2;
      for (let j = 0; j < N; j++) {
        const d = Math.abs(j - half) / half; // 0 at center .. 1 at edges
        // Mirror the 12 bands outward from the center for a symmetric spectrum.
        const bp = d * 11;
        const i0 = Math.floor(bp);
        const i1 = Math.min(i0 + 1, 11);
        const bandVal = bands[i0] * (1 - (bp - i0)) + bands[i1] * (bp - i0);
        const env = 1 - d * 0.45; // gentle bell so the middle reads taller
        const v = amp * env * (0.4 + 1.3 * bandVal) + 0.12 * amp * beatPulse;
        const hgt = base * sizeMul * (0.015 + 0.42 * Math.min(v, 1.6));
        const x = x0 + j * slot + (slot - bw) / 2;
        const hue = (hueBase + (j / N) * 120) % 360;
        ctx.shadowBlur = scale * (5 + amp * 12) * glowMul;
        ctx.shadowColor = `hsla(${hue}, 85%, 62%, 0.7)`;
        ctx.fillStyle = `hsla(${hue}, 80%, 66%, ${(0.3 + amp * 0.4) * opacityMul})`;
        const r = Math.min(bw / 2, scale * 4);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, baseY - hgt, bw, hgt, r);
        else ctx.rect(x, baseY - hgt, bw, hgt);
        ctx.fill();
      }
    }

    function frame() {
      if (!running) return;
      const p = getPulseRef.current();
      const w = canvas.width;
      const h = canvas.height;
      const base = Math.min(w, h);
      const t = performance.now() / 1000;
      const scale = dpr();

      // Collapse amplitude toward 0 when paused, ease toward the pulse otherwise.
      const target = p.isPlaying ? p.value : 0;
      amp += (target - amp) * 0.12;

      // Smooth the 12 pitch-class bands toward the current segment (decay to 0 when there's
      // no analysis), so both styles track the song's frequency content fluidly.
      const srcBands = p.bands;
      for (let b = 0; b < 12; b++) {
        const tb = srcBands && p.isPlaying ? srcBands[b] : 0;
        bands[b] += (tb - bands[b]) * 0.18;
      }

      // Beat onset: real beats, or beat-phase wrap-around (decorative beat mode).
      const beatNow =
        p.isPlaying && (p.beat || (p.mode === 'beat' && p.beatPhase < lastPhase - 0.3));
      lastPhase = p.beatPhase;
      beatPulse *= 0.9;
      if (beatNow) beatPulse = 1;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const hueBase = (t * 6) % 360;
      const sizeMul = sizeRef.current;
      const opacityMul = opacityRef.current;
      const glowMul = glowRef.current;

      if (styleRef.current === 'bars') {
        drawBars(w, h, base, scale, hueBase, sizeMul, opacityMul, glowMul);
      } else {
        if (beatNow) ripples.push({ r: base * 0.17 * sizeMul, life: 1 });
        drawRings(w, h, base, t, scale, hueBase, sizeMul, opacityMul, glowMul);
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
