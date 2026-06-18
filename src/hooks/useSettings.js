import { useCallback, useState } from 'react';

// Visual settings, persisted to localStorage.
//   centerpiece        : size in vmin (can grow to fill the screen)
//   centerpieceY       : vertical offset in vh (negative = up, positive = down)
//   centerpieceOpacity : 0..1
//   bgOpacity          : background image opacity 0..1
//   bgBlur             : blur applied to a user background image (px)
//   tintColor          : color of the overlay tint
//   tintStrength       : how strongly the tint is overlaid (0..1)
//   waveStyle          : 'rings' | 'bars' (mirrored spectrum) | 'both'
//   waveColorMode      : 'album' (from album-art colors) | 'auto' (palette follows the song's
//                        dominant pitch) | 'solid' (waveColor) | 'mono' (B&W)
//   waveColor          : color used when waveColorMode is 'solid'
//   waveScale          : multiplier on wave radius
//   waveOpacity        : multiplier on wave opacity
//   waveGlow           : multiplier on wave glow (shadow blur)
//   audioReactive      : drive waves from the song's real audio analysis (else decorative)
//   labelFont          : font family for the now-playing label
//   labelSize          : font scale for the now-playing label
//   labelColor         : text color for the now-playing label
//   particleType       : 'none' | dust | snow | petals | stars | fireflies | notes | embers
//   particleDensity    : multiplier on the per-effect particle count
//   particleSpeed      : multiplier on particle velocity
//   particleSize       : multiplier on particle size
//   particleOpacity    : multiplier on particle opacity
//   particleColor      : particle color
//   particleBeat       : pulse particles with the beat
const KEY = 'bm_settings_v1';
export const DEFAULT_SETTINGS = {
  centerpiece: 38,
  centerpieceY: 0,
  centerpieceOpacity: 1,
  bgOpacity: 1,
  bgBlur: 0,
  tintColor: '#000000',
  tintStrength: 0,
  waveStyle: 'rings',
  waveColorMode: 'album',
  waveColor: '#8a7cff',
  waveScale: 1,
  waveOpacity: 1,
  waveGlow: 1,
  audioReactive: true,
  labelFont: 'Montserrat',
  labelSize: 1,
  labelColor: '#ffffff',
  particleType: 'none',
  particleDensity: 1,
  particleSpeed: 1,
  particleSize: 1,
  particleOpacity: 1,
  particleColor: '#ffffff',
  particleBeat: false,
};

function load() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persist(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore quota/disabled storage
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    persist(DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return { settings, setSetting, resetSettings };
}
