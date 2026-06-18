import { useRef, useState } from 'react';
import { fileToDataUrl, persistImages } from '../lib/imageStore.js';
import CenterpieceEditor from './CenterpieceEditor.jsx';
import './ImageUploader.css';

const SETTINGS = {
  background: { maxDim: 1920, mime: 'image/jpeg', quality: 0.85, label: 'Background' },
  centerpiece: { maxDim: 1024, mime: 'image/png', label: 'Centerpiece' },
};

// Panel for customizing the scene, organized into Centerpiece / Waves / Background
// tabs. `fmt` renders the current value next to each slider.
const pct = (v) => `${Math.round(v * 100)}%`;
const mult = (v) => `${v.toFixed(2)}×`;
const px = (v) => `${Math.round(v)}px`;

const TABS = ['Centerpiece', 'Waves', 'Background', 'Effects'];

const WAVE_STYLES = [
  { value: 'rings', label: 'Rings' },
  { value: 'bars', label: 'Bars (spectrum)' },
  { value: 'both', label: 'Both' },
];

const WAVE_COLOR_MODES = [
  { value: 'auto', label: 'Adapt to song' },
  { value: 'solid', label: 'Single color' },
  { value: 'mono', label: 'Black & white' },
];

// Free Google Fonts loaded in index.html (Montserrat ≈ Spotify's Circular).
const LABEL_FONTS = ['Montserrat', 'Poppins', 'Nunito', 'Inter', 'Playfair Display', 'Pacifico', 'Bebas Neue'];

const PARTICLE_TYPES = [
  { value: 'none', label: 'Off' },
  { value: 'dust', label: 'Dust / bokeh' },
  { value: 'snow', label: 'Snow' },
  { value: 'petals', label: 'Sakura petals' },
  { value: 'stars', label: 'Stars' },
  { value: 'fireflies', label: 'Fireflies' },
  { value: 'notes', label: 'Music notes' },
  { value: 'embers', label: 'Embers' },
];

const SLIDERS = {
  Centerpiece: [
    { key: 'centerpiece', label: 'Centerpiece size', min: 15, max: 120, step: 1, fmt: Math.round },
    { key: 'centerpieceY', label: 'Centerpiece Vertical Offset', min: -45, max: 45, step: 1, fmt: Math.round },
    { key: 'centerpieceOpacity', label: 'Centerpiece opacity', min: 0, max: 1, step: 0.05, fmt: pct },
  ],
  Waves: [
    { key: 'waveScale', label: 'Wave size', min: 0.4, max: 2.5, step: 0.05, fmt: mult },
    { key: 'waveOpacity', label: 'Wave opacity', min: 0, max: 1.6, step: 0.05, fmt: mult },
    { key: 'waveGlow', label: 'Wave glow', min: 0, max: 3, step: 0.05, fmt: mult },
  ],
  Background: [
    { key: 'bgOpacity', label: 'Background opacity', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'bgBlur', label: 'Background blur', min: 0, max: 40, step: 1, fmt: px },
    { key: 'tintStrength', label: 'Tint strength', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'labelSize', label: 'Now Playing text size', min: 0.6, max: 2, step: 0.05, fmt: mult },
  ],
  Effects: [
    { key: 'particleDensity', label: 'Density', min: 0.2, max: 2, step: 0.05, fmt: mult },
    { key: 'particleSpeed', label: 'Speed', min: 0.2, max: 2.5, step: 0.05, fmt: mult },
    { key: 'particleSize', label: 'Size', min: 0.4, max: 2.5, step: 0.05, fmt: mult },
    { key: 'particleOpacity', label: 'Opacity', min: 0, max: 1.5, step: 0.05, fmt: mult },
  ],
};

