var backmusic = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/app.jsx
  var app_exports = {};
  __export(app_exports, {
    default: () => App
  });

  // src/shims/react.js
  var R = () => window.Spicetify.React;
  var useState = (...a) => R().useState(...a);
  var useEffect = (...a) => R().useEffect(...a);
  var useRef = (...a) => R().useRef(...a);
  var useCallback = (...a) => R().useCallback(...a);
  var react_default = new Proxy(
    {},
    {
      get: (_t, prop) => R()[prop]
    }
  );

  // src/shims/react-dom.js
  var RD = () => window.Spicetify.ReactDOM;
  var createPortal = (...a) => RD().createPortal(...a);
  var react_dom_default = new Proxy(
    {},
    {
      get: (_t, prop) => RD()[prop]
    }
  );

  // src/useSpicetifyNowPlaying.js
  var EMPTY = { isPlaying: false, track: null, progressMs: 0, fetchedAt: 0 };
  function idFromUri(uri) {
    if (typeof uri !== "string") return null;
    const parts = uri.split(":");
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }
  function firstArtist(item) {
    const artists = item?.artists;
    if (Array.isArray(artists) && artists.length) {
      return artists.map((a) => a?.name).filter(Boolean).join(", ") || null;
    }
    return item?.metadata?.artist_name || null;
  }
  function albumArt(item) {
    const m = item?.metadata || {};
    return m.image_xlarge_url || m.image_large_url || m.image_url || m.image_small_url || item?.album?.images?.[0]?.url || null;
  }
  function durationMs(item) {
    const d = item?.duration;
    if (typeof d === "number") return d;
    if (typeof d?.milliseconds === "number") return d.milliseconds;
    const meta = Number(item?.metadata?.duration);
    return Number.isFinite(meta) ? meta : 0;
  }
  function readSnapshot() {
    const P3 = window.Spicetify?.Player;
    const data = P3?.data;
    const item = data?.item || data?.track;
    if (!P3 || !item) return EMPTY;
    const id = idFromUri(item.uri);
    const name = item.name || item?.metadata?.title || "";
    if (!name) return EMPTY;
    const progressMs = (typeof P3.getProgress === "function" ? P3.getProgress() : null) ?? P3.progress ?? 0;
    const isPlaying = (typeof P3.isPlaying === "function" ? P3.isPlaying() : null) ?? !data?.is_paused ?? false;
    const dur = (typeof P3.getDuration === "function" ? P3.getDuration() : null) || durationMs(item);
    return {
      isPlaying: !!isPlaying,
      track: {
        id,
        uri: item.uri || null,
        name,
        artist: firstArtist(item) || "",
        albumArtUrl: albumArt(item),
        durationMs: dur
      },
      progressMs: progressMs || 0,
      fetchedAt: Date.now()
    };
  }
  function useSpicetifyNowPlaying() {
    const [state, setState] = useState(EMPTY);
    useEffect(() => {
      const P3 = window.Spicetify?.Player;
      if (!P3) return;
      const update = () => setState(readSnapshot());
      let lastProgress = 0;
      const onProgress = () => {
        const now = Date.now();
        if (now - lastProgress >= 900) {
          lastProgress = now;
          update();
        }
      };
      P3.addEventListener?.("songchange", update);
      P3.addEventListener?.("onplaypause", update);
      P3.addEventListener?.("onprogress", onProgress);
      update();
      return () => {
        P3.removeEventListener?.("songchange", update);
        P3.removeEventListener?.("onplaypause", update);
        P3.removeEventListener?.("onprogress", onProgress);
      };
    }, []);
    return state;
  }

  // src/lib/idb.js
  var DB_NAME = "backmusic";
  var STORE = "kv";
  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return openDB().then(
      (db) => new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        t.onabort = () => reject(t.error || req && req.error);
        t.oncomplete = () => resolve(req ? req.result : void 0);
        t.onerror = () => reject(t.error || req && req.error);
      })
    );
  }
  function idbGet(key) {
    return tx("readonly", (store) => store.get(key));
  }
  function idbSet(key, value) {
    return tx("readwrite", (store) => store.put(value, key));
  }

  // src/lib/storage.js
  var IMAGES_KEY = "bm_images_v1";
  var PRESETS_KEY = "bm_presets_v1";
  var STORAGE_CAP = 100 * 1024 * 1024;
  function bytes(value) {
    try {
      return new Blob([JSON.stringify(value ?? null)]).size;
    } catch {
      return 0;
    }
  }
  async function getUsedBytes() {
    const [img, pre] = await Promise.all([idbGet(IMAGES_KEY), idbGet(PRESETS_KEY)]);
    return bytes(img) + bytes(pre);
  }
  async function setCapped(key, value) {
    const otherKey = key === IMAGES_KEY ? PRESETS_KEY : IMAGES_KEY;
    const other = await idbGet(otherKey);
    if (bytes(value) + bytes(other) > STORAGE_CAP) return false;
    try {
      await idbSet(key, value);
      return true;
    } catch {
      return false;
    }
  }

  // src/lib/imageStore.js
  async function loadImages() {
    try {
      const v = await idbGet(IMAGES_KEY);
      if (v != null) return v;
    } catch {
    }
    try {
      const ls = JSON.parse(localStorage.getItem(IMAGES_KEY));
      if (ls && typeof ls === "object") {
        idbSet(IMAGES_KEY, ls).catch(() => {
        });
        localStorage.removeItem(IMAGES_KEY);
        return ls;
      }
    } catch {
    }
    return {};
  }
  async function persistImages(images) {
    return setCapped(IMAGES_KEY, images);
  }
  function cropToBBox(file, points, { maxDim }) {
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
        const canvas = document.createElement("canvas");
        canvas.width = ow;
        canvas.height = oh;
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
        const polyLocal = points.map((p) => ({ x: (p.x - minX) / spanX, y: (p.y - minY) / spanY }));
        resolve({ cropDataUrl: canvas.toDataURL("image/png"), polyLocal });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
      };
      img.src = url;
    });
  }
  function applyPolygonMask(sourceDataUrl, polyLocal, { feather = 0, grow = 0 }) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const mask = document.createElement("canvas");
        mask.width = w;
        mask.height = h;
        const mctx = mask.getContext("2d");
        mctx.fillStyle = "#fff";
        mctx.strokeStyle = "#fff";
        mctx.lineJoin = "round";
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
          mctx.globalCompositeOperation = "destination-out";
          mctx.lineWidth = -grow * 2;
          mctx.stroke();
          mctx.globalCompositeOperation = "source-over";
        }
        ctx.globalCompositeOperation = "destination-in";
        if (feather > 0) ctx.filter = `blur(${feather}px)`;
        ctx.drawImage(mask, 0, 0);
        ctx.filter = "none";
        ctx.globalCompositeOperation = "source-over";
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not build mask"));
      img.src = sourceDataUrl;
    });
  }
  function fileToDataUrl(file, { maxDim, mime = "image/jpeg", quality = 0.85 }) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
      };
      img.src = url;
    });
  }

  // src/hooks/useImages.js
  function useImages() {
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
        persistImages(next);
        return next;
      });
    }, []);
    const clearImage = useCallback((kind) => setImage(kind, null), [setImage]);
    const applyImages = useCallback((next) => {
      const clean = {};
      if (next?.background) clean.background = next.background;
      if (next?.centerpiece) clean.centerpiece = next.centerpiece;
      persistImages(clean);
      setImages(clean);
    }, []);
    return { images, setImage, clearImage, applyImages };
  }

  // src/hooks/useSettings.js
  var KEY = "bm_settings_v1";
  var DEFAULT_SETTINGS = {
    centerpiece: 38,
    centerpieceY: 0,
    centerpieceOpacity: 1,
    bgOpacity: 1,
    bgBlur: 0,
    tintColor: "#000000",
    tintStrength: 0,
    waveStyle: "rings",
    barSpread: 0.72,
    barWidth: 0.58,
    barGap: 0.42,
    waveColorMode: "classic",
    waveColor: "#8a7cff",
    waveSaturation: 1,
    ringSize: 1,
    barHeight: 1,
    waveOpacity: 1,
    waveGlow: 1,
    audioReactive: true,
    labelFont: "Montserrat",
    labelSize: 1,
    labelColor: "#ffffff",
    particleType: "none",
    particleDensity: 1,
    particleSpeed: 1,
    particleSize: 1,
    particleOpacity: 1,
    particleColor: "#ffffff",
    particleBeat: false
  };
  function migrate(s) {
    if (s.waveScale != null) {
      if (s.ringSize == null) s.ringSize = s.waveScale;
      if (s.barHeight == null) s.barHeight = s.waveScale;
      delete s.waveScale;
    }
    if (s.waveColorMode === "mono") {
      s.waveColorMode = "classic";
      if (s.waveSaturation == null) s.waveSaturation = 0;
    }
    return s;
  }
  function load() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      stored = {};
    }
    return { ...DEFAULT_SETTINGS, ...migrate(stored) };
  }
  function persist(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
    }
  }
  function useSettings() {
    const [settings, setSettings] = useState(load);
    const setSetting = useCallback((key, value) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    }, []);
    const resetSettings = useCallback(() => {
      persist(DEFAULT_SETTINGS);
      setSettings({ ...DEFAULT_SETTINGS });
    }, []);
    const applySettings = useCallback((obj) => {
      const next = { ...DEFAULT_SETTINGS, ...migrate({ ...obj || {} }) };
      persist(next);
      setSettings(next);
    }, []);
    return { settings, setSetting, resetSettings, applySettings };
  }

  // src/hooks/usePresets.js
  async function load2() {
    try {
      const v = await idbGet(PRESETS_KEY);
      if (Array.isArray(v)) return v;
    } catch {
    }
    try {
      const ls = JSON.parse(localStorage.getItem(PRESETS_KEY));
      if (Array.isArray(ls)) {
        idbSet(PRESETS_KEY, ls).catch(() => {
        });
        localStorage.removeItem(PRESETS_KEY);
        return ls;
      }
    } catch {
    }
    return [];
  }
  function usePresets() {
    const [presets, setPresets] = useState([]);
    useEffect(() => {
      let alive = true;
      load2().then((v) => {
        if (alive) setPresets(v);
      });
      return () => {
        alive = false;
      };
    }, []);
    const savePreset = useCallback(async (name, settings, images) => {
      const clean = (name || "").trim() || "Preset";
      const preset = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: clean,
        settings,
        images: images || {}
      };
      const current = await load2();
      const next = [...current.filter((p) => p.name !== clean), preset];
      if (!await setCapped(PRESETS_KEY, next)) return false;
      setPresets(next);
      return true;
    }, []);
    const deletePreset = useCallback(async (id) => {
      const next = (await load2()).filter((p) => p.id !== id);
      idbSet(PRESETS_KEY, next).catch(() => {
      });
      setPresets(next);
    }, []);
    return { presets, savePreset, deletePreset };
  }

  // src/lib/audioData.js
  var cache = /* @__PURE__ */ new Map();
  function trackIdFromUri(uri) {
    if (typeof uri !== "string") return null;
    const parts = uri.split(":");
    return parts.length >= 3 && parts[parts.length - 2] === "track" ? parts[parts.length - 1] : null;
  }
  function fetchAnalysis(trackUri) {
    const id = trackIdFromUri(trackUri);
    if (!id) return Promise.resolve(null);
    if (cache.has(id)) return cache.get(id);
    const p = (async () => {
      try {
        const data = await window.Spicetify?.getAudioData?.(trackUri);
        if (!data || !Array.isArray(data.segments) || !data.segments.length) return null;
        return data;
      } catch {
        return null;
      }
    })();
    cache.set(id, p);
    return p;
  }
  function indexAt(intervals, tSec) {
    let lo = 0;
    let hi = intervals.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      if (intervals[mid].start <= tSec) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }
  var DB_FLOOR = -28;
  var DB_CEIL = -4;
  function dbToUnit(db) {
    if (typeof db !== "number" || !Number.isFinite(db)) return 0;
    const u = (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
    return u < 0 ? 0 : u > 1 ? 1 : u;
  }
  function sampleLoudness(analysis, ms) {
    const segs = analysis?.segments;
    if (!segs || !segs.length) return 0;
    const t = ms / 1e3;
    const s = segs[indexAt(segs, t)];
    const local = t - s.start;
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
  function sampleBands(analysis, ms) {
    const segs = analysis?.segments;
    if (!segs || !segs.length) return null;
    const s = segs[indexAt(segs, ms / 1e3)];
    return Array.isArray(s.pitches) && s.pitches.length === 12 ? s.pitches : null;
  }
  function beatIndexAt(analysis, ms) {
    const beats = analysis?.beats;
    if (!beats || !beats.length) return -1;
    return indexAt(beats, ms / 1e3);
  }

  // src/hooks/useBeat.js
  function useBeat(nowPlaying, { audioReactive = true } = {}) {
    const ref = useRef({
      analysis: null,
      anchorMs: 0,
      anchorAt: 0,
      isPlaying: false,
      lastBeat: -1
    });
    const [mode, setMode] = useState("decorative");
    useEffect(() => {
      ref.current.anchorMs = nowPlaying.progressMs || 0;
      ref.current.anchorAt = nowPlaying.fetchedAt || Date.now();
      ref.current.isPlaying = !!nowPlaying.isPlaying;
    }, [nowPlaying.progressMs, nowPlaying.fetchedAt, nowPlaying.isPlaying]);
    const trackUri = nowPlaying.track?.uri;
    useEffect(() => {
      ref.current.analysis = null;
      ref.current.lastBeat = -1;
      if (!trackUri) {
        setMode("decorative");
        return;
      }
      let active = true;
      fetchAnalysis(trackUri).then((a) => {
        if (!active) return;
        ref.current.analysis = a;
        setMode(a ? "audio" : "decorative");
      });
      return () => {
        active = false;
      };
    }, [trackUri]);
    const getPulse = useCallback(() => {
      const s = ref.current;
      const now = Date.now();
      const positionMs = s.anchorMs + (s.isPlaying ? now - s.anchorAt : 0);
      if (audioReactive && s.analysis) {
        const value = sampleLoudness(s.analysis, positionMs);
        const bands = sampleBands(s.analysis, positionMs);
        const bi = beatIndexAt(s.analysis, positionMs);
        const beat = bi >= 0 && bi !== s.lastBeat;
        if (beat) s.lastBeat = bi;
        return { value, bands, beat, beatPhase: 0, isPlaying: s.isPlaying, mode: "audio" };
      }
      const breathe = (Math.sin(now / 700) + 1) / 2;
      return {
        value: 0.4 + 0.3 * breathe,
        beatPhase: 0,
        isPlaying: s.isPlaying,
        mode: "decorative"
      };
    }, [audioReactive]);
    return { getPulse, mode };
  }

  // src/lib/palette.js
  var cache2 = /* @__PURE__ */ new Map();
  function rgbToHex(r, g, b) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  function extractPalette(src) {
    if (!src) return Promise.resolve(null);
    if (cache2.has(src)) return cache2.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const N = 44;
          const canvas = document.createElement("canvas");
          canvas.width = N;
          canvas.height = N;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, N, N);
          const data = ctx.getImageData(0, 0, N, N).data;
          const buckets = /* @__PURE__ */ new Map();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const key = (r * 5 >> 8) * 25 + (g * 5 >> 8) * 5 + (b * 5 >> 8);
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
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cache2.set(src, p);
    return p;
  }

  // src/lib/albumColors.js
  var cache3 = /* @__PURE__ */ new Map();
  var HEX = /^#?[0-9a-f]{6}$/i;
  function fetchAlbumColors(trackUri) {
    if (!trackUri) return Promise.resolve(null);
    if (cache3.has(trackUri)) return cache3.get(trackUri);
    const p = (async () => {
      try {
        const c = await window.Spicetify?.colorExtractor?.(trackUri);
        if (!c) return null;
        const order = [c.VIBRANT, c.LIGHT_VIBRANT, c.PROMINENT, c.DARK_VIBRANT];
        const seen = /* @__PURE__ */ new Set();
        const out = [];
        for (const hex of order) {
          const key = typeof hex === "string" && HEX.test(hex) ? hex.toLowerCase() : null;
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
    cache3.set(trackUri, p);
    return p;
  }

  // src/hooks/useWavePalette.js
  function useWavePalette(mode, src, fallbackUri) {
    const [colors, setColors] = useState(null);
    const active = mode === "album" || mode === "centerpiece";
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

  // src/components/SoundWaves.jsx
  function hexToHS(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m) return { h: 270, s: 70 };
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = (g - b) / d % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: s * 100 };
  }
  function SoundWaves({
    getPulse,
    style = "rings",
    barSpread = 0.72,
    barWidth = 0.58,
    barGap = 0.42,
    colorMode = "auto",
    color = "#8a7cff",
    saturation = 1,
    paletteColors = null,
    ringSize = 1,
    barHeight = 1,
    opacityMul = 1,
    glowMul = 1
  }) {
    const canvasRef = useRef(null);
    const getPulseRef = useRef(getPulse);
    getPulseRef.current = getPulse;
    const styleRef = useRef(style);
    styleRef.current = style;
    const barSpreadRef = useRef(barSpread);
    barSpreadRef.current = barSpread;
    const barWidthRef = useRef(barWidth);
    barWidthRef.current = barWidth;
    const barGapRef = useRef(barGap);
    barGapRef.current = barGap;
    const colorModeRef = useRef(colorMode);
    colorModeRef.current = colorMode;
    const colorRef = useRef(color);
    colorRef.current = color;
    const satRef = useRef(saturation);
    satRef.current = saturation;
    const paletteRef = useRef(paletteColors);
    paletteRef.current = paletteColors;
    const ringSizeRef = useRef(ringSize);
    ringSizeRef.current = ringSize;
    const barHeightRef = useRef(barHeight);
    barHeightRef.current = barHeight;
    const opacityRef = useRef(opacityMul);
    opacityRef.current = opacityMul;
    const glowRef = useRef(glowMul);
    glowRef.current = glowMul;
    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const MAX_DIM = 1920;
      const dpr = () => {
        const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const longest = Math.max(canvas.clientWidth, canvas.clientHeight) || 1;
        return longest * baseDpr > MAX_DIM ? Math.max(0.75, MAX_DIM / longest) : baseDpr;
      };
      let raf = 0;
      let running = true;
      let amp = 0;
      let lastPhase = 1;
      let beatPulse = 0;
      let domHue = 270;
      let ripples = [];
      const bands = new Array(12).fill(0);
      function resize() {
        canvas.width = Math.round(canvas.clientWidth * dpr());
        canvas.height = Math.round(canvas.clientHeight * dpr());
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      let pal = { mode: "auto", hueBase: 0, solidH: 270, solidS: 70, sat: 1, palette: null };
      function tone(offset, idx) {
        const sat = pal.mode === "mono" ? 0 : pal.sat;
        if (pal.mode === "solid") {
          return { hue: pal.solidH, satStroke: pal.solidS * sat, satShadow: Math.min(pal.solidS + 10, 100) * sat };
        }
        if ((pal.mode === "album" || pal.mode === "centerpiece") && pal.palette && pal.palette.length) {
          const c = pal.palette[(idx % pal.palette.length + pal.palette.length) % pal.palette.length];
          return { hue: c.h, satStroke: c.s * sat, satShadow: Math.min(c.s + 10, 100) * sat };
        }
        return { hue: (pal.hueBase + offset) % 360, satStroke: 75 * sat, satShadow: 85 * sat };
      }
      function drawRings(w, h, base, t, scale, sizeMul, opacityMul2, glowMul2) {
        const cx = w / 2;
        const cy = h / 2;
        const RINGS = 4;
        for (let i = 0; i < RINGS; i++) {
          const ringR = base * (0.15 + i * 0.05) * (1 + amp * 0.5) * sizeMul;
          const wobble = base * 0.02 * (0.5 + amp) * sizeMul;
          const segs = 120;
          ctx.beginPath();
          for (let a = 0; a <= segs; a++) {
            const ang = a / segs * Math.PI * 2;
            const fb = ang / (Math.PI * 2) * 12;
            const i0 = Math.floor(fb) % 12;
            const i1 = (i0 + 1) % 12;
            const frac = fb - Math.floor(fb);
            const bandPert = (bands[i0] * (1 - frac) + bands[i1] * frac) * base * 0.045 * sizeMul;
            const pert = Math.sin(ang * (3 + i) + t * (1.2 + i * 0.3)) * wobble + Math.sin(ang * (5 + i) - t * 0.8) * wobble * 0.5 + bandPert;
            const r = ringR + pert + amp * base * 0.04 * sizeMul * Math.sin(ang * 2 + t);
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          const { hue, satStroke, satShadow } = tone(i * 28, i);
          ctx.shadowBlur = Math.min(scale * (4 + amp * 8) * glowMul2, scale * 8);
          ctx.shadowColor = `hsla(${hue}, ${satShadow}%, 62%, 0.7)`;
          ctx.strokeStyle = `hsla(${hue}, ${satStroke}%, 68%, ${(0.19 + amp * 0.33) * opacityMul2})`;
          ctx.lineWidth = scale * (2 + i * 0.7);
          ctx.stroke();
        }
        ripples = ripples.filter((r) => r.life > 0);
        for (const ring of ripples) {
          ring.r += base * 6e-3 * sizeMul;
          ring.life -= 0.018;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
          const { hue, satStroke, satShadow } = tone(0, 0);
          ctx.shadowBlur = Math.min(scale * 6 * glowMul2, scale * 8);
          ctx.shadowColor = `hsla(${hue}, ${satShadow}%, 65%, 0.7)`;
          ctx.strokeStyle = `hsla(${hue}, ${satStroke}%, 75%, ${ring.life * 0.32 * opacityMul2})`;
          ctx.lineWidth = scale * 2.5;
          ctx.stroke();
        }
      }
      const REF_SLOT = 0.0225;
      const MAX_BARS = 160;
      function drawBars(w, h, base, scale, sizeMul, opacityMul2, glowMul2) {
        const spanW = w * barSpreadRef.current;
        const bw = Math.max(1, barWidthRef.current * REF_SLOT * w);
        const gap = Math.max(0, barGapRef.current * REF_SLOT * w);
        const pitch = bw + gap;
        const N = Math.max(3, Math.min(MAX_BARS, Math.floor(spanW / pitch)));
        const used = N * pitch - gap;
        const x0 = (w - used) / 2;
        const baseY = h * 0.72;
        const half = (N - 1) / 2;
        const r = Math.min(bw / 2, scale * 4);
        ctx.beginPath();
        for (let j = 0; j < N; j++) {
          const d = half > 0 ? Math.abs(j - half) / half : 0;
          const bp = d * 11;
          const i0 = Math.floor(bp);
          const i1 = Math.min(i0 + 1, 11);
          const bandVal = bands[i0] * (1 - (bp - i0)) + bands[i1] * (bp - i0);
          const env = 1 - d * 0.45;
          const v = amp * env * (0.4 + 1.3 * bandVal) + 0.12 * amp * beatPulse;
          const hgt = base * sizeMul * (0.015 + 0.42 * Math.min(v, 1.6));
          const x = x0 + j * pitch;
          if (ctx.roundRect) ctx.roundRect(x, baseY - hgt, bw, hgt, r);
          else ctx.rect(x, baseY - hgt, bw, hgt);
        }
        const grad = ctx.createLinearGradient(x0, 0, x0 + used, 0);
        const STOPS = 8;
        const alpha = (0.3 + amp * 0.4) * opacityMul2;
        for (let s = 0; s <= STOPS; s++) {
          const frac = s / STOPS;
          const { hue, satStroke } = tone(frac * 120, Math.round(frac * (N - 1)));
          grad.addColorStop(frac, `hsla(${hue}, ${satStroke}%, 66%, ${alpha})`);
        }
        ctx.fillStyle = grad;
        const mid = tone(60, Math.round(half));
        ctx.shadowBlur = Math.min(scale * (4 + amp * 7) * glowMul2, scale * 8);
        ctx.shadowColor = `hsla(${mid.hue}, ${mid.satShadow}%, 62%, 0.7)`;
        ctx.fill();
      }
      function frame() {
        if (!running) return;
        const p = getPulseRef.current();
        const w = canvas.width;
        const h = canvas.height;
        const base = Math.min(w, h);
        const t = performance.now() / 1e3;
        const scale = dpr();
        const target = p.isPlaying ? p.value : 0;
        amp += (target - amp) * 0.12;
        if (!p.isPlaying && amp < 0.012) {
          if (ripples.length) ripples = [];
          ctx.clearRect(0, 0, w, h);
          raf = requestAnimationFrame(frame);
          return;
        }
        const srcBands = p.bands;
        let domIdx = 0;
        for (let b = 0; b < 12; b++) {
          const tb = srcBands && p.isPlaying ? srcBands[b] : 0;
          bands[b] += (tb - bands[b]) * 0.18;
          if (bands[b] > bands[domIdx]) domIdx = b;
        }
        const targetHue = domIdx / 12 * 360;
        let dh = targetHue - domHue;
        dh -= Math.round(dh / 360) * 360;
        domHue = (domHue + dh * 0.02 + 360) % 360;
        const beatNow = p.isPlaying && (p.beat || p.mode === "beat" && p.beatPhase < lastPhase - 0.3);
        lastPhase = p.beatPhase;
        beatPulse *= 0.9;
        if (beatNow) beatPulse = 1;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        const mode = colorModeRef.current;
        const { h: solidH, s: solidS } = hexToHS(colorRef.current);
        const palette = (mode === "album" || mode === "centerpiece") && Array.isArray(paletteRef.current) ? paletteRef.current.map(hexToHS) : null;
        const hueBase = mode === "auto" ? (t * 6 + domHue * 0.7) % 360 : t * 6 % 360;
        const sat = Math.max(0, Math.min(1, satRef.current));
        pal = { mode, hueBase, solidH, solidS, sat, palette };
        const styleNow = styleRef.current;
        const ringSizeNow = ringSizeRef.current;
        const barHeightNow = barHeightRef.current;
        const opacityMul2 = opacityRef.current;
        const glowMul2 = glowRef.current;
        if (styleNow === "bars" || styleNow === "both") {
          drawBars(w, h, base, scale, barHeightNow, opacityMul2, glowMul2);
        }
        if (styleNow === "rings" || styleNow === "both") {
          if (beatNow) ripples.push({ r: base * 0.17 * ringSizeNow, life: 1 });
          drawRings(w, h, base, t, scale, ringSizeNow, opacityMul2, glowMul2);
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
        raf = requestAnimationFrame(frame);
      }
      frame();
      const onVisible = () => {
        if (document.hidden) {
          running = false;
          cancelAnimationFrame(raf);
        } else if (!running) {
          running = true;
          frame();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, []);
    return /* @__PURE__ */ Spicetify.React.createElement("canvas", { ref: canvasRef, className: "waves" });
  }

  // src/components/Particles.jsx
  var rand = (a, b) => a + Math.random() * (b - a);
  var REF_AREA = 1280 * 720;
  var MAX_PARTICLES = 320;
  function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    const n = parseInt(full, 16);
    return Number.isNaN(n) ? { r: 255, g: 255, b: 255 } : { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
  }
  var EFFECTS = {
    dust: {
      baseCount: 70,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(0, h);
        p.r = rand(6, 22);
        p.vx = rand(-8, 8);
        p.vy = rand(-8, 8);
        p.ph = rand(0, Math.PI * 2);
        p.a = rand(0.18, 0.5);
      },
      step(p, e) {
        p.x += p.vx * e.speed * e.boost * e.dt;
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.ph += e.dt * 0.6;
        wrap(p, e);
      },
      draw(ctx, p, rgb, e) {
        const r = p.r * e.size * e.boost;
        const a = p.a * (0.6 + 0.4 * Math.sin(p.ph)) * e.opacity;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
        g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    snow: {
      baseCount: 140,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(-h, h);
        p.r = rand(1.5, 4);
        p.vy = rand(20, 60);
        p.sp = rand(0, Math.PI * 2);
        p.sa = rand(8, 26);
      },
      step(p, e) {
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.x += Math.sin(e.t * 0.5 + p.sp) * p.sa * e.speed * e.dt;
        if (p.y > e.h + p.r * e.size) {
          p.y = -p.r * e.size;
          p.x = rand(0, e.w);
        }
      },
      draw(ctx, p, rgb, e) {
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * e.size * e.boost, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    petals: {
      baseCount: 60,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(-h, h);
        p.r = rand(5, 11);
        p.vy = rand(25, 60);
        p.rot = rand(0, Math.PI * 2);
        p.vr = rand(-2, 2);
        p.sp = rand(0, Math.PI * 2);
        p.sa = rand(20, 50);
      },
      step(p, e) {
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.x += Math.sin(e.t * 0.7 + p.sp) * p.sa * e.speed * e.dt;
        p.rot += p.vr * e.dt;
        if (p.y > e.h + p.r * e.size * 2) {
          p.y = -p.r * e.size * 2;
          p.x = rand(0, e.w);
        }
      },
      draw(ctx, p, rgb, e) {
        const r = p.r * e.size * e.boost;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    stars: {
      baseCount: 160,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(0, h);
        p.r = rand(0.6, 2.2);
        p.vx = rand(-3, 3);
        p.tp = rand(0, Math.PI * 2);
        p.ts = rand(0.5, 2);
      },
      step(p, e) {
        p.x += p.vx * e.speed * e.dt;
        p.tp += e.dt * p.ts * e.boost;
        wrap(p, e);
      },
      draw(ctx, p, rgb, e) {
        const a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.tp))) * e.opacity;
        glowDot(ctx, p.x, p.y, Math.max(p.r * e.size * 2.4, 1.6), rgb, a);
      }
    },
    fireflies: {
      baseCount: 45,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(0, h);
        p.r = rand(1.5, 3.5);
        p.vx = rand(-15, 15);
        p.vy = rand(-15, 15);
        p.bp = rand(0, Math.PI * 2);
        p.bs = rand(0.5, 1.5);
      },
      step(p, e) {
        p.vx += rand(-30, 30) * e.dt;
        p.vy += rand(-30, 30) * e.dt;
        p.vx = Math.max(-25, Math.min(25, p.vx));
        p.vy = Math.max(-25, Math.min(25, p.vy));
        p.x += p.vx * e.speed * e.boost * e.dt;
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.bp += e.dt * p.bs;
        wrap(p, e);
      },
      draw(ctx, p, rgb, e) {
        const a = (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(p.bp))) * e.opacity;
        const r = p.r * e.size * e.boost;
        glowDot(ctx, p.x, p.y, r * 2.8, rgb, a);
      }
    },
    notes: {
      baseCount: 36,
      glyphs: ["\u266A", "\u266B", "\u266C"],
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(0, h * 1.5);
        p.r = rand(14, 30);
        p.vy = rand(-25, -55);
        p.sp = rand(0, Math.PI * 2);
        p.sa = rand(15, 40);
        p.glyph = EFFECTS.notes.glyphs[Math.random() * 3 | 0];
      },
      step(p, e) {
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.x += Math.sin(e.t + p.sp) * p.sa * e.speed * e.dt;
        if (p.y < -p.r * e.size * 2) {
          p.y = e.h + p.r * e.size * 2;
          p.x = rand(0, e.w);
        }
      },
      draw(ctx, p, rgb, e) {
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 * e.opacity})`;
        ctx.font = `${p.r * e.size * e.boost}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.glyph, p.x, p.y);
      }
    },
    embers: {
      baseCount: 70,
      spawn(p, w, h) {
        p.x = rand(0, w);
        p.y = rand(0, h * 1.4);
        p.r = rand(1.5, 4);
        p.vy = rand(-30, -70);
        p.vx = rand(-10, 10);
        p.fp = rand(0, Math.PI * 2);
        p.fs = rand(3, 7);
      },
      step(p, e) {
        p.y += p.vy * e.speed * e.boost * e.dt;
        p.x += (p.vx * e.speed + Math.sin(e.t * 2 + p.fp) * 10) * e.dt;
        p.fp += e.dt * p.fs;
        if (p.y < -p.r * e.size * 2) {
          p.y = e.h + p.r * e.size * 2;
          p.x = rand(0, e.w);
        }
      },
      draw(ctx, p, rgb, e) {
        const a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.fp))) * e.opacity;
        const r = p.r * e.size * e.boost;
        glowDot(ctx, p.x, p.y, r * 2.4, rgb, a);
      }
    }
  };
  function glowDot(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
    g.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.55})`);
    g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function wrap(p, e) {
    const m = (p.r || 4) * e.size + 4;
    if (p.x < -m) p.x = e.w + m;
    else if (p.x > e.w + m) p.x = -m;
    if (p.y < -m) p.y = e.h + m;
    else if (p.y > e.h + m) p.y = -m;
  }
  function Particles({ getPulse, type, density = 1, speed = 1, size = 1, opacity = 1, color = "#ffffff", beat = false }) {
    const canvasRef = useRef(null);
    const refs = useRef({});
    refs.current = { getPulse, type, density, speed, size, opacity, color, beat };
    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const MAX_DIM = 1920;
      const dpr = () => {
        const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const longest = Math.max(canvas.clientWidth, canvas.clientHeight) || 1;
        return longest * baseDpr > MAX_DIM ? Math.max(0.75, MAX_DIM / longest) : baseDpr;
      };
      let raf = 0;
      let running = true;
      let particles = [];
      let lastType = null;
      let boost = 1;
      let lastTime = performance.now();
      function resize() {
        canvas.width = Math.round(canvas.clientWidth * dpr());
        canvas.height = Math.round(canvas.clientHeight * dpr());
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      function frame() {
        if (!running) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1e3);
        lastTime = now;
        const s = refs.current;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const effect = EFFECTS[s.type];
        if (!effect) {
          raf = requestAnimationFrame(frame);
          return;
        }
        if (s.type !== lastType) {
          particles = [];
          lastType = s.type;
        }
        const area = canvas.clientWidth * canvas.clientHeight;
        const target = Math.max(
          0,
          Math.min(MAX_PARTICLES, Math.round(effect.baseCount * s.density * (area / REF_AREA)))
        );
        while (particles.length < target) {
          const p = {};
          effect.spawn(p, w, h);
          particles.push(p);
        }
        if (particles.length > target) particles.length = target;
        const pulse = s.beat && s.getPulse ? s.getPulse() : null;
        const targetBoost = pulse && pulse.isPlaying ? 1 + pulse.value * 0.6 : 1;
        boost += (targetBoost - boost) * 0.15;
        const scale = dpr();
        const env = {
          w,
          h,
          dt,
          t: now / 1e3,
          speed: s.speed * scale,
          size: s.size * scale,
          opacity: s.opacity,
          boost
        };
        for (const p of particles) effect.step(p, env);
        for (const p of particles) effect.draw(ctx, p, hexToRgb(s.color), env);
        raf = requestAnimationFrame(frame);
      }
      frame();
      const onVisible = () => {
        if (document.hidden) {
          running = false;
          cancelAnimationFrame(raf);
        } else if (!running) {
          running = true;
          lastTime = performance.now();
          frame();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, []);
    return /* @__PURE__ */ Spicetify.React.createElement("canvas", { ref: canvasRef, className: "particles" });
  }

  // src/components/NowPlayingLabel.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-NowPlayingLabel.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-NowPlayingLabel.css";
    el.textContent = ".np {\n  position: absolute;\n  left: 2rem;\n  bottom: 2rem;\n  z-index: 30;\n  display: flex;\n  align-items: flex-end;\n  gap: 0.75rem;\n  max-width: min(70vw, 480px);\n  color: var(--label-fg);\n  text-shadow: var(--label-shadow);\n  pointer-events: none;\n}\n\n.np--empty {\n  position: absolute;\n  left: 2rem;\n  bottom: 2rem;\n  z-index: 30;\n  color: rgba(255, 255, 255, 0.6);\n  text-shadow: var(--label-shadow);\n  font-size: 0.95rem;\n}\n\n.np__text {\n  min-width: 0;\n}\n\n.np__title {\n  font-size: 1.5em;\n  font-weight: 700;\n  letter-spacing: -0.01em;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.np__artist {\n  font-size: 1em;\n  opacity: 0.85;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* Equalizer bars \u2014 sized in em so they scale with the label's font size. */\n.np__eq {\n  display: flex;\n  align-items: flex-end;\n  gap: 0.2em;\n  height: 1.5em;\n  padding-bottom: 0.25em;\n}\n\n.np__eq span {\n  width: 0.2em;\n  height: 30%;\n  background: currentColor;\n  border-radius: 0.12em;\n}\n\n.np__eq[data-playing='true'] span {\n  animation: np-eq 0.9s ease-in-out infinite;\n}\n\n.np__eq span:nth-child(2) {\n  animation-delay: 0.3s;\n}\n.np__eq span:nth-child(3) {\n  animation-delay: 0.6s;\n}\n\n@keyframes np-eq {\n  0%,\n  100% {\n    height: 25%;\n  }\n  50% {\n    height: 100%;\n  }\n}\n";
    document.head.appendChild(el);
  })();

  // src/components/NowPlayingLabel.jsx
  function NowPlayingLabel({ track, isPlaying, font, size = 1, color }) {
    const style = {
      fontFamily: font ? `'${font}', sans-serif` : void 0,
      fontSize: `${size}rem`,
      color
    };
    if (!track) {
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np np--empty", style }, "Nothing playing \u2014 press play in Spotify");
    }
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np", style }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np__eq", "data-playing": isPlaying ? "true" : "false", "aria-hidden": true }, /* @__PURE__ */ Spicetify.React.createElement("span", null), /* @__PURE__ */ Spicetify.React.createElement("span", null), /* @__PURE__ */ Spicetify.React.createElement("span", null)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np__text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np__title", title: track.name }, track.name), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "np__artist", title: track.artist }, track.artist)));
  }

  // src/components/Visualizer.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-Visualizer.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-Visualizer.css";
    el.textContent = ".viz {\n  position: fixed;\n  inset: 0;\n  overflow: hidden;\n  background: radial-gradient(circle at 50% 35%, #221d3d 0%, #0a0a0f 75%);\n  /* Query container so the centerpiece can size to THIS scene (cqmin/cqh) rather than the\n     viewport. In fullscreen the scene == viewport (cqmin == vmin), so it's unchanged; in\n     embedded mode the scene is smaller, so the centerpiece scales down with it \u2014 matching the\n     canvas waves/particles, which already fill the container. */\n  container-type: size;\n}\n\n/* Background layer */\n.viz__bg {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  background-size: cover;\n  background-position: center;\n  transition: background-image 0.6s ease;\n}\n\n/* Color tint overlaid on top of the background (behind the waves/centerpiece). */\n.viz__tint {\n  position: absolute;\n  inset: 0;\n  z-index: 12;\n  pointer-events: none;\n}\n\n/* When falling back to album art, blow it up + blur for an ambient backdrop. */\n.viz__bg--art {\n  transform: scale(1.3);\n  filter: blur(40px) saturate(1.2) brightness(0.7);\n}\n\n/* Darkening/vignette scrim for legibility */\n.viz__scrim {\n  position: absolute;\n  inset: 0;\n  z-index: 10;\n  background: radial-gradient(circle at 50% 45%, transparent 35%, rgba(0, 0, 0, 0.45) 100%);\n  pointer-events: none;\n}\n\n.waves {\n  position: absolute;\n  inset: 0;\n  z-index: 15;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n/* Particle layer: in front of the waves, behind the centerpiece. */\n.particles {\n  position: absolute;\n  inset: 0;\n  z-index: 16;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n/* Centerpiece */\n.viz__center-wrap {\n  position: absolute;\n  inset: 0;\n  z-index: 20;\n  display: grid;\n  place-items: center;\n  pointer-events: none;\n}\n\n.viz__center {\n  width: var(--cp-size, 38cqmin);\n  max-width: 100cqw;\n  height: auto;\n  object-fit: contain;\n  filter: drop-shadow(0 20px 50px rgba(0, 0, 0, 0.55));\n  animation: viz-bob 6s ease-in-out infinite;\n}\n\n/* Album-art fallback: square image \u2192 round it off so it reads as a centerpiece. */\n.viz__center--art {\n  width: var(--cp-size, 40cqmin);\n  height: var(--cp-size, 40cqmin);\n  max-width: 100cqw;\n  max-height: 100cqh;\n  object-fit: cover;\n  border-radius: 24px;\n}\n\n@keyframes viz-bob {\n  0%,\n  100% {\n    transform: translateY(-6px);\n  }\n  50% {\n    transform: translateY(6px);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .viz__center {\n    animation: none;\n  }\n}\n";
    document.head.appendChild(el);
  })();

  // src/components/Visualizer.jsx
  function Visualizer({ nowPlaying, backgroundUrl, centerpieceUrl, settings }) {
    const { getPulse } = useBeat(nowPlaying, { audioReactive: settings.audioReactive });
    const albumArt2 = nowPlaying.track?.albumArtUrl || null;
    const bg = backgroundUrl || albumArt2;
    const center = centerpieceUrl || albumArt2;
    const paletteSrc = settings.waveColorMode === "centerpiece" ? center : albumArt2;
    const paletteColors = useWavePalette(settings.waveColorMode, paletteSrc, nowPlaying.track?.uri);
    const bgStyle = { opacity: settings.bgOpacity };
    if (bg) bgStyle.backgroundImage = `url(${bg})`;
    if (backgroundUrl && settings.bgBlur > 0) {
      bgStyle.filter = `blur(${settings.bgBlur}px)`;
      bgStyle.transform = "scale(1.12)";
    }
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "viz" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: `viz__bg ${backgroundUrl ? "" : "viz__bg--art"}`, style: bgStyle }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "viz__scrim" }), /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "viz__tint",
        style: { background: settings.tintColor, opacity: settings.tintStrength }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement(
      SoundWaves,
      {
        getPulse,
        style: settings.waveStyle,
        barSpread: settings.barSpread,
        barWidth: settings.barWidth,
        barGap: settings.barGap,
        colorMode: settings.waveColorMode,
        color: settings.waveColor,
        saturation: settings.waveSaturation,
        paletteColors,
        ringSize: settings.ringSize,
        barHeight: settings.barHeight,
        opacityMul: settings.waveOpacity,
        glowMul: settings.waveGlow
      }
    ), /* @__PURE__ */ Spicetify.React.createElement(
      Particles,
      {
        getPulse,
        type: settings.particleType,
        density: settings.particleDensity,
        speed: settings.particleSpeed,
        size: settings.particleSize,
        opacity: settings.particleOpacity,
        color: settings.particleColor,
        beat: settings.particleBeat
      }
    ), center && /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "viz__center-wrap",
        style: {
          "--cp-size": `${settings.centerpiece}cqmin`,
          transform: `translateY(${settings.centerpieceY}cqh)`,
          opacity: settings.centerpieceOpacity
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement(
        "img",
        {
          className: `viz__center ${centerpieceUrl ? "" : "viz__center--art"}`,
          src: center,
          alt: ""
        }
      )
    ), /* @__PURE__ */ Spicetify.React.createElement(
      NowPlayingLabel,
      {
        track: nowPlaying.track,
        isPlaying: nowPlaying.isPlaying,
        font: settings.labelFont,
        size: settings.labelSize,
        color: settings.labelColor
      }
    ));
  }

  // src/components/CenterpieceEditor.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-CenterpieceEditor.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-CenterpieceEditor.css";
    el.textContent = ".cpe-overlay {\n  position: fixed;\n  inset: 0;\n  /* Above the .bm-root full-screen takeover (z-index 5000) \u2014 this overlay portals to\n     <body>, so it must out-rank the app root to stay visible while editing. */\n  z-index: 6000;\n  display: grid;\n  place-items: center;\n  background: rgba(0, 0, 0, 0.6);\n  backdrop-filter: blur(4px);\n  padding: 1rem;\n}\n\n.cpe {\n  width: 420px;\n  max-width: 100%;\n  padding: 1.25rem;\n  border-radius: 16px;\n  background: rgba(20, 20, 28, 0.95);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  color: #fff;\n  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);\n}\n\n.cpe__header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 1rem;\n}\n\n.cpe__header h2 {\n  margin: 0;\n  font-size: 1.1rem;\n}\n\n.cpe__close {\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.7);\n  font-size: 1.5rem;\n  line-height: 1;\n}\n\n.cpe__stage {\n  position: relative;\n  height: 280px;\n  border-radius: 12px;\n  overflow: hidden;\n  display: grid;\n  place-items: center;\n  background: #000;\n}\n\n/* Checkerboard so transparency is visible after removal. */\n.cpe__stage--alpha {\n  background-color: #2a2a32;\n  background-image: linear-gradient(45deg, #3a3a44 25%, transparent 25%),\n    linear-gradient(-45deg, #3a3a44 25%, transparent 25%),\n    linear-gradient(45deg, transparent 75%, #3a3a44 75%),\n    linear-gradient(-45deg, transparent 75%, #3a3a44 75%);\n  background-size: 20px 20px;\n  background-position: 0 0, 0 10px, 10px -10px, -10px 0;\n}\n\n/* Wrapper sizes exactly to the displayed image so marquee % maps to image pixels. */\n.cpe__selwrap {\n  position: relative;\n  display: inline-flex;\n  max-width: 100%;\n  max-height: 100%;\n  line-height: 0;\n}\n\n.cpe__selwrap--active {\n  cursor: crosshair;\n  touch-action: none; /* let pointer drags work on touch devices */\n}\n\n.cpe__stage img {\n  max-width: 100%;\n  max-height: 280px;\n  object-fit: contain;\n  user-select: none;\n  -webkit-user-drag: none;\n}\n\n/* Freehand lasso overlay: dims outside the drawn loop and highlights inside. */\n.cpe__lasso {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.cpe__lasso-mask {\n  fill: rgba(0, 0, 0, 0.55);\n}\n\n.cpe__lasso-shape {\n  fill: rgba(124, 92, 255, 0.18);\n  stroke: #fff;\n  stroke-width: 2;\n  stroke-dasharray: 6 4;\n  stroke-linejoin: round;\n  vector-effect: non-scaling-stroke;\n}\n\n.cpe__loading {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 0.75rem;\n  padding: 0 2rem;\n  background: rgba(0, 0, 0, 0.55);\n  font-size: 0.95rem;\n}\n\n.cpe__loading-label {\n  font-variant-numeric: tabular-nums;\n}\n\n.cpe__bar {\n  width: 100%;\n  max-width: 240px;\n  height: 8px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.15);\n  overflow: hidden;\n}\n\n.cpe__bar-fill {\n  height: 100%;\n  border-radius: 999px;\n  background: linear-gradient(90deg, #7c5cff, #b14dff);\n  transition: width 0.12s linear;\n}\n\n.cpe__error {\n  margin: 0.75rem 0 0;\n  font-size: 0.8rem;\n  color: #ff8f8f;\n}\n\n.cpe__actions {\n  display: flex;\n  gap: 0.6rem;\n  margin-top: 1rem;\n}\n\n.cpe__btn {\n  flex: 1;\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n  border-radius: 10px;\n  padding: 0.65rem;\n  font-size: 0.9rem;\n  font-weight: 600;\n}\n\n.cpe__btn:disabled {\n  opacity: 0.5;\n}\n\n.cpe__btn--magic {\n  background: linear-gradient(135deg, #7c5cff, #b14dff);\n  border-color: transparent;\n}\n\n.cpe__btn--use {\n  background: #1db954;\n  border-color: transparent;\n  color: #06210f;\n}\n\n/* Refine sliders */\n.cpe__sliders {\n  margin-top: 1rem;\n  display: flex;\n  flex-direction: column;\n  gap: 0.6rem;\n}\n\n.cpe__slider {\n  display: grid;\n  grid-template-columns: 4.5rem 1fr 3rem;\n  align-items: center;\n  gap: 0.6rem;\n  font-size: 0.85rem;\n  color: rgba(255, 255, 255, 0.85);\n}\n\n.cpe__slider input[type='range'] {\n  width: 100%;\n  accent-color: #b14dff;\n}\n\n.cpe__slider-val {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  color: rgba(255, 255, 255, 0.6);\n}\n\n.cpe__hint {\n  margin: 0.85rem 0 0;\n  font-size: 0.72rem;\n  color: rgba(255, 255, 255, 0.4);\n  line-height: 1.4;\n}\n\n.cpe__hint--tip {\n  margin: 0.75rem 0 0;\n  font-size: 0.85rem;\n  color: rgba(255, 255, 255, 0.8);\n  text-align: center;\n}\n";
    document.head.appendChild(el);
  })();

  // src/components/CenterpieceEditor.jsx
  var OUTPUT = { maxDim: 1024, mime: "image/png" };
  var POINT_GAP = 4e-3;
  var clamp01 = (n) => Math.min(1, Math.max(0, n));
  function CenterpieceEditor({ file, onConfirm, onCancel }) {
    const [originalUrl, setOriginalUrl] = useState(null);
    const [processedUrl, setProcessedUrl] = useState(null);
    const [mode, setMode] = useState("choose");
    const [path, setPath] = useState([]);
    const [source, setSource] = useState(null);
    const [polyLocal, setPolyLocal] = useState(null);
    const [feather, setFeather] = useState(2);
    const [grow, setGrow] = useState(0);
    const dragRef = useRef(null);
    useEffect(() => {
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    }, [file]);
    useEffect(() => {
      if (mode !== "refine" || !source || !polyLocal) return;
      let current = true;
      applyPolygonMask(source, polyLocal, { feather, grow }).then((url) => {
        if (current) setProcessedUrl(url);
      });
      return () => {
        current = false;
      };
    }, [mode, source, polyLocal, feather, grow]);
    async function useOriginal() {
      onConfirm(await fileToDataUrl(file, OUTPUT));
    }
    function resetToChoose() {
      setProcessedUrl(null);
      setMode("choose");
      setPath([]);
      setSource(null);
      setPolyLocal(null);
      setFeather(2);
      setGrow(0);
    }
    function startSelect() {
      setProcessedUrl(null);
      setPath([]);
      setMode("select");
    }
    async function enterRefine() {
      const { cropDataUrl, polyLocal: poly } = await cropToBBox(file, path, OUTPUT);
      setSource(cropDataUrl);
      setPolyLocal(poly);
      setFeather(2);
      setGrow(0);
      setMode("refine");
    }
    function pointAt(e, rect) {
      return {
        x: clamp01((e.clientX - rect.left) / rect.width),
        y: clamp01((e.clientY - rect.top) / rect.height)
      };
    }
    function pointerDown(e) {
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = { rect };
      setPath([pointAt(e, rect)]);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    function pointerMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const p = pointAt(e, d.rect);
      setPath((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < POINT_GAP) return prev;
        return [...prev, p];
      });
    }
    function pointerUp() {
      dragRef.current = null;
      if (path.length >= 3) enterRefine();
    }
    const selecting = mode === "select";
    const refining = mode === "refine";
    const preview = processedUrl || originalUrl;
    const showAlpha = refining && processedUrl;
    const polyPoints = path.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
    return createPortal(
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "cpe-overlay", onClick: onCancel }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "cpe", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "cpe__header" }, /* @__PURE__ */ Spicetify.React.createElement("h2", null, "Edit centerpiece"), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "cpe__close", onClick: onCancel, "aria-label": "Close" }, "\xD7")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: `cpe__stage ${showAlpha ? "cpe__stage--alpha" : ""}` }, /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: `cpe__selwrap ${selecting ? "cpe__selwrap--active" : ""}`,
          onPointerDown: selecting ? pointerDown : void 0,
          onPointerMove: selecting ? pointerMove : void 0,
          onPointerUp: selecting ? pointerUp : void 0
        },
        preview && /* @__PURE__ */ Spicetify.React.createElement("img", { src: preview, alt: "Centerpiece preview", draggable: false }),
        selecting && path.length > 1 && /* @__PURE__ */ Spicetify.React.createElement("svg", { className: "cpe__lasso", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": true }, /* @__PURE__ */ Spicetify.React.createElement(
          "path",
          {
            className: "cpe__lasso-mask",
            d: `M0 0H100V100H0Z M${polyPoints.replace(/ /g, " L").replace(/,/g, " ")}Z`,
            fillRule: "evenodd"
          }
        ), /* @__PURE__ */ Spicetify.React.createElement("polygon", { className: "cpe__lasso-shape", points: polyPoints }))
      )), selecting && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "cpe__hint cpe__hint--tip" }, "Draw a loop around the area to keep \u2014 release to refine it."), refining && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "cpe__sliders" }, /* @__PURE__ */ Spicetify.React.createElement("label", { className: "cpe__slider" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Feather"), /* @__PURE__ */ Spicetify.React.createElement(
        "input",
        {
          type: "range",
          min: "0",
          max: "30",
          value: feather,
          onChange: (e) => setFeather(Number(e.target.value))
        }
      ), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "cpe__slider-val" }, feather, "px")), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "cpe__slider" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Edge"), /* @__PURE__ */ Spicetify.React.createElement(
        "input",
        {
          type: "range",
          min: "-20",
          max: "20",
          value: grow,
          onChange: (e) => setGrow(Number(e.target.value))
        }
      ), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "cpe__slider-val" }, grow > 0 ? `+${grow}` : grow, "px"))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "cpe__actions" }, selecting ? /* @__PURE__ */ Spicetify.React.createElement("button", { className: "cpe__btn", onClick: resetToChoose }, "Cancel") : refining ? /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "cpe__btn", onClick: startSelect }, "Redraw"), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "cpe__btn cpe__btn--use",
          onClick: () => onConfirm(processedUrl),
          disabled: !processedUrl
        },
        "Use this"
      )) : /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "cpe__btn cpe__btn--magic", onClick: startSelect }, "\u2702\uFE0F Lasso select"), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "cpe__btn", onClick: useOriginal }, "Use as-is"))), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "cpe__hint" }, refining ? "Soften the edge with Feather, tighten/expand with Edge." : "Lasso a region to keep, then refine the edge \u2014 or use the image as-is."))),
      document.body
    );
  }

  // src/components/ImageUploader.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-ImageUploader.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-ImageUploader.css";
    el.textContent = ".uploader {\n  position: absolute;\n  top: 4rem;\n  right: 1.25rem;\n  z-index: 50;\n  width: 520px;\n  max-width: calc(100vw - 2.5rem);\n  padding: 1.25rem;\n  border-radius: 16px;\n  background: rgba(18, 18, 26, 0.85);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  backdrop-filter: blur(16px);\n  color: #fff;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\n}\n\n.uploader__header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 1rem;\n}\n\n.uploader__header h2 {\n  margin: 0;\n  font-size: 1.1rem;\n}\n\n.uploader__close {\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.7);\n  font-size: 1.5rem;\n  line-height: 1;\n}\n\n.uploader__tabs {\n  display: flex;\n  gap: 0.25rem;\n  margin-bottom: 0.5rem;\n  background: rgba(255, 255, 255, 0.06);\n  border-radius: 10px;\n  padding: 0.25rem;\n}\n\n.uploader__tab {\n  flex: 1;\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.6);\n  border-radius: 8px;\n  padding: 0.45rem 0.5rem;\n  font-size: 0.8rem;\n  font-weight: 600;\n  transition: background 0.15s ease, color 0.15s ease;\n}\n\n.uploader__tab.is-active {\n  background: rgba(255, 255, 255, 0.14);\n  color: #fff;\n}\n\n.uploader__slot {\n  display: flex;\n  gap: 0.85rem;\n  align-items: center;\n  padding: 0.75rem 0;\n}\n\n.uploader__slot + .uploader__slot {\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n}\n\n.uploader__preview {\n  width: 64px;\n  height: 64px;\n  flex: none;\n  border-radius: 10px;\n  overflow: hidden;\n  display: grid;\n  place-items: center;\n  background: rgba(255, 255, 255, 0.06);\n  border: 1px dashed rgba(255, 255, 255, 0.15);\n}\n\n.uploader__preview img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n}\n\n.uploader__preview[data-empty='true'] span {\n  font-size: 0.58rem;\n  line-height: 1.2;\n  color: rgba(255, 255, 255, 0.4);\n  text-align: center;\n  padding: 0 4px;\n}\n\n.uploader__slot-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.uploader__slot-label {\n  font-weight: 600;\n  margin-bottom: 0.5rem;\n}\n\n.uploader__actions {\n  display: flex;\n  gap: 0.5rem;\n}\n\n.uploader__btn {\n  border: 1px solid rgba(255, 255, 255, 0.25);\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n  border-radius: 8px;\n  padding: 0.35rem 0.75rem;\n  font-size: 0.8rem;\n}\n\n.uploader__btn--ghost {\n  background: transparent;\n  color: rgba(255, 255, 255, 0.6);\n}\n\n.uploader__hint {\n  margin: 0.75rem 0 0;\n  font-size: 0.75rem;\n  color: rgba(255, 255, 255, 0.45);\n  line-height: 1.4;\n}\n\n.uploader__sliders {\n  margin-top: 1rem;\n  padding-top: 0.85rem;\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n  /* Two columns so tall tabs fit on-screen without scrolling. */\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 0.7rem 1.25rem;\n  align-content: start;\n}\n\n/* Color / dropdown / checkbox rows span the full width. */\n.uploader__sliders .uploader__color-row,\n.uploader__sliders .uploader__check-row {\n  grid-column: 1 / -1;\n}\n\n@media (max-width: 480px) {\n  .uploader__sliders {\n    grid-template-columns: 1fr;\n  }\n}\n\n.uploader__slider {\n  display: grid;\n  grid-template-columns: 1fr 3.2rem;\n  align-items: center;\n  gap: 0.4rem 0.6rem;\n  font-size: 0.8rem;\n  color: rgba(255, 255, 255, 0.85);\n}\n\n.uploader__slider-label {\n  grid-column: 1 / -1;\n}\n\n.uploader__slider input[type='range'] {\n  width: 100%;\n  accent-color: #b14dff;\n}\n\n.uploader__slider-val {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  color: rgba(255, 255, 255, 0.55);\n}\n\n.uploader__color-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 0.8rem;\n  color: rgba(255, 255, 255, 0.85);\n}\n\n.uploader__color-row input[type='color'] {\n  width: 2.4rem;\n  height: 1.6rem;\n  padding: 0;\n  border: 1px solid rgba(255, 255, 255, 0.25);\n  border-radius: 6px;\n  background: transparent;\n}\n\n.uploader__select {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n  border: 1px solid rgba(255, 255, 255, 0.25);\n  border-radius: 6px;\n  padding: 0.3rem 0.5rem;\n  font-size: 0.8rem;\n  max-width: 9rem;\n}\n\n.uploader__select option {\n  color: #000;\n}\n\n.uploader__check-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 0.8rem;\n  color: rgba(255, 255, 255, 0.85);\n}\n\n.uploader__check-row input[type='checkbox'] {\n  width: 1.1rem;\n  height: 1.1rem;\n  accent-color: #b14dff;\n}\n\n.uploader__reset {\n  margin-top: 0.5rem;\n  align-self: flex-start;\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  background: transparent;\n  color: rgba(255, 255, 255, 0.7);\n  border-radius: 8px;\n  padding: 0.4rem 0.8rem;\n  font-size: 0.78rem;\n}\n\n.uploader__reset:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.uploader__error {\n  margin: 0.5rem 0 0;\n  font-size: 0.75rem;\n  color: #ff8f8f;\n}\n";
    document.head.appendChild(el);
  })();

  // src/components/ImageUploader.jsx
  var pct = (v) => `${Math.round(v * 100)}%`;
  var mult = (v) => `${v.toFixed(2)}\xD7`;
  var px = (v) => `${Math.round(v)}px`;
  var TABS = ["Centerpiece", "Waves", "Background", "Effects"];
  var WAVE_STYLES = [
    { value: "rings", label: "Rings" },
    { value: "bars", label: "Bars (spectrum)" },
    { value: "both", label: "Both" }
  ];
  var RING_SLIDERS = [
    { key: "ringSize", label: "Ring size", min: 0.4, max: 2.5, step: 0.05, fmt: mult }
  ];
  var BAR_SLIDERS = [
    { key: "barHeight", label: "Bar height", min: 0.2, max: 3, step: 0.05, fmt: mult },
    { key: "barSpread", label: "Bar spread", min: 0.3, max: 1, step: 0.02, fmt: pct },
    { key: "barWidth", label: "Bar thickness", min: 0.15, max: 1.5, step: 0.02, fmt: pct },
    { key: "barGap", label: "Bar spacing", min: 0, max: 1.5, step: 0.02, fmt: pct }
  ];
  var WAVE_COLOR_MODES = [
    { value: "classic", label: "Rainbow (classic)" },
    { value: "album", label: "From album cover" },
    { value: "centerpiece", label: "From centerpiece" },
    { value: "auto", label: "Adapt to song" },
    { value: "solid", label: "Single color" }
  ];
  var LABEL_FONTS = ["Montserrat", "Poppins", "Nunito", "Inter", "Playfair Display", "Pacifico", "Bebas Neue"];
  var PARTICLE_TYPES = [
    { value: "none", label: "Off" },
    { value: "dust", label: "Dust / bokeh" },
    { value: "snow", label: "Snow" },
    { value: "petals", label: "Sakura petals" },
    { value: "stars", label: "Stars" },
    { value: "fireflies", label: "Fireflies" },
    { value: "notes", label: "Music notes" },
    { value: "embers", label: "Embers" }
  ];
  var SLIDERS = {
    Centerpiece: [
      { key: "centerpiece", label: "Centerpiece size", min: 15, max: 120, step: 1, fmt: Math.round },
      { key: "centerpieceY", label: "Centerpiece Vertical Offset", min: -45, max: 45, step: 1, fmt: Math.round },
      { key: "centerpieceOpacity", label: "Centerpiece opacity", min: 0, max: 1, step: 0.05, fmt: pct }
    ],
    Waves: [
      { key: "waveSaturation", label: "Color saturation", min: 0, max: 1, step: 0.05, fmt: pct },
      { key: "waveOpacity", label: "Wave opacity", min: 0, max: 1.6, step: 0.05, fmt: mult },
      { key: "waveGlow", label: "Wave glow", min: 0, max: 3, step: 0.05, fmt: mult }
    ],
    Background: [
      { key: "bgOpacity", label: "Background opacity", min: 0, max: 1, step: 0.05, fmt: pct },
      { key: "bgBlur", label: "Background blur", min: 0, max: 40, step: 1, fmt: px },
      { key: "tintStrength", label: "Tint strength", min: 0, max: 1, step: 0.05, fmt: pct },
      { key: "labelSize", label: "Now Playing text size", min: 0.6, max: 2, step: 0.05, fmt: mult }
    ],
    Effects: [
      { key: "particleDensity", label: "Density", min: 0.2, max: 2, step: 0.05, fmt: mult },
      { key: "particleSpeed", label: "Speed", min: 0.2, max: 2.5, step: 0.05, fmt: mult },
      { key: "particleSize", label: "Size", min: 0.4, max: 2.5, step: 0.05, fmt: mult },
      { key: "particleOpacity", label: "Opacity", min: 0, max: 1.5, step: 0.05, fmt: mult }
    ]
  };
  function ImageUploader({
    images,
    setImage,
    clearImage,
    settings,
    setSetting,
    resetSettings,
    onClose
  }) {
    const [error, setError] = useState(null);
    const [editingFile, setEditingFile] = useState(null);
    const [tab, setTab] = useState("Centerpiece");
    async function applyImage(kind, dataUrl) {
      setImage(kind, dataUrl);
      const ok = await persistImages({ ...images, [kind]: dataUrl });
      setError(ok ? null : "Image too large to save \u2014 it will reset on reload. Try a smaller file.");
    }
    async function handleBackground(file) {
      setError(null);
      try {
        applyImage("background", await fileToDataUrl(file, { maxDim: 1920, mime: "image/jpeg", quality: 0.85 }));
      } catch {
        setError("Could not read that image.");
      }
    }
    const renderSlider = (s) => /* @__PURE__ */ Spicetify.React.createElement("label", { key: s.key, className: "uploader__slider" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, s.label), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "range",
        min: s.min,
        max: s.max,
        step: s.step,
        value: settings[s.key],
        onChange: (e) => setSetting(s.key, Number(e.target.value))
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-val" }, s.fmt(settings[s.key])));
    const sliders = SLIDERS[tab].map(renderSlider);
    const showRings = settings.waveStyle === "rings" || settings.waveStyle === "both";
    const showBars = settings.waveStyle === "bars" || settings.waveStyle === "both";
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__header" }, /* @__PURE__ */ Spicetify.React.createElement("h2", null, "Customize"), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "uploader__close", onClick: onClose, "aria-label": "Close" }, "\xD7")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__tabs", role: "tablist" }, TABS.map((t) => /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        key: t,
        role: "tab",
        "aria-selected": tab === t,
        className: `uploader__tab ${tab === t ? "is-active" : ""}`,
        onClick: () => setTab(t)
      },
      t
    ))), tab === "Centerpiece" && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
      Slot,
      {
        label: "Centerpiece",
        current: images.centerpiece,
        onFile: (file) => setEditingFile(file),
        onClear: () => clearImage("centerpiece")
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "uploader__hint" }, "The centerpiece floats on top \u2014 use the magic eraser to drop its background."), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__sliders" }, sliders)), tab === "Waves" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__sliders" }, /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Wave style"), /* @__PURE__ */ Spicetify.React.createElement(
      "select",
      {
        className: "uploader__select",
        value: settings.waveStyle,
        onChange: (e) => setSetting("waveStyle", e.target.value)
      },
      WAVE_STYLES.map((s) => /* @__PURE__ */ Spicetify.React.createElement("option", { key: s.value, value: s.value }, s.label))
    )), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Wave color"), /* @__PURE__ */ Spicetify.React.createElement(
      "select",
      {
        className: "uploader__select",
        value: settings.waveColorMode,
        onChange: (e) => setSetting("waveColorMode", e.target.value)
      },
      WAVE_COLOR_MODES.map((m) => /* @__PURE__ */ Spicetify.React.createElement("option", { key: m.value, value: m.value }, m.label))
    )), settings.waveColorMode === "solid" && /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Color"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "color",
        value: settings.waveColor,
        onChange: (e) => setSetting("waveColor", e.target.value)
      }
    )), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__check-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "React to song audio"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "checkbox",
        checked: settings.audioReactive,
        onChange: (e) => setSetting("audioReactive", e.target.checked)
      }
    )), sliders, showRings && RING_SLIDERS.map(renderSlider), showBars && BAR_SLIDERS.map(renderSlider)), tab === "Background" && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
      Slot,
      {
        label: "Background",
        current: images.background,
        onFile: handleBackground,
        onClear: () => clearImage("background")
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__sliders" }, sliders, /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Tint color"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "color",
        value: settings.tintColor,
        onChange: (e) => setSetting("tintColor", e.target.value)
      }
    )), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Now Playing font"), /* @__PURE__ */ Spicetify.React.createElement(
      "select",
      {
        className: "uploader__select",
        value: settings.labelFont,
        onChange: (e) => setSetting("labelFont", e.target.value)
      },
      LABEL_FONTS.map((f) => /* @__PURE__ */ Spicetify.React.createElement("option", { key: f, value: f, style: { fontFamily: f } }, f))
    )), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Now Playing text color"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "color",
        value: settings.labelColor,
        onChange: (e) => setSetting("labelColor", e.target.value)
      }
    )))), tab === "Effects" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__sliders" }, /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Effect"), /* @__PURE__ */ Spicetify.React.createElement(
      "select",
      {
        className: "uploader__select",
        value: settings.particleType,
        onChange: (e) => setSetting("particleType", e.target.value)
      },
      PARTICLE_TYPES.map((t) => /* @__PURE__ */ Spicetify.React.createElement("option", { key: t.value, value: t.value }, t.label))
    )), settings.particleType !== "none" && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, sliders, /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__color-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "Particle color"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "color",
        value: settings.particleColor,
        onChange: (e) => setSetting("particleColor", e.target.value)
      }
    )), /* @__PURE__ */ Spicetify.React.createElement("label", { className: "uploader__check-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "uploader__slider-label" }, "React to beat"), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        type: "checkbox",
        checked: settings.particleBeat,
        onChange: (e) => setSetting("particleBeat", e.target.checked)
      }
    )))), error && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "uploader__error" }, error), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "uploader__reset", onClick: resetSettings }, "Reset to defaults"), editingFile && /* @__PURE__ */ Spicetify.React.createElement(
      CenterpieceEditor,
      {
        file: editingFile,
        onConfirm: (dataUrl) => {
          applyImage("centerpiece", dataUrl);
          setEditingFile(null);
        },
        onCancel: () => setEditingFile(null)
      }
    ));
  }
  function Slot({ label, current, onFile, onClear }) {
    const inputRef = useRef(null);
    function onPick(e) {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) onFile(file);
    }
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__slot" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__preview", "data-empty": current ? "false" : "true" }, current ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: current, alt: `${label} preview` }) : /* @__PURE__ */ Spicetify.React.createElement("span", null, "No ", label.toLowerCase())), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__slot-main" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__slot-label" }, label), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "uploader__actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "uploader__btn", onClick: () => inputRef.current?.click() }, current ? "Replace" : "Upload"), current && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "uploader__btn uploader__btn--ghost", onClick: onClear }, "Remove")), /* @__PURE__ */ Spicetify.React.createElement("input", { ref: inputRef, type: "file", accept: "image/*", hidden: true, onChange: onPick })));
  }

  // src/components/PresetsPanel.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-PresetsPanel.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-PresetsPanel.css";
    el.textContent = ".presets {\n  position: absolute;\n  top: 4rem;\n  right: 1.25rem;\n  z-index: 55;\n  width: 300px;\n  max-width: calc(100vw - 2.5rem);\n  max-height: 70vh;\n  overflow-y: auto;\n  padding: 1rem 1.1rem 1.1rem;\n  border-radius: 16px;\n  background: rgba(18, 18, 26, 0.9);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  backdrop-filter: blur(16px);\n  color: #fff;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\n}\n\n/* Embedded mode: clear Spotify's top bar (matches the uploader offset). */\n.bm-root--embed .presets {\n  top: 7rem;\n}\n\n.presets__header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 0.75rem;\n}\n\n.presets__header h2 {\n  margin: 0;\n  font-size: 1.05rem;\n}\n\n.presets__close {\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.7);\n  font-size: 1.4rem;\n  line-height: 1;\n  cursor: pointer;\n}\n\n.presets__save {\n  display: flex;\n  gap: 0.4rem;\n}\n\n.presets__input {\n  flex: 1;\n  min-width: 0;\n  padding: 0.45rem 0.6rem;\n  border-radius: 8px;\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  background: rgba(255, 255, 255, 0.06);\n  color: #fff;\n  font-size: 0.85rem;\n}\n\n.presets__input::placeholder {\n  color: rgba(255, 255, 255, 0.45);\n}\n\n.presets__btn {\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  background: rgba(255, 255, 255, 0.1);\n  color: #fff;\n  border-radius: 8px;\n  padding: 0.45rem 0.7rem;\n  font-size: 0.8rem;\n  cursor: pointer;\n  white-space: nowrap;\n  transition: background 0.15s ease;\n}\n\n.presets__btn:hover {\n  background: rgba(255, 255, 255, 0.18);\n}\n\n.presets__error {\n  color: #ff8a8a;\n  font-size: 0.78rem;\n  margin: 0.5rem 0 0;\n}\n\n.presets__empty {\n  color: rgba(255, 255, 255, 0.6);\n  font-size: 0.82rem;\n  margin: 0.75rem 0 0;\n}\n\n.presets__list {\n  list-style: none;\n  margin: 0.75rem 0 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 0.35rem;\n}\n\n.presets__item {\n  display: flex;\n  align-items: center;\n  gap: 0.4rem;\n}\n\n.presets__name {\n  flex: 1;\n  text-align: left;\n  border: none;\n  background: rgba(255, 255, 255, 0.06);\n  color: #fff;\n  padding: 0.5rem 0.7rem;\n  border-radius: 8px;\n  font-size: 0.85rem;\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  transition: background 0.15s ease;\n}\n\n.presets__name:hover {\n  background: rgba(255, 255, 255, 0.14);\n}\n\n.presets__del {\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.55);\n  font-size: 1.1rem;\n  line-height: 1;\n  cursor: pointer;\n  padding: 0 0.35rem;\n}\n\n.presets__del:hover {\n  color: #ff8a8a;\n}\n\n/* Storage usage bar (origin quota \u2014 IndexedDB-backed). */\n.presets__storage {\n  margin-top: 1rem;\n  padding-top: 0.85rem;\n  border-top: 1px solid rgba(255, 255, 255, 0.1);\n}\n\n.presets__storage-row {\n  display: flex;\n  justify-content: space-between;\n  font-size: 0.74rem;\n  color: rgba(255, 255, 255, 0.65);\n  margin-bottom: 0.4rem;\n}\n\n.presets__storage-bar {\n  height: 6px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.14);\n  overflow: hidden;\n}\n\n.presets__storage-fill {\n  height: 100%;\n  border-radius: 999px;\n  transition: width 0.3s ease, background 0.3s ease;\n}\n";
    document.head.appendChild(el);
  })();

  // src/components/PresetsPanel.jsx
  function fmtMB(bytes2) {
    const mb = bytes2 / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  function PresetsPanel({
    presets,
    settings,
    images,
    savePreset,
    deletePreset,
    applySettings,
    applyImages,
    onClose
  }) {
    const [name, setName] = useState("");
    const [error, setError] = useState(null);
    const [used, setUsed] = useState(null);
    const refreshUsage = useCallback(() => {
      getUsedBytes().then(setUsed);
    }, []);
    useEffect(() => {
      refreshUsage();
    }, [refreshUsage, presets]);
    const save = async () => {
      if (await savePreset(name, settings, images)) {
        setName("");
        setError(null);
      } else {
        setError("Storage full \u2014 delete a preset or use smaller images.");
      }
      refreshUsage();
    };
    const apply = (p) => {
      applySettings(p.settings);
      applyImages(p.images || {});
    };
    const pct2 = used != null ? Math.min(100, used / STORAGE_CAP * 100) : 0;
    const barColor = pct2 > 90 ? "#ff6b6b" : pct2 > 75 ? "#ffc861" : "#7ad7ff";
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets__header" }, /* @__PURE__ */ Spicetify.React.createElement("h2", null, "Presets"), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "presets__close", onClick: onClose, "aria-label": "Close" }, "\xD7")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets__save" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "presets__input",
        type: "text",
        placeholder: "Preset name",
        value: name,
        maxLength: 40,
        onChange: (e) => setName(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") save();
        }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "presets__btn", onClick: save }, "Save current")), error && /* @__PURE__ */ Spicetify.React.createElement("p", { className: "presets__error" }, error), presets.length === 0 ? /* @__PURE__ */ Spicetify.React.createElement("p", { className: "presets__empty" }, "No presets yet \u2014 name one and hit Save.") : /* @__PURE__ */ Spicetify.React.createElement("ul", { className: "presets__list" }, presets.map((p) => /* @__PURE__ */ Spicetify.React.createElement("li", { key: p.id, className: "presets__item" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "presets__name", onClick: () => apply(p), title: "Apply this preset" }, p.name), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "presets__del",
        onClick: () => deletePreset(p.id),
        "aria-label": `Delete ${p.name}`,
        title: "Delete"
      },
      "\xD7"
    )))), used != null && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets__storage" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets__storage-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Storage"), /* @__PURE__ */ Spicetify.React.createElement("span", null, fmtMB(used), " of ", fmtMB(STORAGE_CAP), " used")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "presets__storage-bar" }, /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "presets__storage-fill",
        style: { width: `${pct2}%`, background: barColor }
      }
    ))));
  }

  // src/hooks/usePlayerControls.js
  var P = () => window.Spicetify?.Player;
  function snapshot() {
    const p = P();
    if (!p) return { shuffle: false, smartShuffle: false, repeat: 0, volume: 1, muted: false };
    const d = p.data || {};
    return {
      shuffle: typeof p.getShuffle === "function" ? !!p.getShuffle() : !!d.shuffle,
      smartShuffle: !!d.smartShuffle,
      repeat: typeof p.getRepeat === "function" ? p.getRepeat() : d.repeat || 0,
      volume: typeof p.getVolume === "function" ? p.getVolume() : 1,
      muted: typeof p.getMute === "function" ? !!p.getMute() : false
    };
  }
  function usePlayerControls() {
    const [s, setS] = useState(snapshot);
    useEffect(() => {
      const p = P();
      if (!p) return;
      const sync = () => setS(snapshot());
      const events = ["songchange", "onplaypause"];
      events.forEach((e) => p.addEventListener?.(e, sync));
      const id = setInterval(sync, 1e3);
      sync();
      return () => {
        events.forEach((e) => p.removeEventListener?.(e, sync));
        clearInterval(id);
      };
    }, []);
    const refresh = () => setTimeout(() => setS(snapshot()), 60);
    return {
      ...s,
      toggleShuffle: () => {
        P()?.setShuffle?.(!snapshot().shuffle);
        refresh();
      },
      cycleRepeat: () => {
        P()?.setRepeat?.((snapshot().repeat + 1) % 3);
        refresh();
      },
      setVolume: (v) => {
        P()?.setVolume?.(v);
        setS((prev) => ({ ...prev, volume: v }));
      },
      toggleMute: () => {
        P()?.toggleMute?.();
        refresh();
      }
    };
  }

  // src/components/PlaybackBar.jsx
  var P2 = () => window.Spicetify?.Player;
  function Icon({ name }) {
    const path = window.Spicetify?.SVGIcons?.[name] || "";
    return /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: path } });
  }
  function fmt(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1e3));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function PlaybackBar({ nowPlaying }) {
    const isPlaying = nowPlaying.isPlaying;
    const duration = nowPlaying.track?.durationMs || 0;
    const ctl = usePlayerControls();
    const [pos, setPos] = useState(0);
    const [scrub, setScrub] = useState(null);
    const draggingRef = useRef(false);
    useEffect(() => {
      const tick = () => {
        if (draggingRef.current) return;
        const base = nowPlaying.progressMs || 0;
        const extra = nowPlaying.isPlaying ? Date.now() - (nowPlaying.fetchedAt || Date.now()) : 0;
        setPos(duration ? Math.min(base + extra, duration) : base + extra);
      };
      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }, [nowPlaying.progressMs, nowPlaying.fetchedAt, nowPlaying.isPlaying, duration]);
    const shown = scrub != null ? scrub : pos;
    const seekPct = duration ? shown / duration * 100 : 0;
    const volPct = (ctl.muted ? 0 : ctl.volume) * 100;
    const fill = (pct2) => ({
      background: `linear-gradient(to right, #fff ${pct2}%, rgba(255,255,255,0.25) ${pct2}%)`
    });
    const shuffleActive = ctl.shuffle || ctl.smartShuffle;
    const repeatTitle = ["Repeat off", "Repeat all", "Repeat one"][ctl.repeat] || "Repeat";
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "playbar" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "playbar__seekrow" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "playbar__time" }, fmt(shown)), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "playbar__seek",
        type: "range",
        min: 0,
        max: duration || 1,
        step: 1e3,
        value: Math.min(shown, duration || 1),
        style: fill(seekPct),
        onPointerDown: () => {
          draggingRef.current = true;
        },
        onChange: (e) => setScrub(Number(e.target.value)),
        onPointerUp: (e) => {
          const v = Number(e.currentTarget.value);
          P2()?.seek?.(v);
          setPos(v);
          setScrub(null);
          draggingRef.current = false;
        }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "playbar__time" }, fmt(duration))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "playbar__controls" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "playbar__center" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `playbar__btn ${shuffleActive ? "is-active" : ""}`,
        onClick: ctl.toggleShuffle,
        "aria-label": "Shuffle",
        title: ctl.smartShuffle ? "Smart Shuffle (on)" : "Shuffle"
      },
      /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: ctl.smartShuffle ? "smartShuffle" : "shuffle" })
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "playbar__btn", onClick: () => P2()?.back?.(), "aria-label": "Previous" }, /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: "skipBack" })), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "playbar__btn playbar__btn--main",
        onClick: () => P2()?.togglePlay?.(),
        "aria-label": isPlaying ? "Pause" : "Play"
      },
      /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: isPlaying ? "pause" : "play" })
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "playbar__btn", onClick: () => P2()?.next?.(), "aria-label": "Next" }, /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: "skipForward" })), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `playbar__btn ${ctl.repeat > 0 ? "is-active" : ""}`,
        onClick: ctl.cycleRepeat,
        "aria-label": "Repeat",
        title: repeatTitle
      },
      /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: "repeat" }),
      ctl.repeat === 2 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "playbar__badge" }, "1")
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "playbar__vol" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `playbar__btn playbar__btn--sm ${ctl.muted ? "" : ""}`,
        onClick: ctl.toggleMute,
        "aria-label": ctl.muted ? "Unmute" : "Mute",
        title: ctl.muted ? "Unmute" : "Mute",
        style: { opacity: ctl.muted ? 0.5 : 1 }
      },
      /* @__PURE__ */ Spicetify.React.createElement(Icon, { name: "volume" })
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "playbar__volslider",
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        value: ctl.muted ? 0 : ctl.volume,
        style: fill(volPct),
        onChange: (e) => ctl.setVolume(Number(e.target.value))
      }
    ))));
  }

  // src/styles/app.css
  (() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("bm-css-app.css")) return;
    const el = document.createElement("style");
    el.id = "bm-css-app.css";
    el.textContent = `/* Label color tokens used by NowPlayingLabel. */
:root {
  --label-fg: rgba(255, 255, 255, 0.95);
  --label-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}

/* The visualizer root. Two modes:
   - --embed: fills Spotify's main view; sidebar / top bar / now-playing bar stay usable.
   - --fs:    portaled to <body>, covers the whole client above all chrome (full-screen).
   Both rely on the main-view container (embed) / viewport (fs) being a positioned context. */
.bm-root {
  overflow: hidden;
  background: #0a0a0f;
  color-scheme: dark;
  /* Spotify's top strip is a window drag region (-webkit-app-region: drag); elements inside
     it don't receive clicks. Mark our whole overlay no-drag so the top controls are always
     clickable (this is why "Exit fullscreen" was dead while "Customize", further right and
     outside the drag band, still worked). */
  -webkit-app-region: no-drag;
  /* Montserrat: free geometric stand-in for Spotify's proprietary Circular. */
  font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.bm-root--embed {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.bm-root--fs {
  position: fixed;
  inset: 0;
  z-index: 5000;
}

/* The scene fills the root (Visualizer.css sets \`.viz\` to position:fixed, which would cover
   the whole window even in embedded mode \u2014 pin it to the root instead). */
.bm-root .viz {
  position: absolute;
}

/* Scope the box-sizing reset to our subtree so we don't disturb Spotify's own UI. */
.bm-root,
.bm-root * {
  box-sizing: border-box;
}

.bm-root button {
  font-family: inherit;
  cursor: pointer;
}

/* Top-right controls (Customize + Fullscreen toggle), revealed while the mouse is active.
   Positioned within the root. In embedded mode they're nudged down to clear Spotify's
   top bar (which overlays the top of the main view and would swallow their clicks). */
.controls-zone {
  position: absolute;
  right: 1.25rem;
  z-index: 5050;
  pointer-events: none; /* don't block the scene; the buttons re-enable below */
}

.bm-root--fs .controls-zone {
  top: 1.25rem;
}

.bm-root--embed .controls-zone {
  top: 4.5rem;
}

/* Match the panel's offset to the controls in embedded mode so it opens below them. */
.bm-root--embed .uploader {
  top: 7rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.controls-zone.is-visible .controls {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.controls__btn {
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.controls__btn:hover {
  background: rgba(0, 0, 0, 0.55);
  border-color: rgba(255, 255, 255, 0.45);
}

/* Fullscreen transport bar, bottom-center. Mirrors the .controls slide+fade but from the
   bottom (translateY +12px -> 0) and reveals on the same mouse-active state. */
.playbar-zone {
  position: absolute;
  left: 50%;
  bottom: 1.75rem;
  transform: translateX(-50%);
  z-index: 5050;
  pointer-events: none;
}

.playbar {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: min(720px, 92vw);
  padding: 0.7rem 1rem 0.55rem;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.playbar-zone.is-visible .playbar {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Seek row: elapsed | draggable bar | total */
.playbar__seekrow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.playbar__time {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 3.4ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Range sliders (seek + volume) \u2014 fill is set inline via a left\u2192right gradient. */
.playbar__seek,
.playbar__volslider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  margin: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  cursor: pointer;
}

.playbar__seek {
  flex: 1;
}

.playbar__volslider {
  width: 92px;
}

.playbar__seek::-webkit-slider-thumb,
.playbar__volslider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
}

/* Controls row: centered transport cluster, volume pinned right. */
.playbar__controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.playbar__center {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.playbar__vol {
  grid-column: 3;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.playbar__btn {
  position: relative;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  transition: background 0.15s ease, color 0.15s ease;
}

.playbar__btn svg {
  width: 1.15rem;
  height: 1.15rem;
}

.playbar__btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.playbar__btn.is-active {
  color: #1ed760;
}

.playbar__btn--main {
  width: 3rem;
  height: 3rem;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.playbar__btn--main svg {
  width: 1.4rem;
  height: 1.4rem;
}

.playbar__btn--main:hover {
  background: rgba(255, 255, 255, 0.28);
}

.playbar__btn--sm {
  width: 2.1rem;
  height: 2.1rem;
}

.playbar__badge {
  position: absolute;
  bottom: 0.3rem;
  right: 0.4rem;
  font-size: 0.55rem;
  font-weight: 700;
  color: #1ed760;
}
`;
    document.head.appendChild(el);
  })();

  // src/app.jsx
  var FONTS_HREF = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Nunito:wght@400;700;800&family=Inter:wght@400;600;700&family=Playfair+Display:wght@600;700&family=Pacifico&family=Bebas+Neue&display=swap";
  function ensureFonts() {
    if (document.getElementById("bm-fonts")) return;
    const link = document.createElement("link");
    link.id = "bm-fonts";
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }
  function App() {
    const nowPlaying = useSpicetifyNowPlaying();
    const { images, setImage, clearImage, applyImages } = useImages();
    const { settings, setSetting, resetSettings, applySettings } = useSettings();
    const { presets, savePreset, deletePreset } = usePresets();
    const [showUploader, setShowUploader] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [active, setActive] = useState(true);
    useEffect(() => {
      ensureFonts();
    }, []);
    useEffect(() => {
      let timer;
      const wake = () => {
        setActive((a) => a ? a : true);
        clearTimeout(timer);
        timer = setTimeout(() => setActive(false), 1e3);
      };
      wake();
      window.addEventListener("mousemove", wake);
      window.addEventListener("touchstart", wake);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("mousemove", wake);
        window.removeEventListener("touchstart", wake);
      };
    }, []);
    useEffect(() => {
      if (!fullscreen) return;
      const onKey = (e) => {
        if (e.key === "Escape") setFullscreen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [fullscreen]);
    const controlsVisible = active || showUploader || showPresets;
    const root = /* @__PURE__ */ Spicetify.React.createElement("div", { className: `bm-root ${fullscreen ? "bm-root--fs" : "bm-root--embed"}` }, /* @__PURE__ */ Spicetify.React.createElement(
      Visualizer,
      {
        nowPlaying,
        backgroundUrl: images.background,
        centerpieceUrl: images.centerpiece,
        settings
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: `controls-zone ${controlsVisible ? "is-visible" : ""}` }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "controls" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "controls__btn",
        onClick: () => setFullscreen((v) => !v),
        title: fullscreen ? "Exit fullscreen" : "Fullscreen"
      },
      fullscreen ? "Exit fullscreen" : "Fullscreen"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "controls__btn",
        onClick: () => {
          setShowPresets((v) => !v);
          setShowUploader(false);
        }
      },
      "Presets"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "controls__btn",
        onClick: () => {
          setShowUploader((v) => !v);
          setShowPresets(false);
        }
      },
      "Customize"
    ))), fullscreen && /* @__PURE__ */ Spicetify.React.createElement("div", { className: `playbar-zone ${controlsVisible ? "is-visible" : ""}` }, /* @__PURE__ */ Spicetify.React.createElement(PlaybackBar, { nowPlaying })), showPresets && /* @__PURE__ */ Spicetify.React.createElement(
      PresetsPanel,
      {
        presets,
        settings,
        images,
        savePreset,
        deletePreset,
        applySettings,
        applyImages,
        onClose: () => setShowPresets(false)
      }
    ), showUploader && /* @__PURE__ */ Spicetify.React.createElement(
      ImageUploader,
      {
        images,
        setImage,
        clearImage,
        settings,
        setSetting,
        resetSettings,
        onClose: () => setShowUploader(false)
      }
    ));
    return fullscreen ? createPortal(root, document.body) : root;
  }
  return __toCommonJS(app_exports);
})();
const render = () => backmusic.default();
