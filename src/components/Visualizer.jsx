import { useBeat } from '../hooks/useBeat.js';
import { useWavePalette } from '../hooks/useWavePalette.js';
import SoundWaves from './SoundWaves.jsx';
import Particles from './Particles.jsx';
import NowPlayingLabel from './NowPlayingLabel.jsx';
import './Visualizer.css';

// The layered scene:
//   background image  →  scrim  →  sound waves  →  centerpiece  →  now-playing label
//
// Until the user uploads their own images we fall back to the current track's album
// art (blurred for the background, floating for the centerpiece), so it never looks empty.
export default function Visualizer({ nowPlaying, backgroundUrl, centerpieceUrl, settings }) {
  const { getPulse } = useBeat(nowPlaying, { audioReactive: settings.audioReactive });
  const albumArt = nowPlaying.track?.albumArtUrl || null;

  const bg = backgroundUrl || albumArt;
  const center = centerpieceUrl || albumArt;

  // Palette for the image-based wave color modes: sample the album art or the centerpiece
  // (whichever the mode selects), falling back to the album for the other modes.
  const paletteSrc = settings.waveColorMode === 'centerpiece' ? center : albumArt;
  const paletteColors = useWavePalette(settings.waveColorMode, paletteSrc, nowPlaying.track?.uri);

  // Blur applies to a user-set background; the album-art fallback keeps its own
  // ambient blur (from CSS). Scale up a touch so blurred edges don't show gaps.
  const bgStyle = { opacity: settings.bgOpacity };
  if (bg) bgStyle.backgroundImage = `url(${bg})`;
  if (backgroundUrl && settings.bgBlur > 0) {
    bgStyle.filter = `blur(${settings.bgBlur}px)`;
    bgStyle.transform = 'scale(1.12)';
  }

  return (
    <div className="viz">
      <div className={`viz__bg ${backgroundUrl ? '' : 'viz__bg--art'}`} style={bgStyle} />
      <div className="viz__scrim" />
      <div
        className="viz__tint"
        style={{ background: settings.tintColor, opacity: settings.tintStrength }}
      />

      <SoundWaves
        getPulse={getPulse}
        style={settings.waveStyle}
        colorMode={settings.waveColorMode}
        color={settings.waveColor}
        saturation={settings.waveSaturation}
        paletteColors={paletteColors}
        sizeMul={settings.waveScale}
        opacityMul={settings.waveOpacity}
        glowMul={settings.waveGlow}
      />

      <Particles
        getPulse={getPulse}
        type={settings.particleType}
        density={settings.particleDensity}
        speed={settings.particleSpeed}
        size={settings.particleSize}
        opacity={settings.particleOpacity}
        color={settings.particleColor}
        beat={settings.particleBeat}
      />

      {center && (
        <div
          className="viz__center-wrap"
          style={{
            '--cp-size': `${settings.centerpiece}cqmin`,
            transform: `translateY(${settings.centerpieceY}cqh)`,
            opacity: settings.centerpieceOpacity,
          }}
        >
          <img
            className={`viz__center ${centerpieceUrl ? '' : 'viz__center--art'}`}
            src={center}
            alt=""
          />
        </div>
      )}

      <NowPlayingLabel
        track={nowPlaying.track}
        isPlaying={nowPlaying.isPlaying}
        font={settings.labelFont}
        size={settings.labelSize}
        color={settings.labelColor}
      />
    </div>
  );
}
