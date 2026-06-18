import { useEffect, useRef, useState } from 'react';
import { usePlayerControls } from '../hooks/usePlayerControls.js';

// Full transport bar for fullscreen mode (where our overlay covers Spotify's own bar):
// shuffle / prev / play-pause / next / repeat, a draggable seek bar with times, and a
// volume slider + mute. Drives the real player via Spicetify.Player; icons reuse Spotify's
// own SVG paths (Spicetify.SVGIcons) for a native look.
const P = () => window.Spicetify?.Player;

function Icon({ name }) {
  const path = window.Spicetify?.SVGIcons?.[name] || '';
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: path }} />
  );
}

function fmt(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlaybackBar({ nowPlaying }) {
  const isPlaying = nowPlaying.isPlaying;
  const duration = nowPlaying.track?.durationMs || 0;
  const ctl = usePlayerControls();

  const [pos, setPos] = useState(0);
  const [scrub, setScrub] = useState(null); // ms while dragging the seek bar
  const draggingRef = useRef(false);

  // Smoothly advance the displayed position between Spotify's progress events.
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
  const seekPct = duration ? (shown / duration) * 100 : 0;
  const volPct = (ctl.muted ? 0 : ctl.volume) * 100;
  const fill = (pct) => ({
    background: `linear-gradient(to right, #fff ${pct}%, rgba(255,255,255,0.25) ${pct}%)`,
  });

  const shuffleActive = ctl.shuffle || ctl.smartShuffle;
  const repeatTitle = ['Repeat off', 'Repeat all', 'Repeat one'][ctl.repeat] || 'Repeat';

  return (
    <div className="playbar">
      <div className="playbar__seekrow">
        <span className="playbar__time">{fmt(shown)}</span>
        <input
          className="playbar__seek"
          type="range"
          min={0}
          max={duration || 1}
          step={1000}
          value={Math.min(shown, duration || 1)}
          style={fill(seekPct)}
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={(e) => {
            const v = Number(e.currentTarget.value);
            P()?.seek?.(v);
            setPos(v);
            setScrub(null);
            draggingRef.current = false;
          }}
        />
        <span className="playbar__time">{fmt(duration)}</span>
      </div>

      <div className="playbar__controls">
        <div className="playbar__center">
          <button
            className={`playbar__btn ${shuffleActive ? 'is-active' : ''}`}
            onClick={ctl.toggleShuffle}
            aria-label="Shuffle"
            title={ctl.smartShuffle ? 'Smart Shuffle (on)' : 'Shuffle'}
          >
            <Icon name={ctl.smartShuffle ? 'smartShuffle' : 'shuffle'} />
          </button>
          <button className="playbar__btn" onClick={() => P()?.back?.()} aria-label="Previous">
            <Icon name="skipBack" />
          </button>
          <button
            className="playbar__btn playbar__btn--main"
            onClick={() => P()?.togglePlay?.()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} />
          </button>
          <button className="playbar__btn" onClick={() => P()?.next?.()} aria-label="Next">
            <Icon name="skipForward" />
          </button>
          <button
            className={`playbar__btn ${ctl.repeat > 0 ? 'is-active' : ''}`}
            onClick={ctl.cycleRepeat}
            aria-label="Repeat"
            title={repeatTitle}
          >
            <Icon name="repeat" />
            {ctl.repeat === 2 && <span className="playbar__badge">1</span>}
          </button>
        </div>

        <div className="playbar__vol">
          <button
            className={`playbar__btn playbar__btn--sm ${ctl.muted ? '' : ''}`}
            onClick={ctl.toggleMute}
            aria-label={ctl.muted ? 'Unmute' : 'Mute'}
            title={ctl.muted ? 'Unmute' : 'Mute'}
            style={{ opacity: ctl.muted ? 0.5 : 1 }}
          >
            <Icon name="volume" />
          </button>
          <input
            className="playbar__volslider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ctl.muted ? 0 : ctl.volume}
            style={fill(volPct)}
            onChange={(e) => ctl.setVolume(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
