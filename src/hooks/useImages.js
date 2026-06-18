import { useCallback, useEffect, useState } from 'react';
import { loadImages, persistImages } from '../lib/imageStore.js';

// Manages the user's chosen background/centerpiece data URLs, persisted to IndexedDB.
// images: { background?: dataUrl, centerpiece?: dataUrl }. Loads asynchronously on mount
// (brief album-art fallback until ready).
export function useImages() {
  const [images, setImages] = useState({});

  useEffect(() => {
    let alive = true;
    loadImages().then((v) => {
      if (alive) setImages(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setImage = useCallback((kind, dataUrl) => {
    setImages((prev) => {
      const next = { ...prev, [kind]: dataUrl };
      if (!dataUrl) delete next[kind];
      // Persist; failures (quota) keep the in-memory value for this session.
      persistImages(next);
      return next;
    });
  }, []);

  const clearImage = useCallback((kind) => setImage(kind, null), [setImage]);

  // Replace both images at once (used by presets) — applies the preset's images, clearing
  // any not present so applying a preset fully restores its look.
  const applyImages = useCallback((next) => {
    const clean = {};
    if (next?.background) clean.background = next.background;
    if (next?.centerpiece) clean.centerpiece = next.centerpiece;
    persistImages(clean);
    setImages(clean);
  }, []);

  return { images, setImage, clearImage, applyImages };
}
