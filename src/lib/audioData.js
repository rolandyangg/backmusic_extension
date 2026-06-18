// Real audio analysis for the current track, via Spicetify's first-party endpoint.
//
// `Spicetify.getAudioData(uri)` (jsHelper/spicetifyWrapper.js) calls Spotify's internal
// spclient audio-analysis service through CosmosAsync — first-party, so it sidesteps the
// public Web API's deprecated audio-analysis endpoint. The result is Spotify's standard
// analysis: segments (loudness/pitches/timbre), beats, sections, and a real tempo.
//
// We use it to drive the back waves from the song's actual loudness + frequency content,
// synced to playback position. (True real-time FFT is DRM-blocked; this analysis, sampled
// at the current position, is the real signal we can get.) Not every track has data
// (podcasts, local files) — callers fall back to the decorative pulse when this is null.

const cache = new Map(); // trackId -> Promise<analysis | null>

function trackIdFromUri(uri) {
  if (typeof uri !== 'string') return null;
  const parts = uri.split(':');
  return parts.length >= 3 && parts[parts.length - 2] === 'track'
    ? parts[parts.length - 1]
    : null;
}

// Returns a cached promise of the analysis for a track URI, or null if unavailable.
export function fetchAnalysis(trackUri) {
  const id = trackIdFromUri(trackUri);
  if (!id) return Promise.resolve(null);
  if (cache.has(id)) return cache.get(id);

  const p = (async () => {
    try {
      const data = await window.Spicetify?.getAudioData?.(trackUri);
      if (!data || !Array.isArray(data.segments) || !data.segments.length) return null;
      return data;
    } catch {
      return null; // missing analysis / network / non-track URI
    }
  })();

  cache.set(id, p);
  return p;
}

// Binary-search the last interval whose start (seconds) is <= t (seconds).
function indexAt(intervals, tSec) {
  let lo = 0;
  let hi = intervals.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (intervals[mid].start <= tSec) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

// Map a loudness value (dB, negative) to 0..1 over a perceptual window.
const DB_FLOOR = -28;
const DB_CEIL = -4;
function dbToUnit(db) {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  const u = (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

// Loudness envelope at position `ms` → 0..1, interpolated within the segment:
// loudness_start → loudness_max (at loudness_max_time) → loudness_end.
export function sampleLoudness(analysis, ms) {
  const segs = analysis?.segments;
  if (!segs || !segs.length) return 0;
  const t = ms / 1000;
  const s = segs[indexAt(segs, t)];
  const local = t - s.start; // seconds into the segment
  const peakAt = s.loudness_max_time ?? 0;

  let db;
  if (local <= peakAt) {
    const f = peakAt > 0 ? local / peakAt : 1;
    db = s.loudness_start + (s.loudness_max - s.loudness_start) * f;
  } else {
    const rest = Math.max(s.duration - peakAt, 1e-3);
    const f = Math.min((local - peakAt) / rest, 1);
    const end = s.loudness_end ?? s.loudness_max;
    db = s.loudness_max + (end - s.loudness_max) * f;
  }
  return dbToUnit(db);
}

// The 12 pitch-class (chroma) values of the current segment, each already 0..1.
export function sampleBands(analysis, ms) {
  const segs = analysis?.segments;
  if (!segs || !segs.length) return null;
  const s = segs[indexAt(segs, ms / 1000)];
  return Array.isArray(s.pitches) && s.pitches.length === 12 ? s.pitches : null;
}

// Index into beats[] for position `ms` (used to detect beat onsets between frames).
export function beatIndexAt(analysis, ms) {
  const beats = analysis?.beats;
  if (!beats || !beats.length) return -1;
  return indexAt(beats, ms / 1000);
}
