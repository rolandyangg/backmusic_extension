import { useCallback, useEffect, useState } from 'react';
import './PresetsPanel.css';

// Best-effort storage usage for the origin (covers IndexedDB, where images/presets live).
async function getStorageEstimate() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage === 'number' && typeof quota === 'number' && quota > 0) {
      return { usage, quota };
    }
  } catch {
    // unsupported
  }
  return null;
}

function fmtMB(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

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
  const [estimate, setEstimate] = useState(null);

  const refreshEstimate = useCallback(() => {
    getStorageEstimate().then(setEstimate);
  }, []);

  // Estimate on open, and after presets change (save/delete update the list).
  useEffect(() => {
    refreshEstimate();
  }, [refreshEstimate, presets]);

  const save = async () => {
    if (await savePreset(name, settings, images)) {
      setName('');
      setError(null);
    } else {
      setError('Storage full — delete a preset or use smaller images.');
    }
    refreshEstimate();
  };

  const apply = (p) => {
    applySettings(p.settings);
    applyImages(p.images || {});
  };

  const pct = estimate ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;
  const barColor = pct > 90 ? '#ff6b6b' : pct > 75 ? '#ffc861' : '#7ad7ff';

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

      {estimate && (
        <div className="presets__storage">
          <div className="presets__storage-row">
            <span>Storage</span>
            <span>
              {fmtMB(estimate.usage)} of {fmtMB(estimate.quota)} used
            </span>
          </div>
          <div className="presets__storage-bar">
            <div
              className="presets__storage-fill"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
