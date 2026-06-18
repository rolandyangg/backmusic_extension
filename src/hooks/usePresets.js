import { useCallback, useState } from 'react';

// Named look presets, persisted to localStorage. Each preset stores the full settings object
// and the uploaded images: { id, name, settings, images }. Applying is done by the caller via
// useSettings.applySettings + useImages.applyImages.
const KEY = 'bm_presets_v1';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Returns true on success, false if persistence fails (e.g. quota exceeded — images are large).
function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function usePresets() {
  const [presets, setPresets] = useState(load);

  const savePreset = useCallback((name, settings, images) => {
    const clean = (name || '').trim() || 'Preset';
    const preset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clean,
      settings,
      images: images || {},
    };
    // Replace any existing preset with the same name.
    const next = [...load().filter((p) => p.name !== clean), preset];
    if (!persist(next)) return false; // quota — prior presets remain intact
    setPresets(next);
    return true;
  }, []);

  const deletePreset = useCallback((id) => {
    const next = load().filter((p) => p.id !== id);
    persist(next);
    setPresets(next);
  }, []);

  return { presets, savePreset, deletePreset };
}
