// Capped storage for backmusic's own data (images + presets) in IndexedDB. We enforce our
// own 100 MB budget and measure our actual footprint, rather than navigator.storage.estimate()
// (which reports the whole Spotify origin, including Spotify's own data — not meaningful here).
import { idbGet, idbSet } from './idb.js';

export const IMAGES_KEY = 'bm_images_v1';
export const PRESETS_KEY = 'bm_presets_v1';
export const STORAGE_CAP = 100 * 1024 * 1024; // 100 MB

function bytes(value) {
  try {
    return new Blob([JSON.stringify(value ?? null)]).size;
  } catch {
    return 0;
  }
}

// Total bytes backmusic currently stores (images + presets).
export async function getUsedBytes() {
  const [img, pre] = await Promise.all([idbGet(IMAGES_KEY), idbGet(PRESETS_KEY)]);
  return bytes(img) + bytes(pre);
}

// Persist `value` at `key` only if the combined footprint (this store + the other) stays under
// the cap. Returns true on success, false if it would exceed the cap or the write fails.
export async function setCapped(key, value) {
  const otherKey = key === IMAGES_KEY ? PRESETS_KEY : IMAGES_KEY;
  const other = await idbGet(otherKey);
  if (bytes(value) + bytes(other) > STORAGE_CAP) return false;
  try {
    await idbSet(key, value);
    return true;
  } catch {
    return false;
  }
}
