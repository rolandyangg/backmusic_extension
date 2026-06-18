// Persists the user's background + centerpiece images (data URLs) in IndexedDB, which has a
// far larger quota than localStorage's ~5MB cap. One-time migrates any old localStorage value.
import { idbGet, idbSet } from './idb.js';

const KEY = 'bm_images_v1';

// Async: returns { background?, centerpiece? }. Migrates a pre-existing localStorage copy once.
export async function loadImages() {
  try {
    const v = await idbGet(KEY);
    if (v != null) return v;
  } catch {
    // fall through to localStorage / empty
  }
  try {
    const ls = JSON.parse(localStorage.getItem(KEY));
    if (ls && typeof ls === 'object') {
      idbSet(KEY, ls).catch(() => {});
      localStorage.removeItem(KEY);
      return ls;
    }
  } catch {
    // ignore
  }
  return {};
}

// Async: returns true on success, false on failure (e.g. quota exceeded).
export async function persistImages(images) {
  try {
    await idbSet(KEY, images);
    return true;
  } catch {
    return false;
  }
}

// Crops a File to the bounding box of a freeform lasso (`points` are {x,y} in
// fractions 0..1 of the image), downscaled to maxDim. Returns the rectangular
// crop plus the lasso polygon re-expressed in fractions *of the crop* (polyLocal),
// so the mask can be applied/refined afterward.
export function cropToBBox(file, points, { maxDim }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = img.width;
      const H = img.height;

      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      const sx = minX * W;
      const sy = minY * H;
      const sw = Math.max(1, spanX * W);
      const sh = Math.max(1, spanY * H);
      const scale = Math.min(1, maxDim / Math.max(sw, sh));
      const ow = Math.max(1, Math.round(sw * scale));
      const oh = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width = ow;
      canvas.height = oh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);

      const polyLocal = points.map((p) => ({ x: (p.x - minX) / spanX, y: (p.y - minY) / spanY }));
      resolve({ cropDataUrl: canvas.toDataURL('image/png'), polyLocal });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

// Masks a source image (a crop data URL) to a polygon, with optional feather (soft
// edge, px) and grow/shrink (px; negative shrinks). polyLocal points are fractions
// of the source. Everything outside becomes transparent. Returns a PNG data URL.
export function applyPolygonMask(sourceDataUrl, polyLocal, { feather = 0, grow = 0 }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Build the mask: filled polygon, grown/shrunk via a stroked border.
      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const mctx = mask.getContext('2d');
      mctx.fillStyle = '#fff';
      mctx.strokeStyle = '#fff';
      mctx.lineJoin = 'round';
      mctx.beginPath();
      polyLocal.forEach((p, i) => {
        const x = p.x * w;
        const y = p.y * h;
        i ? mctx.lineTo(x, y) : mctx.moveTo(x, y);
      });
      mctx.closePath();
      mctx.fill();
      if (grow > 0) {
        mctx.lineWidth = grow * 2;
        mctx.stroke();
      } else if (grow < 0) {
        mctx.globalCompositeOperation = 'destination-out';
        mctx.lineWidth = -grow * 2;
        mctx.stroke();
        mctx.globalCompositeOperation = 'source-over';
      }

      // Keep source pixels weighted by the (optionally blurred) mask alpha.
      ctx.globalCompositeOperation = 'destination-in';
      if (feather > 0) ctx.filter = `blur(${feather}px)`;
      ctx.drawImage(mask, 0, 0);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not build mask'));
    img.src = sourceDataUrl;
  });
}

// data URL → Blob, for handing a processed crop back to the background remover.
export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

// Reads a File, downscales it to maxDim on its longest edge, and returns a data URL.
// Background → JPEG (smaller); centerpiece → PNG (preserves transparency).
export function fileToDataUrl(file, { maxDim, mime = 'image/jpeg', quality = 0.85 }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}
