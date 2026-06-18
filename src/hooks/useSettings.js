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
//   barSpread          : bars style — fraction of width the spectrum spans (0..1)
//   barWidth           : bars style — bar thickness (count auto-fills the span to stay packed)
//   barGap             : bars style — spacing between bars
//   waveColorMode      : 'classic' (rainbow) | 'album' (album-art palette) |
//                        'centerpiece' (centerpiece palette) | 'auto' (song's dominant pitch) | 'solid'
//   waveColor          : color used when waveColorMode is 'solid'
//   waveSaturation     : 0..1 — scales wave color saturation (0 = black & white, 1 = full color)
//   ringSize           : rings style — multiplier on ring radius
//   barHeight          : bars style — multiplier on bar height
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
  barSpread: 0.72,
  barWidth: 0.58,
  barGap: 0.42,
  waveColorMode: 'classic',
  waveColor: '#8a7cff',
  waveSaturation: 1,
  ringSize: 1,
  barHeight: 1,
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

// Bring an older raw settings object (from storage or a saved preset) up to date, in place,
// before it's merged over DEFAULT_SETTINGS.
function migrate(s) {
  // Old single 'waveScale' → separate ringSize / barHeight.
  if (s.waveScale != null) {
    if (s.ringSize == null) s.ringSize = s.waveScale;
    if (s.barHeight == null) s.barHeight = s.waveScale;
    delete s.waveScale;
  }
  // Old 'mono' color mode → saturation slider at 0 (black & white).
  if (s.waveColorMode === 'mono') {
    s.waveColorMode = 'classic';
    if (s.waveSaturation == null) s.waveSaturation = 0;
  }
  return s;
}

function load() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    stored = {};
  }
  return { ...DEFAULT_SETTINGS, ...migrate(stored) };
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

  // Apply a full settings object at once (used by presets); unknown/missing keys fall back
  // to defaults so older presets stay valid as new settings are added.
  const applySettings = useCallback((obj) => {
    const next = { ...DEFAULT_SETTINGS, ...migrate({ ...(obj || {}) }) };
    persist(next);
    setSettings(next);
  }, []);

  return { settings, setSetting, resetSettings, applySettings };
}
