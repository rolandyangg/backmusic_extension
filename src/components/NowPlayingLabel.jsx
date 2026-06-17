import './NowPlayingLabel.css';

// Bottom-corner song + artist label, with a tiny equalizer that animates while playing.
// Font family, size and color are user-customizable via settings.
export default function NowPlayingLabel({ track, isPlaying, font, size = 1, color }) {
  const style = {
    fontFamily: font ? `'${font}', sans-serif` : undefined,
    fontSize: `${size}rem`,
    color,
  };

  if (!track) {
    return (
      <div className="np np--empty" style={style}>
        Nothing playing — press play in Spotify
      </div>
    );
  }

  return (
    <div className="np" style={style}>
      <div className="np__eq" data-playing={isPlaying ? 'true' : 'false'} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="np__text">
        <div className="np__title" title={track.name}>
          {track.name}
        </div>
        <div className="np__artist" title={track.artist}>
          {track.artist}
        </div>
      </div>
    </div>
  );
}
