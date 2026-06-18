import { useEffect, useState } from 'react';
import { extractPalette } from '../lib/palette.js';
import { fetchAlbumColors } from '../lib/albumColors.js';

// Palette for the image-based wave color modes. Samples the source image's pixels
// (extractPalette); if that's blocked (CORS-tainted album art), falls back to Spotify's
// colorExtractor for the track. Only runs for the 'album' / 'centerpiece' modes.
export function useWavePalette(mode, src, fallbackUri) {
  const [colors, setColors] = useState(null);
  const active = mode === 'album' || mode === 'centerpiece';

  useEffect(() => {
    if (!active) {
      setColors(null);
      return;
    }
    let alive = true;
    (async () => {
      let pal = await extractPalette(src);
      if (!pal && fallbackUri) pal = await fetchAlbumColors(fallbackUri);
      if (alive) setColors(pal);
    })();
    return () => {
      alive = false;
    };
  }, [active, src, fallbackUri]);

  return colors;
}
