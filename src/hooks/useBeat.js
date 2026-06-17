import { useCallback, useEffect, useRef, useState } from 'react';
import { getTempo } from '../lib/tempoClient.js';

// Turns now-playing data into an animation drive signal. Exposes getPulse(), which
// the canvas calls every frame, so the engine never triggers per-frame re-renders.
//
// Two modes:
//   - 'beat'       : BPM known → pulse spikes on each beat, phase-aligned to
//                    Spotify's reported playback position (interpolated between polls).
//   - 'decorative' : BPM unknown → smooth breathing pulse.
//
// getPulse() returns { value: 0..1, beatPhase: 0..1, isPlaying, mode }.
export function useBeat(nowPlaying) {
  const ref = useRef({
    bpm: null,
    energy: null,
    anchorMs: 0,
    anchorAt: 0,
    isPlaying: false,
  });
  const [mode, setMode] = useState('decorative');

  // Re-anchor the interpolated playback clock on every fresh poll.
  useEffect(() => {
    ref.current.anchorMs = nowPlaying.progressMs || 0;
    ref.current.anchorAt = nowPlaying.fetchedAt || Date.now();
    ref.current.isPlaying = !!nowPlaying.isPlaying;
  }, [nowPlaying.progressMs, nowPlaying.fetchedAt, nowPlaying.isPlaying]);

  // Look up tempo whenever the track changes.
  const trackId = nowPlaying.track?.id;
  useEffect(() => {
    if (!trackId) {
      ref.current.bpm = null;
      ref.current.energy = null;
      setMode('decorative');
      return;
    }
    let active = true;
    getTempo(trackId).then((t) => {
      if (!active) return;
      ref.current.bpm = t.bpm;
      ref.current.energy = t.energy;
      setMode(t.bpm ? 'beat' : 'decorative');
    });
    return () => {
      active = false;
    };
  }, [trackId]);

  const getPulse = useCallback(() => {
    const s = ref.current;
    const now = Date.now();
    // Interpolate playback position forward from the last poll while playing.
    const positionMs = s.anchorMs + (s.isPlaying ? now - s.anchorAt : 0);

    if (s.bpm) {
      const beatPeriod = 60000 / s.bpm;
      const phase = (positionMs % beatPeriod) / beatPeriod; // 0..1 within the beat
      // Sharp attack on the beat, smooth decay until the next one.
      const envelope = Math.pow(1 - phase, 2.2);
      const intensity = 0.6 + 0.4 * (s.energy ?? 0.5);
      return { value: envelope * intensity, beatPhase: phase, isPlaying: s.isPlaying, mode: 'beat' };
    }

    // Decorative: gentle breathing independent of any beat.
    const breathe = (Math.sin(now / 700) + 1) / 2; // 0..1
    return {
      value: 0.4 + 0.3 * breathe,
      beatPhase: 0,
      isPlaying: s.isPlaying,
      mode: 'decorative',
    };
  }, []);

  return { getPulse, mode };
}
