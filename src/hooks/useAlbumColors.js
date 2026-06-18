import { useEffect, useState } from 'react';
import { fetchAlbumColors } from '../lib/albumColors.js';

// Returns the current track's album-art color palette (array of hex) or null. Refetches on
// track change; feeds the 'album' wave color mode.
export function useAlbumColors(trackUri) {
  const [colors, setColors] = useState(null);

  useEffect(() => {
    if (!trackUri) {
      setColors(null);
      return;
    }
    let active = true;
    fetchAlbumColors(trackUri).then((c) => {
      if (active) setColors(c);
    });
    return () => {
      active = false;
    };
  }, [trackUri]);

  return colors;
}
