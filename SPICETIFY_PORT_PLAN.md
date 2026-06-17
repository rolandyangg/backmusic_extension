# backmusic → Spicetify custom app: port plan

A standalone, executable plan for porting the **backmusic** visualizer into a
[Spicetify](https://spicetify.app) custom app so it runs *inside* the Spotify desktop client
(sidebar icon → full-screen view → X to close), reaches unlimited users, and drops the Spotify
developer-app OAuth flow entirely.

> **This file is self-contained.** Drop it into an empty repo and start at
> **"§0 Start here."** Everything an executor needs — the source location, what to copy, the
> build steps, and how to verify — is below. No prior conversation context required.

**Source repo to port from:** `https://github.com/rolandyangg/backmusic.git`
**Existing BPM proxy (reused):** `https://backmusic-one.vercel.app/api/tempo`

---

## §0 Start here (kickoff for an executor)

Run these in order; each links to a section below.

1. **Clone the source** next to this repo so you can copy components from it:
   ```bash
   git clone https://github.com/rolandyangg/backmusic.git /tmp/backmusic-src
   ```
2. **Confirm the BPM proxy works with CORS** (prerequisite — see §1). If it doesn't yet send CORS
   headers, use the self-hosted fallback in §1.
3. **Scaffold this repo** as a Spicetify custom app (§3, §4 step 2): `package.json`, `esbuild`
   config, root `manifest.json`.
4. **Copy the visual layer** from the clone (§2) into `src/`.
5. **Write the two new files** — `src/app.jsx` and `src/useSpicetifyNowPlaying.js` (§4 steps 3–4).
6. **Wire tempo + settings + CSS** (§4 steps 5–6); verify auto-erase (§4 step 7).
7. **Build, install locally, and verify** end-to-end (§6).
8. **Package for the Marketplace** (§4 step 8).

When done you should have: a `backmusic` icon in the Spotify sidebar → full-screen visualizer →
X to close, working on **any** Spotify account with **no developer app / no allowlist**.

---

## §1 Prerequisite: a public, CORS-enabled BPM proxy

The beat engine needs tempo (BPM) from ReccoBeats. ReccoBeats is proxied by the original repo's
`api/tempo.js`, already deployed at `https://backmusic-one.vercel.app/api/tempo?ids=<spotifyId>`.
For the Spicetify app (a different origin) to call it, the proxy must send CORS headers.

- **Preferred:** in the *source* repo (`rolandyangg/backmusic`), add
  `Access-Control-Allow-Origin: *` + an OPTIONS preflight handler to `api/tempo.js`, redeploy, then
  confirm:
  ```bash
  curl -i "https://backmusic-one.vercel.app/api/tempo?ids=11dFghVXANMlKmJXsNCbNl"
  # expect: 200 + access-control-allow-origin: * + JSON { bpm, energy, danceability }
  ```
- **Self-hosted fallback (keeps this repo independent):** deploy your own one-file proxy that GETs
  `https://api.reccobeats.com/v1/audio-features?ids=<id>`, returns `{ bpm, energy, danceability }`
  or `{ bpm: null }` on any failure, and sets `Access-Control-Allow-Origin: *`. Point the tempo
  client (§4 step 5) at it. (Don't call ReccoBeats directly from the client — CORS will block it.)

---

## §2 What to copy from the source clone vs. what to drop

**Copy the visual layer (the valuable part) — pure React + canvas, no auth/network.**
From `/tmp/backmusic-src` into this repo's `src/`:
- `src/components/Visualizer.jsx`, `SoundWaves.jsx`, `Particles.jsx`, `NowPlayingLabel.{jsx,css}`,
  `Visualizer.css`
- `src/hooks/useBeat.js`, `src/lib/tempoClient.js` (make its base URL configurable — §4 step 5)
- `src/hooks/useSettings.js`, `src/lib/imageStore.js` (localStorage; keep key names)
- `src/components/ImageUploader.{jsx,css}`, `CenterpieceEditor.{jsx,css}`
  (`@imgly/background-removal` must be bundled — large wasm, code-split; verify it loads in-client,
  else gate auto-erase as a follow-up — §4 step 7)

**Do NOT copy (Spotify is already logged in and is the player):**
- `api/auth/*`, `api/_lib/oauth.js`, `src/lib/auth.js`, `src/hooks/useAuth.js`,
  `src/components/LoginScreen.*` — no OAuth
- `src/lib/spotifyClient.js`, `src/hooks/useNowPlaying.js` — replaced by `Spicetify.Player` (§4 step 4)
- `src/hooks/usePlayback.js`, `src/components/PlaybackControls.*` — the desktop client is the player
- the auth gate in `src/App.jsx` (you write a fresh entry instead — §4 step 3)

---

## §3 Target repo structure

```
<this repo>/
  manifest.json                 # ROOT: name, icon (svg), active-icon (svg), subfiles → sidebar icon
  README.md                     # for Marketplace + ToS/install note
  preview.png                   # Marketplace card image
  package.json
  esbuild.config.mjs            # bundles to CustomApps/backmusic/
  src/
    app.jsx                     # custom-app entry: render() returns the root  (NEW)
    useSpicetifyNowPlaying.js   # adapter → backmusic's nowPlaying shape       (NEW)
    components/ ...             # copied visual components (§2)
    hooks/ ...                  # useBeat, useSettings (§2)
    lib/ ...                    # tempoClient (configurable base URL), imageStore (§2)
```

`spicetify-creator` is **deprecated** — use **esbuild** (or Rollup) per current Spicetify guidance.
A custom app needs a root `manifest.json` and a bundle exposing a `render()` entry.

---

## §4 Build steps (in order)

1. **BPM proxy ready** — confirm §1 (CORS or fallback) before wiring tempo.
2. **Scaffold** — `package.json` (esbuild + React deps), `esbuild.config.mjs` bundling
   `src/app.jsx` (+ CSS) into `CustomApps/backmusic/`, root `manifest.json`
   (name "backmusic", sidebar `icon`/`active-icon` SVGs), and a dev script that copies the output
   into the local Spicetify CustomApps dir and runs `spicetify apply`.
3. **Entry `src/app.jsx`** — render the copied `Visualizer` + `ImageUploader` panel + idle-reveal
   controls + an **X** close button (top-left). Feed it now-playing from the adapter (step 4) in
   place of the old `useNowPlaying`.
4. **Adapter `src/useSpicetifyNowPlaying.js`** — replace polling with `Spicetify.Player`:
   - Subscribe: `Spicetify.Player.addEventListener('songchange' | 'onprogress' | 'onplaypause', cb)`
   - Read: `Spicetify.Player.data?.item` → `name`, `artists[].name`, `metadata.image_xlarge_url`,
     `uri`; plus `getProgress()`, `getDuration()`, `isPlaying()`
   - Map to backmusic's existing shape so `Visualizer`/`useBeat` stay unchanged:
     `{ track: { name, artist, albumArtUrl, id }, isPlaying, progressMs, durationMs }`
   - Extract the Spotify id from `uri` (`spotify:track:<id>`) for the ReccoBeats lookup.
   - Be **defensive** — `Player.data` shape varies across Spicetify/Spotify versions.
5. **Tempo client** — make `tempoClient.js`'s base URL configurable and set it to the proxy from
   §1 (e.g. `https://backmusic-one.vercel.app/api/tempo`).
6. **Settings/CSS** — confirm `useSettings`/`imageStore` localStorage works in-client; ensure the
   root z-index sits above Spotify chrome; keep the `CenterpieceEditor` portal → `document.body`.
7. **Auto-erase check** — verify `@imgly/background-removal`'s wasm/model loads inside the Spotify
   webview. If yes, keep it; if not, ship "use as-is"/lasso only and treat auto-erase as a follow-up.
8. **Marketplace packaging** — `README.md` + `preview.png`; root `manifest.json`
   (name/description/preview/readme/authors/tags); tag the GitHub repo with topic
   **`spicetify-apps`** ([publishing requirements](https://github.com/spicetify/marketplace/wiki)).

---

## §5 Full-screen + X, and the token

- **Full-screen takeover + X:** the root renders a `position: fixed; inset: 0; z-index: <high>`
  overlay over the whole client, with an **X** button (top-left) that closes the app — e.g.
  `Spicetify.Platform.History.goBack()` or navigate away. Existing fullscreen Spicetify extensions
  confirm CSS-over-chrome works.
- **Token:** with `Spicetify.Player.data` you get all now-playing info without the Web API. Keep
  `Spicetify.Platform.Session.accessToken` available as a fallback for any direct Web API call.

---

## §6 Verification

- **Build:** `esbuild` bundle succeeds.
- **Local run:** install Spicetify → copy built app into CustomApps → `spicetify apply`; the
  **backmusic icon appears in the sidebar**; clicking opens a **full-screen** visualizer; **X**
  closes back to Spotify.
- **Now-playing:** play/pause/skip → label + album-art fallback update via `Spicetify.Player`
  events (no polling); progress drives the scene.
- **Beat sync:** a track with BPM → waves/particles lock to tempo (ReccoBeats via the proxy, CORS
  OK); tracks without BPM fall back to the decorative pulse.
- **Customize:** all tabs (Centerpiece/Waves/Background/Effects) work; settings + uploaded images
  persist across Spotify restarts; Reset works.
- **No allowlist:** works on a Spotify account **never added to any developer app** — proves the
  5-user limit is bypassed.
- **Distribution dry-run:** repo has `spicetify-apps` topic + root manifest; resolves in a local
  Marketplace install.

---

## §7 Why this approach (background)

backmusic currently authenticates through its own Spotify developer OAuth app, which is permanently
capped for an indie project:

- Spotify's **Feb 2026** changes cap Development Mode at **5 users**, require the app owner to keep
  **Premium**, and allow **1 Client ID per developer account**
  ([migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)).
- **Extended Quota** (the only way to lift the cap) has been **closed to individuals since May 15,
  2025** — applicants must be a registered org with ~250k MAU
  ([Spotify blog](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)).

A Spicetify custom app sidesteps all of it: it runs inside the desktop client and reads the
logged-in user's **own** session/token and live track state, so it needs **no developer app, no
quota, no allowlist**.

**Accepted tradeoffs:** desktop-only; **unofficial / against Spotify ToS** (state this in the
README); each user must install Spicetify; can break on Spotify updates until Spicetify catches up.

**Future second front:** a browser-extension port for the `open.spotify.com` web player could reuse
the same visualizer code (one-click install, web-player only).

---

## §8 Reference: relevant Spicetify APIs

- `Spicetify.Player` — `data`, `data.item` (`name`, `artists`, `metadata.image_xlarge_url`, `uri`),
  `getProgress()`, `getDuration()`, `isPlaying()`,
  `addEventListener('songchange'|'onprogress'|'onplaypause')`, `next()`, `back()`, `togglePlay()` —
  [docs](https://spicetify.app/docs/development/api-wrapper/methods/player)
- `Spicetify.Platform.Session.accessToken` — logged-in user's token
- `Spicetify.Platform.History` — in-client navigation (for the X / close)
- Custom app structure: root `manifest.json` + bundle with `render()` —
  [docs](https://spicetify.app/docs/development/custom-apps)
- Marketplace publishing: public repo + topic `spicetify-apps` + root manifest —
  [wiki](https://github.com/spicetify/marketplace/wiki)
