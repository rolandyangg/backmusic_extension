import { useCallback, useState } from 'react';
import { loadImages, persistImages } from '../lib/imageStore.js';

// Manages the user's chosen background/centerpiece data URLs, persisted to localStorage.
// images: { background?: dataUrl, centerpiece?: dataUrl }
export function useImages() {
  const [images, setImages] = useState(loadImages);

  const setImage = useCallback((kind, dataUrl) => {
    setImages((prev) => {
      const next = { ...prev, [kind]: dataUrl };
      if (!dataUrl) delete next[kind];
      // Persist; if storage fails (quota), the value still lives in memory this session.
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
