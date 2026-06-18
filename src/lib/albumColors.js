// Prominent colors of the current track's album art, via Spicetify.colorExtractor(uri)
// (Spotify's own palette extraction — returns hex colors like VIBRANT / PROMINENT).
// Used by the 'album' wave color mode so the waves echo the cover. Cached per URI;
// returns null when extraction is unavailable so callers fall back to the auto palette.

const cache = new Map();
const HEX = /^#?[0-9a-f]{6}$/i;

export function fetchAlbumColors(trackUri) {
  if (!trackUri) return Promise.resolve(null);
  if (cache.has(trackUri)) return cache.get(trackUri);

  const p = (async () => {
    try {
      const c = await window.Spicetify?.colorExtractor?.(trackUri);
      if (!c) return null;
      // Favor the vivid swatches; dedupe and drop anything missing/odd.
      const order = [c.VIBRANT, c.LIGHT_VIBRANT, c.PROMINENT, c.DARK_VIBRANT];
      const seen = new Set();
      const out = [];
      for (const hex of order) {
        const key = typeof hex === 'string' && HEX.test(hex) ? hex.toLowerCase() : null;
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push(hex);
        }
      }
      return out.length ? out : null;
    } catch {
      return null;
    }
  })();

  cache.set(trackUri, p);
  return p;
}
