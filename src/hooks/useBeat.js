import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAnalysis, sampleLoudness, sampleBands, beatIndexAt } from '../lib/audioData.js';

// Turns now-playing data into an animation drive signal. Exposes getPulse(), which the
// canvas calls every frame, so the engine never triggers per-frame re-renders.
//
// Two modes:
//   - 'audio'      : Spotify's audio analysis is available → wave amplitude tracks the
//                    song's real loudness envelope, `bands` carries its 12 pitch classes,
//                    and `beat` fires on real beat onsets — all synced to the interpolated
//                    playback position.
//   - 'decorative' : no analysis (podcast/local/unavailable) or audio-reactive disabled →
//                    smooth breathing pulse.
//
// getPulse() returns { value: 0..1, bands?: number[12], beat?: bool, beatPhase, isPlaying, mode }.
export function useBeat(nowPlaying, { audioReactive = true } = {}) {
  const ref = useRef({
    analysis: null,
    anchorMs: 0,
    anchorAt: 0,
    isPlaying: false,
    lastBeat: -1,
  });
  const [mode, setMode] = useState('decorative');

  // Re-anchor the interpolated playback clock on every fresh poll.
  useEffect(() => {
    ref.current.anchorMs = nowPlaying.progressMs || 0;
    ref.current.anchorAt = nowPlaying.fetchedAt || Date.now();
    ref.current.isPlaying = !!nowPlaying.isPlaying;
  }, [nowPlaying.progressMs, nowPlaying.fetchedAt, nowPlaying.isPlaying]);

  // Fetch the track's audio analysis whenever the track changes.
  const trackUri = nowPlaying.track?.uri;
  useEffect(() => {
    ref.current.analysis = null;
    ref.current.lastBeat = -1;
    if (!trackUri) {
      setMode('decorative');
      return;
    }
    let active = true;
    fetchAnalysis(trackUri).then((a) => {
      if (!active) return;
      ref.current.analysis = a;
      setMode(a ? 'audio' : 'decorative');
    });
    return () => {
      active = false;
    };
  }, [trackUri]);

  const getPulse = useCallback(() => {
    const s = ref.current;
    const now = Date.now();
    // Interpolate playback position forward from the last poll while playing.
    const positionMs = s.anchorMs + (s.isPlaying ? now - s.anchorAt : 0);

    if (audioReactive && s.analysis) {
      const value = sampleLoudness(s.analysis, positionMs);
      const bands = sampleBands(s.analysis, positionMs);
      const bi = beatIndexAt(s.analysis, positionMs);
      const beat = bi >= 0 && bi !== s.lastBeat;
      if (beat) s.lastBeat = bi;
      return { value, bands, beat, beatPhase: 0, isPlaying: s.isPlaying, mode: 'audio' };
    }

    // Decorative: gentle breathing independent of any beat.
    const breathe = (Math.sin(now / 700) + 1) / 2; // 0..1
    return {
      value: 0.4 + 0.3 * breathe,
      beatPhase: 0,
      isPlaying: s.isPlaying,
      mode: 'decorative',
    };
  }, [audioReactive]);

  return { getPulse, mode };
}
