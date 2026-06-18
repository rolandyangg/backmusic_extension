import { useCallback, useEffect, useState } from 'react';
import { idbGet, idbSet } from '../lib/idb.js';

// Named look presets, persisted to IndexedDB (large quota — they embed images). Each preset:
// { id, name, settings, images }. Applying is done by the caller via useSettings.applySettings
// + useImages.applyImages. One-time migrates any old localStorage value.
const KEY = 'bm_presets_v1';

async function load() {
  try {
    const v = await idbGet(KEY);
    if (Array.isArray(v)) return v;
  } catch {
    // fall through
  }
  try {
    const ls = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(ls)) {
      idbSet(KEY, ls).catch(() => {});
      localStorage.removeItem(KEY);
      return ls;
    }
  } catch {
    // ignore
  }
  return [];
}

export function usePresets() {
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    let alive = true;
    load().then((v) => {
      if (alive) setPresets(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Returns true on success, false if persistence fails (e.g. quota exceeded).
  const savePreset = useCallback(async (name, settings, images) => {
    const clean = (name || '').trim() || 'Preset';
    const preset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clean,
      settings,
      images: images || {},
    };
    const current = await load();
    const next = [...current.filter((p) => p.name !== clean), preset]; // replace same name
    try {
      await idbSet(KEY, next);
    } catch {
      return false; // quota — prior presets remain intact
    }
    setPresets(next);
    return true;
  }, []);

  const deletePreset = useCallback(async (id) => {
    const next = (await load()).filter((p) => p.id !== id);
    idbSet(KEY, next).catch(() => {});
    setPresets(next);
  }, []);

  return { presets, savePreset, deletePreset };
}
