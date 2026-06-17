import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileToDataUrl, cropToBBox, applyPolygonMask } from '../lib/imageStore.js';
import './CenterpieceEditor.css';

const OUTPUT = { maxDim: 1024, mime: 'image/png' };
const POINT_GAP = 0.004; // min distance between captured lasso points (fractions)

const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Modal shown after picking a centerpiece. Offers:
//   - manual lasso → refine stage (feather, grow/shrink)
//   - "use as-is"
// (Auto background removal is intentionally omitted in the Spicetify build — the
// @imgly/background-removal WASM/model is dropped for v1; lasso is the manual path.)
export default function CenterpieceEditor({ file, onConfirm, onCancel }) {
  const [originalUrl, setOriginalUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null); // current result data URL
  const [mode, setMode] = useState('choose'); // choose | select | refine
  const [path, setPath] = useState([]); // lasso points {x,y} as fractions 0..1

  // Refine state
  const [source, setSource] = useState(null); // crop data URL
  const [polyLocal, setPolyLocal] = useState(null); // lasso polygon in crop fractions
  const [feather, setFeather] = useState(2); // px
  const [grow, setGrow] = useState(0); // px (negative shrinks)

  const dragRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Live-recompute the masked preview whenever the source or refine settings change.
  useEffect(() => {
    if (mode !== 'refine' || !source || !polyLocal) return;
    let current = true;
    applyPolygonMask(source, polyLocal, { feather, grow }).then((url) => {
      if (current) setProcessedUrl(url);
    });
    return () => {
      current = false;
    };
  }, [mode, source, polyLocal, feather, grow]);

  async function useOriginal() {
    onConfirm(await fileToDataUrl(file, OUTPUT));
  }

  function resetToChoose() {
    setProcessedUrl(null);
    setMode('choose');
    setPath([]);
    setSource(null);
    setPolyLocal(null);
    setFeather(2);
    setGrow(0);
  }

  function startSelect() {
    setProcessedUrl(null);
    setPath([]);
    setMode('select');
  }

  async function enterRefine() {
    const { cropDataUrl, polyLocal: poly } = await cropToBBox(file, path, OUTPUT);
    setSource(cropDataUrl);
    setPolyLocal(poly);
    setFeather(2);
    setGrow(0);
    setMode('refine');
  }

  // --- Freehand lasso handlers (coordinates are fractions of the displayed image) ---
  function pointAt(e, rect) {
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }
  function pointerDown(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { rect };
    setPath([pointAt(e, rect)]);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const p = pointAt(e, d.rect);
    setPath((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < POINT_GAP) return prev;
      return [...prev, p];
    });
  }
  function pointerUp() {
    dragRef.current = null;
    if (path.length >= 3) enterRefine();
  }

  const selecting = mode === 'select';
  const refining = mode === 'refine';
  const preview = processedUrl || originalUrl;
  const showAlpha = refining && processedUrl;
  const polyPoints = path.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  // Portal to <body> so the fixed overlay isn't trapped by the uploader panel's
  // backdrop-filter containing block (which would push it off-screen).
  return createPortal(
    <div className="cpe-overlay" onClick={onCancel}>
      <div className="cpe" onClick={(e) => e.stopPropagation()}>
        <div className="cpe__header">
          <h2>Edit centerpiece</h2>
          <button className="cpe__close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className={`cpe__stage ${showAlpha ? 'cpe__stage--alpha' : ''}`}>
          <div
            className={`cpe__selwrap ${selecting ? 'cpe__selwrap--active' : ''}`}
            onPointerDown={selecting ? pointerDown : undefined}
            onPointerMove={selecting ? pointerMove : undefined}
            onPointerUp={selecting ? pointerUp : undefined}
          >
            {preview && <img src={preview} alt="Centerpiece preview" draggable={false} />}
            {selecting && path.length > 1 && (
              <svg className="cpe__lasso" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <path
                  className="cpe__lasso-mask"
                  d={`M0 0H100V100H0Z M${polyPoints.replace(/ /g, ' L').replace(/,/g, ' ')}Z`}
                  fillRule="evenodd"
                />
                <polygon className="cpe__lasso-shape" points={polyPoints} />
              </svg>
            )}
          </div>
        </div>

        {selecting && (
          <p className="cpe__hint cpe__hint--tip">
            Draw a loop around the area to keep — release to refine it.
          </p>
        )}

        {refining && (
          <div className="cpe__sliders">
            <label className="cpe__slider">
              <span>Feather</span>
              <input
                type="range"
                min="0"
                max="30"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
              />
              <span className="cpe__slider-val">{feather}px</span>
            </label>
            <label className="cpe__slider">
              <span>Edge</span>
              <input
                type="range"
                min="-20"
                max="20"
                value={grow}
                onChange={(e) => setGrow(Number(e.target.value))}
              />
              <span className="cpe__slider-val">
                {grow > 0 ? `+${grow}` : grow}px
              </span>
            </label>
          </div>
        )}

        <div className="cpe__actions">
          {selecting ? (
            <button className="cpe__btn" onClick={resetToChoose}>
              Cancel
            </button>
          ) : refining ? (
            <>
              <button className="cpe__btn" onClick={startSelect}>
                Redraw
              </button>
              <button
                className="cpe__btn cpe__btn--use"
                onClick={() => onConfirm(processedUrl)}
                disabled={!processedUrl}
              >
                Use this
              </button>
            </>
          ) : (
            <>
              <button className="cpe__btn cpe__btn--magic" onClick={startSelect}>
                ✂️ Lasso select
              </button>
              <button className="cpe__btn" onClick={useOriginal}>
                Use as-is
              </button>
            </>
          )}
        </div>

        <p className="cpe__hint">
          {refining
            ? 'Soften the edge with Feather, tighten/expand with Edge.'
            : 'Lasso a region to keep, then refine the edge — or use the image as-is.'}
        </p>
      </div>
    </div>,
    document.body,
  );
}
