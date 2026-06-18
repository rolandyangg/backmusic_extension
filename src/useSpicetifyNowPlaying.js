import { useEffect, useState } from 'react';

// Adapter: turns Spicetify.Player state into backmusic's now-playing snapshot, so the
// copied Visualizer / useBeat code runs unchanged. Replaces the web app's polling of
// Spotify's Web API — inside the desktop client we read the live player directly.
//
// Snapshot shape (must match what useBeat.js / Visualizer.jsx expect):
//   { isPlaying, track: { id, name, artist, albumArtUrl, durationMs } | null,
//     progressMs, fetchedAt }
//
// `fetchedAt` (Date.now() at read time) is required: useBeat anchors its interpolated
// playback clock on it. Player.data's shape drifts across Spotify/Spicetify versions, so
// every field is read defensively and anything missing falls back to EMPTY.

const EMPTY = { isPlaying: false, track: null, progressMs: 0, fetchedAt: 0 };

// `spotify:track:<id>` (or :episode:) → bare id.
function idFromUri(uri) {
  if (typeof uri !== 'string') return null;
  const parts = uri.split(':');
  return parts.length >= 3 ? parts[parts.length - 1] : null;
}

function firstArtist(item) {
  const artists = item?.artists;
  if (Array.isArray(artists) && artists.length) {
    return artists.map((a) => a?.name).filter(Boolean).join(', ') || null;
  }
  // Older shapes sometimes expose a single `artist_name` in metadata.
  return item?.metadata?.artist_name || null;
}

function albumArt(item) {
  const m = item?.metadata || {};
  return (
    m.image_xlarge_url ||
    m.image_large_url ||
    m.image_url ||
    m.image_small_url ||
    item?.album?.images?.[0]?.url ||
    null
  );
}

function durationMs(item) {
  // Newer: data.duration.milliseconds; track item: item.duration.milliseconds or .duration
  const d = item?.duration;
  if (typeof d === 'number') return d;
  if (typeof d?.milliseconds === 'number') return d.milliseconds;
  const meta = Number(item?.metadata?.duration);
  return Number.isFinite(meta) ? meta : 0;
}

function readSnapshot() {
  const P = window.Spicetify?.Player;
  const data = P?.data;
  const item = data?.item || data?.track; // newer | older
  if (!P || !item) return EMPTY;

  const id = idFromUri(item.uri);
  const name = item.name || item?.metadata?.title || '';
  if (!name) return EMPTY;

  // Prefer the live getters; fall back to the data snapshot.
  const progressMs =
    (typeof P.getProgress === 'function' ? P.getProgress() : null) ?? P.progress ?? 0;
  const isPlaying =
    (typeof P.isPlaying === 'function' ? P.isPlaying() : null) ?? !data?.is_paused ?? false;
  const dur =
    (typeof P.getDuration === 'function' ? P.getDuration() : null) || durationMs(item);

  return {
    isPlaying: !!isPlaying,
    track: {
      id,
      uri: item.uri || null,
      name,
      artist: firstArtist(item) || '',
      albumArtUrl: albumArt(item),
      durationMs: dur,
    },
    progressMs: progressMs || 0,
    fetchedAt: Date.now(),
  };
}

export function useSpicetifyNowPlaying() {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    const P = window.Spicetify?.Player;
    if (!P) return;

    const update = () => setState(readSnapshot());

    // onprogress fires ~4x/s; each setState re-renders the whole tree. The beat clock and
    // seek bar interpolate position locally from progressMs/fetchedAt, so we only need a
    // fresh anchor ~once/sec — throttle it. songchange/onplaypause stay immediate.
    let lastProgress = 0;
    const onProgress = () => {
      const now = Date.now();
      if (now - lastProgress >= 900) {
        lastProgress = now;
        update();
      }
    };

    P.addEventListener?.('songchange', update);
    P.addEventListener?.('onplaypause', update);
    P.addEventListener?.('onprogress', onProgress);
    update(); // prime immediately

    return () => {
      P.removeEventListener?.('songchange', update);
      P.removeEventListener?.('onplaypause', update);
      P.removeEventListener?.('onprogress', onProgress);
    };
  }, []);

  return state;
}