export default function ImageUploader({
  images,
  setImage,
  clearImage,
  settings,
  setSetting,
  resetSettings,
  onClose,
}) {
  const [error, setError] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [tab, setTab] = useState('Centerpiece');

  function applyImage(kind, dataUrl) {
    setImage(kind, dataUrl);
    // setImage persists internally; re-check to surface a quota failure.
    setError(persistImages({ ...images, [kind]: dataUrl }) ? null : 'Image too large to save — it will reset on reload. Try a smaller file.');
  }

  async function handleBackground(file) {
    setError(null);
    try {
      applyImage('background', await fileToDataUrl(file, { maxDim: 1920, mime: 'image/jpeg', quality: 0.85 }));
    } catch {
      setError('Could not read that image.');
    }
  }

  const sliders = SLIDERS[tab].map((s) => (
    <label key={s.key} className="uploader__slider">
      <span className="uploader__slider-label">{s.label}</span>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={settings[s.key]}
        onChange={(e) => setSetting(s.key, Number(e.target.value))}
      />
      <span className="uploader__slider-val">{s.fmt(settings[s.key])}</span>
    </label>
  ));

  return (
    <div className="uploader">
      <div className="uploader__header">
        <h2>Customize</h2>
        <button className="uploader__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="uploader__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`uploader__tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Centerpiece' && (
        <>
          <Slot
            label="Centerpiece"
            current={images.centerpiece}
            onFile={(file) => setEditingFile(file)}
            onClear={() => clearImage('centerpiece')}
          />
          <p className="uploader__hint">
            The centerpiece floats on top — use the magic eraser to drop its background.
          </p>
          <div className="uploader__sliders">{sliders}</div>
        </>
      )}

      {tab === 'Waves' && (
        <div className="uploader__sliders">
          <label className="uploader__color-row">
            <span className="uploader__slider-label">Wave style</span>
            <select
              className="uploader__select"
              value={settings.waveStyle}
              onChange={(e) => setSetting('waveStyle', e.target.value)}
            >
              {WAVE_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="uploader__color-row">
            <span className="uploader__slider-label">Wave color</span>
            <select
              className="uploader__select"
              value={settings.waveColorMode}
              onChange={(e) => setSetting('waveColorMode', e.target.value)}
            >
              {WAVE_COLOR_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {settings.waveColorMode === 'solid' && (
            <label className="uploader__color-row">
              <span className="uploader__slider-label">Color</span>
              <input
                type="color"
                value={settings.waveColor}
                onChange={(e) => setSetting('waveColor', e.target.value)}
              />
            </label>
          )}
          <label className="uploader__check-row">
            <span className="uploader__slider-label">React to song audio</span>
            <input
              type="checkbox"
              checked={settings.audioReactive}
              onChange={(e) => setSetting('audioReactive', e.target.checked)}
            />
          </label>
          {sliders}
        </div>
      )}

      {tab === 'Background' && (
        <>
          <Slot
            label="Background"
            current={images.background}
            onFile={handleBackground}
            onClear={() => clearImage('background')}
          />
          <div className="uploader__sliders">
            {sliders}
            <label className="uploader__color-row">
              <span className="uploader__slider-label">Tint color</span>
              <input
                type="color"
                value={settings.tintColor}
                onChange={(e) => setSetting('tintColor', e.target.value)}
              />
            </label>
            <label className="uploader__color-row">
              <span className="uploader__slider-label">Now Playing font</span>
              <select
                className="uploader__select"
                value={settings.labelFont}
                onChange={(e) => setSetting('labelFont', e.target.value)}
              >
                {LABEL_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="uploader__color-row">
              <span className="uploader__slider-label">Now Playing text color</span>
              <input
                type="color"
                value={settings.labelColor}
                onChange={(e) => setSetting('labelColor', e.target.value)}
              />
            </label>
          </div>
        </>
      )}

      {tab === 'Effects' && (
        <div className="uploader__sliders">
          <label className="uploader__color-row">
            <span className="uploader__slider-label">Effect</span>
            <select
              className="uploader__select"
              value={settings.particleType}
              onChange={(e) => setSetting('particleType', e.target.value)}
            >
              {PARTICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {settings.particleType !== 'none' && (
            <>
              {sliders}
              <label className="uploader__color-row">
                <span className="uploader__slider-label">Particle color</span>
                <input
                  type="color"
                  value={settings.particleColor}
                  onChange={(e) => setSetting('particleColor', e.target.value)}
                />
              </label>
              <label className="uploader__check-row">
                <span className="uploader__slider-label">React to beat</span>
                <input
                  type="checkbox"
                  checked={settings.particleBeat}
                  onChange={(e) => setSetting('particleBeat', e.target.checked)}
                />
              </label>
            </>
          )}
        </div>
      )}

      {error && <p className="uploader__error">{error}</p>}

      <button className="uploader__reset" onClick={resetSettings}>
        Reset to defaults
      </button>

      {editingFile && (
        <CenterpieceEditor
          file={editingFile}
          onConfirm={(dataUrl) => {
            applyImage('centerpiece', dataUrl);
            setEditingFile(null);
          }}
          onCancel={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}

function Slot({ label, current, onFile, onClear }) {
  const inputRef = useRef(null);

  function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (file) onFile(file);
  }

  return (
    <div className="uploader__slot">
      <div className="uploader__preview" data-empty={current ? 'false' : 'true'}>
        {current ? <img src={current} alt={`${label} preview`} /> : <span>No {label.toLowerCase()}</span>}
      </div>
      <div className="uploader__slot-main">
        <div className="uploader__slot-label">{label}</div>
        <div className="uploader__actions">
          <button className="uploader__btn" onClick={() => inputRef.current?.click()}>
            {current ? 'Replace' : 'Upload'}
          </button>
          {current && (
            <button className="uploader__btn uploader__btn--ghost" onClick={onClear}>
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
      </div>
    </div>
  );
}
