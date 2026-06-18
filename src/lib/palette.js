// Extracts an "overall palette" from an image (album art, centerpiece, …) by sampling its
// actual pixels — so the waves reflect the same colors you see in the image, the way the
// background already shows it. Works on data URLs (uploaded images) and http(s) URLs (album
// art, via crossOrigin). Returns ~6 dominant colors as hex, or null if the pixels can't be
// read (CORS-tainted canvas / load error) so callers can fall back.

const cache = new Map();

function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function extractPalette(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return cache.get(src);

  const p = new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const N = 44; // small sample grid — plenty for a dominant-color palette
        const canvas = document.createElement('canvas');
        canvas.width = N;
        canvas.height = N;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, N, N);
        const data = ctx.getImageData(0, 0, N, N).data; // throws if CORS-tainted

        // Bucket pixels into a coarse 5×5×5 RGB grid, averaging each bucket.
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // skip transparent (e.g. cut-out centerpieces)
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = ((r * 5) >> 8) * 25 + ((g * 5) >> 8) * 5 + ((b * 5) >> 8);
          let e = buckets.get(key);
          if (!e) {
            e = { r: 0, g: 0, b: 0, n: 0 };
            buckets.set(key, e);
          }
          e.r += r;
          e.g += g;
          e.b += b;
          e.n += 1;
        }

        const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 6);
        const out = top.map((e) => rgbToHex(e.r / e.n, e.g / e.n, e.b / e.n));
        resolve(out.length ? out : null);
      } catch {
        resolve(null); // tainted canvas / read blocked
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

  cache.set(src, p);
  return p;
}
