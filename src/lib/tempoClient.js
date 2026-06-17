// Tempo (BPM) lookup. DISABLED in the Spicetify v1 build: getTempo() always returns
// { bpm: null } so the beat engine (useBeat.js) runs in its decorative breathing mode.
//
// Why disabled: BPM comes from ReccoBeats via a serverless proxy (/api/tempo). A
// Spicetify app runs at a Spotify origin, so calling that proxy cross-origin needs CORS
// headers the deployed proxy doesn't yet send. Rather than ship a CORS/proxy dependency
// in v1, we keep the visualizer self-contained on the decorative pulse.
//
// To re-enable later: set TEMPO_BASE to a CORS-enabled proxy and the fetch below kicks
// in (the deployed proxy expects `?trackId=<spotifyId>` and returns
// { bpm, energy, danceability }).
const TEMPO_BASE = null; // e.g. 'https://backmusic-one.vercel.app'

const KEY = 'bm_tempo_cache_v1';
let mem = null;

function load() {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    mem = {};
  }
  return mem;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    // Quota/full or disabled storage — keep the in-memory copy.
  }
}

// Returns { bpm, energy, danceability } with bpm possibly null (→ decorative mode).
export async function getTempo(trackId) {
  if (!trackId || !TEMPO_BASE) return { bpm: null };

  const cache = load();
  if (cache[trackId]) return cache[trackId];

  let result = { bpm: null };
  try {
    const res = await fetch(`${TEMPO_BASE}/api/tempo?trackId=${encodeURIComponent(trackId)}`);
    if (res.ok) result = await res.json();
  } catch {
    // Network/proxy/CORS failure — fall through to decorative.
  }

  cache[trackId] = result;
  persist();
  return result;
}
