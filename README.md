# backmusic (Spicetify custom app)

A lofi-style **music visualizer** that runs *inside* the Spotify desktop client. A `backmusic`
icon appears in the sidebar; clicking it opens a full-screen scene driven by your currently
playing song — a customizable background, a floating background-removed centerpiece, and animated
sound waves + particles. Press **×** (top-left) to return to Spotify.

Ported from the [backmusic](https://github.com/rolandyangg/backmusic) web app. Because it reads
your **already-logged-in** Spotify session via Spicetify, it works on **any** Spotify account —
no developer app, no OAuth, no allowlist.

> ⚠️ **Unofficial.** This uses [Spicetify](https://spicetify.app), which modifies the Spotify
> desktop client and is **not endorsed by Spotify and may be against its Terms of Service**.
> Desktop-only. A Spotify update can break it until Spicetify catches up. Use at your own risk.

## Features

- Full-screen visualizer over the Spotify client; **×** to close.
- Live now-playing (title / artist / album art) via `Spicetify.Player` — no polling.
- Animated sound waves + particle layer with a decorative pulse.
- **Customize** panel: centerpiece, waves, background (image/blur/tint), effects, fonts.
- Upload your own background + centerpiece; lasso + refine the centerpiece edge.
- Settings and images persist locally across restarts.

> v1 note: beat-sync to BPM and automatic background removal are intentionally **not** included
> (see *Roadmap*). Waves/particles use a decorative breathing pulse; the centerpiece editor offers
> lasso + refine.

## Install (from source)

Requires [Spicetify](https://spicetify.app/docs/getting-started) and Node.js.

```bash
npm install
npm run install-local   # builds, copies into Spicetify's CustomApps, runs `spicetify apply`
```

Then open Spotify — the **backmusic** icon is in the left sidebar.

Manual alternative:

```bash
npm run build
# copy manifest.json + dist/index.js into <spicetify userdir>/CustomApps/backmusic/
spicetify config custom_apps backmusic
spicetify apply
```

Dev loop: `npm run watch` (rebuild on change), then re-run `spicetify apply`.

## How it works

- `src/app.jsx` — custom-app entry; default export is the route component.
- `src/useSpicetifyNowPlaying.js` — adapts `Spicetify.Player` into the visualizer's now-playing
  shape (replaces the web app's Web API polling + OAuth).
- `src/components`, `src/hooks`, `src/lib` — the visual layer copied from the web app (canvas
  waves/particles, centerpiece editor, settings, image store).
- React/ReactDOM are aliased to Spicetify's own (`src/shims`) so no second React is bundled.

## Roadmap

- **Beat-sync (BPM):** re-enable `src/lib/tempoClient.js` against a CORS-enabled ReccoBeats proxy.
- **Auto background removal:** re-add `@imgly/background-removal` once its WASM is verified in-client.
- Browser-extension port for the `open.spotify.com` web player.
```
