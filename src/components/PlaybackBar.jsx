// Transport controls for fullscreen mode (where our overlay covers Spotify's own bar).
// Drives the real player via Spicetify.Player; the play/pause icon reflects isPlaying.
// Rendered inside a `.playbar-zone` that reveals on mouse-move (see app.jsx / app.css).
const player = () => window.Spicetify?.Player;

const PrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 6h2v12H7zM20 6v12L9 12z" />
  </svg>
);
const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15 6h2v12h-2zM4 6v12l11-6z" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
  </svg>
);

export default function PlaybackBar({ isPlaying }) {
  return (
    <div className="playbar">
      <button
        className="playbar__btn"
        onClick={() => player()?.back?.()}
        aria-label="Previous track"
      >
        <PrevIcon />
      </button>
      <button
        className="playbar__btn playbar__btn--main"
        onClick={() => player()?.togglePlay?.()}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        className="playbar__btn"
        onClick={() => player()?.next?.()}
        aria-label="Next track"
      >
        <NextIcon />
      </button>
    </div>
  );
}
