import { useState } from 'react';
import './PresetsPanel.css';

// Save / apply / delete named presets. "Save current" captures the live settings + images;
// clicking a preset name applies it (settings + images). Shown from the top-right controls.
export default function PresetsPanel({
  presets,
  settings,
  images,
  savePreset,
  deletePreset,
  applySettings,
  applyImages,
  onClose,
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const save = () => {
    if (savePreset(name, settings, images)) {
      setName('');
      setError(null);
    } else {
      setError('Storage full — delete a preset or use smaller images.');
    }
  };

  const apply = (p) => {
    applySettings(p.settings);
    applyImages(p.images || {});
  };

  return (
    <div className="presets">
      <div className="presets__header">
        <h2>Presets</h2>
        <button className="presets__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="presets__save">
        <input
          className="presets__input"
          type="text"
          placeholder="Preset name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <button className="presets__btn" onClick={save}>
          Save current
        </button>
      </div>

      {error && <p className="presets__error">{error}</p>}

      {presets.length === 0 ? (
        <p className="presets__empty">No presets yet — name one and hit Save.</p>
      ) : (
        <ul className="presets__list">
          {presets.map((p) => (
            <li key={p.id} className="presets__item">
              <button className="presets__name" onClick={() => apply(p)} title="Apply this preset">
                {p.name}
              </button>
              <button
                className="presets__del"
                onClick={() => deletePreset(p.id)}
                aria-label={`Delete ${p.name}`}
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
