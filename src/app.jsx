import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSpicetifyNowPlaying } from './useSpicetifyNowPlaying.js';
import { useImages } from './hooks/useImages.js';
import { useSettings } from './hooks/useSettings.js';
import Visualizer from './components/Visualizer.jsx';
import ImageUploader from './components/ImageUploader.jsx';
import PlaybackBar from './components/PlaybackBar.jsx';
import './styles/app.css';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Nunito:wght@400;700;800&family=Inter:wght@400;600;700&family=Playfair+Display:wght@600;700&family=Pacifico&family=Bebas+Neue&display=swap';

// Load the label fonts once (the web app loaded these in index.html; inside the Spotify
// client we inject them so the now-playing label font options render correctly).
function ensureFonts() {
  if (document.getElementById('bm-fonts')) return;
  const link = document.createElement('link');
  link.id = 'bm-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

// Spicetify custom-app entry: the default export is the route component. It must NOT be
// named `render` — the build appends a top-level `const render = () => backmusic.default()`
// (see esbuild.config.mjs), and a second `render` identifier collides ("Identifier 'render'
// has already been declared").
export default function App() {
  const nowPlaying = useSpicetifyNowPlaying();
  const { images, setImage, clearImage } = useImages();
  const { settings, setSetting, resetSettings } = useSettings();
  const [showUploader, setShowUploader] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    ensureFonts();
  }, []);

  // Reveal controls on mouse movement; hide after a short period of inactivity.
  useEffect(() => {
    let timer;
    const wake = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 1000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);

  // ESC exits fullscreen (back to embedded).
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const controlsVisible = active || showUploader;

  const root = (
    <div className={`bm-root ${fullscreen ? 'bm-root--fs' : 'bm-root--embed'}`}>
      <Visualizer
        nowPlaying={nowPlaying}
        backgroundUrl={images.background}
        centerpieceUrl={images.centerpiece}
        settings={settings}
      />

      {/* Customize + Fullscreen toggle, grouped top-right. */}
      <div className={`controls-zone ${controlsVisible ? 'is-visible' : ''}`}>
        <div className="controls">
          <button
            className="controls__btn"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
          <button className="controls__btn" onClick={() => setShowUploader((v) => !v)}>
            Customize
          </button>
        </div>
      </div>

      {/* Transport bar — fullscreen only (embedded mode keeps Spotify's own bar). Reveals on
          the same mouse-move trigger as the top controls and slides up from the bottom. */}
      {fullscreen && (
        <div className={`playbar-zone ${controlsVisible ? 'is-visible' : ''}`}>
          <PlaybackBar isPlaying={nowPlaying.isPlaying} />
        </div>
      )}

      {showUploader && (
        <ImageUploader
          images={images}
          setImage={setImage}
          clearImage={clearImage}
          settings={settings}
          setSetting={setSetting}
          resetSettings={resetSettings}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );

  // Embedded: render inline as the route content so it fills only Spotify's main view
  // (sidebar / top bar / now-playing bar stay visible and usable — navigate away normally).
  // Fullscreen: portal to <body> so the overlay escapes the main-view container and covers
  // the whole client, above all chrome.
  return fullscreen ? createPortal(root, document.body) : root;
}
