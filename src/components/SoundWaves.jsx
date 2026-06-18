import { useEffect, useRef } from 'react';

// Convert a #rrggbb hex to { h, s } (hue 0..360, saturation 0..100). Lightness is supplied
// separately by the renderer so the layered glow look is preserved across colors.
function hexToHS(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return { h: 270, s: 70 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100 };
}

// Canvas sound-wave animation. Reads the beat engine's getPulse() every frame (so it never
// re-renders React) and draws rings, a mirrored spectrum of bars, or both — switchable live
// via `style`. Color follows `colorMode`: 'auto' (palette whose base hue adapts to the song),
// 'solid' (a single user color), or 'mono' (drained to grayscale). Amplitude eases down when
// paused; the RAF loop stops entirely when the tab is hidden.
export default function SoundWaves({
  getPulse,
  style = 'rings',
  colorMode = 'auto',
  color = '#8a7cff',
  saturation = 1,
  albumColors = null,
  sizeMul = 1,
  opacityMul = 1,
  glowMul = 1,
}) {
  const canvasRef = useRef(null);
  const getPulseRef = useRef(getPulse);
  getPulseRef.current = getPulse;
  // Mirror live props into refs so the RAF loop reads current values.
  const styleRef = useRef(style);
  styleRef.current = style;
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;
  const colorRef = useRef(color);
  colorRef.current = color;
  const satRef = useRef(saturation);
  satRef.current = saturation;
  const albumRef = useRef(albumColors);
  albumRef.current = albumColors;
  const sizeRef = useRef(sizeMul);
  sizeRef.current = sizeMul;
  const opacityRef = useRef(opacityMul);
  opacityRef.current = opacityMul;
  const glowRef = useRef(glowMul);
  glowRef.current = glowMul;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Cap the backing-store resolution. Fullscreen at DPR 2 is millions of pixels, and the
    // glow (shadowBlur) cost scales with pixel area — the dominant source of fullscreen lag.
    const MAX_DIM = 1920;
    const dpr = () => {
      const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const longest = Math.max(canvas.clientWidth, canvas.clientHeight) || 1;
      return longest * baseDpr > MAX_DIM ? Math.max(0.75, MAX_DIM / longest) : baseDpr;
    };

    let raf = 0;
    let running = true;
    let amp = 0; // smoothed amplitude
    let lastPhase = 1;
    let beatPulse = 0; // decaying 0..1, kicked on each beat (used by bars)
    let domHue = 270; // smoothed dominant-pitch hue (drives the 'auto' palette)
    let ripples = [];
    const bands = new Array(12).fill(0); // smoothed pitch-class bands (audio mode)

    function resize() {
      canvas.width = Math.round(canvas.clientWidth * dpr());
      canvas.height = Math.round(canvas.clientHeight * dpr());
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Hue + saturation for a wave element, given the current color mode. `offset` shifts the
    // hue across elements in 'auto' mode (ignored otherwise); lightness/alpha stay with the
    // renderer. Returns { hue, satStroke, satShadow }.
    let pal = { mode: 'auto', hueBase: 0, solidH: 270, solidS: 70, sat: 1, album: null };
    function tone(offset, idx) {
      // Global saturation multiplier (0 = black & white) applied to every mode. Legacy 'mono'
      // (e.g. from an old preset) forces it to 0.
      const sat = pal.mode === 'mono' ? 0 : pal.sat;
      if (pal.mode === 'solid') {
        return { hue: pal.solidH, satStroke: pal.solidS * sat, satShadow: Math.min(pal.solidS + 10, 100) * sat };
      }
      // Cycle album-art swatches across elements; fall back to auto if none extracted.
      if (pal.mode === 'album' && pal.album && pal.album.length) {
        const c = pal.album[((idx % pal.album.length) + pal.album.length) % pal.album.length];
        return { hue: c.h, satStroke: c.s * sat, satShadow: Math.min(c.s + 10, 100) * sat };
      }
      return { hue: (pal.hueBase + offset) % 360, satStroke: 75 * sat, satShadow: 85 * sat };
    }

    // --- Rings ----------------------------------------------------------------
    function drawRings(w, h, base, t, scale, sizeMul, opacityMul, glowMul) {
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
        const { hue, satStroke, satShadow } = tone(i * 28, i);
        ctx.shadowBlur = Math.min(scale * (4 + amp * 8) * glowMul, scale * 8);
        ctx.shadowColor = `hsla(${hue}, ${satShadow}%, 62%, 0.7)`;
        ctx.strokeStyle = `hsla(${hue}, ${satStroke}%, 68%, ${(0.19 + amp * 0.33) * opacityMul})`;
        ctx.lineWidth = scale * (2 + i * 0.7);
        ctx.stroke();
      }

      ripples = ripples.filter((r) => r.life > 0);
      for (const ring of ripples) {
        ring.r += base * 0.006 * sizeMul;
        ring.life -= 0.018;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        const { hue, satStroke, satShadow } = tone(0, 0);
        ctx.shadowBlur = Math.min(scale * 6 * glowMul, scale * 8);
        ctx.shadowColor = `hsla(${hue}, ${satShadow}%, 65%, 0.7)`;
        ctx.strokeStyle = `hsla(${hue}, ${satStroke}%, 75%, ${ring.life * 0.32 * opacityMul})`;
        ctx.lineWidth = scale * 2.5;
        ctx.stroke();
      }
    }

    // --- Bars (mirrored spectrum) --------------------------------------------
    function drawBars(w, h, base, scale, sizeMul, opacityMul, glowMul) {
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
        const { hue, satStroke, satShadow } = tone((j / N) * 120, j);
        ctx.shadowBlur = Math.min(scale * (4 + amp * 7) * glowMul, scale * 8);
        ctx.shadowColor = `hsla(${hue}, ${satShadow}%, 62%, 0.7)`;
        ctx.fillStyle = `hsla(${hue}, ${satStroke}%, 66%, ${(0.3 + amp * 0.4) * opacityMul})`;
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

      // Idle gate: when paused and faded out, just clear and skip the heavy draw (the loop
      // keeps running so it resumes instantly). Saves the bulk of CPU/GPU while paused.
      if (!p.isPlaying && amp < 0.012) {
        if (ripples.length) ripples = [];
        ctx.clearRect(0, 0, w, h);
        raf = requestAnimationFrame(frame);
        return;
      }

      // Smooth the 12 pitch-class bands toward the current segment (decay to 0 when there's
      // no analysis), so both styles track the song's frequency content fluidly.
      const srcBands = p.bands;
      let domIdx = 0;
      for (let b = 0; b < 12; b++) {
        const tb = srcBands && p.isPlaying ? srcBands[b] : 0;
        bands[b] += (tb - bands[b]) * 0.18;
        if (bands[b] > bands[domIdx]) domIdx = b;
      }
      // Drift the 'auto' base hue toward the dominant pitch class (shortest way round the
      // wheel) so the palette adapts to the song while still slowly cycling over time.
      const targetHue = (domIdx / 12) * 360;
      let dh = targetHue - domHue;
      dh -= Math.round(dh / 360) * 360;
      domHue = (domHue + dh * 0.02 + 360) % 360;

      // Beat onset: real beats, or beat-phase wrap-around (decorative beat mode).
      const beatNow =
        p.isPlaying && (p.beat || (p.mode === 'beat' && p.beatPhase < lastPhase - 0.3));
      lastPhase = p.beatPhase;
      beatPulse *= 0.9;
      if (beatNow) beatPulse = 1;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      // Resolve the palette for this frame.
      const mode = colorModeRef.current;
      const { h: solidH, s: solidS } = hexToHS(colorRef.current);
      const album =
        mode === 'album' && Array.isArray(albumRef.current)
          ? albumRef.current.map(hexToHS)
          : null;
      // 'classic' = the original smooth time-cycling rainbow (no song adaptation); 'auto'
      // drifts the base hue toward the dominant pitch. Both use tone()'s hue-cycling branch.
      const hueBase = mode === 'auto' ? (t * 6 + domHue * 0.7) % 360 : (t * 6) % 360;
      const sat = Math.max(0, Math.min(1, satRef.current));
      pal = { mode, hueBase, solidH, solidS, sat, album };

      const styleNow = styleRef.current;
      const sizeMul = sizeRef.current;
      const opacityMul = opacityRef.current;
      const glowMul = glowRef.current;

      if (styleNow === 'bars' || styleNow === 'both') {
        drawBars(w, h, base, scale, sizeMul, opacityMul, glowMul);
      }
      if (styleNow === 'rings' || styleNow === 'both') {
        if (beatNow) ripples.push({ r: base * 0.17 * sizeMul, life: 1 });
        drawRings(w, h, base, t, scale, sizeMul, opacityMul, glowMul);
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
