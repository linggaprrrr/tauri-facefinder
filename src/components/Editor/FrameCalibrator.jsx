import { useState, useRef, useCallback, useEffect } from 'react';
import { Target, Check, X } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

// FrameCalibrator — developer tool for measuring slot positions on a layout frame PNG.
//
// How to use:
//   1. Open a layout frame in the editor and click the "Kalibrasi Slot" button.
//   2. Click and drag on the frame image to draw each slot rectangle.
//   3. Click "Hapus Terakhir" to remove the last slot if you made a mistake.
//   4. Click "Salin JSON" — the output is ready to paste into the frame's .json config file.
//
// Coordinates are normalized (0–1) so they work at any canvas resolution.

function rectFromPoints(a, b, imgW, imgH) {
  const x = Math.min(a.x, b.x) / imgW;
  const y = Math.min(a.y, b.y) / imgH;
  const w = Math.abs(b.x - a.x) / imgW;
  const h = Math.abs(b.y - a.y) / imgH;
  return { x: round4(x), y: round4(y), w: round4(w), h: round4(h), rx: 0.008 };
}

function round4(n) { return Math.round(n * 10000) / 10000; }

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#0ea5e9'];

export default function FrameCalibrator({ frame, existingSlots = [], onClose, onSave }) {
  const { t } = useLang();
  const containerRef = useRef(null);
  const [slots, setSlots] = useState(existingSlots.map((s, i) => ({ ...s, id: i })));
  const [drawing, setDrawing] = useState(null); // { start: {x,y} }
  const [cursor, setCursor] = useState(null);   // current mouse pos during draw
  const [imgSize, setImgSize] = useState(null); // { w, h } of rendered img in px
  const [copied, setCopied] = useState(false);

  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    function measure() {
      setImgSize({ w: img.clientWidth, h: img.clientHeight });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    return () => ro.disconnect();
  }, []);

  const getPos = useCallback((e) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(clientY - rect.top, rect.height)),
    };
  }, []);

  function handleMouseDown(e) {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setDrawing({ start: pos });
    setCursor(pos);
  }

  function handleMouseMove(e) {
    if (!drawing) return;
    const pos = getPos(e);
    if (pos) setCursor(pos);
  }

  function handleMouseUp(e) {
    if (!drawing || !cursor || !imgSize) return;
    const rect = rectFromPoints(drawing.start, cursor, imgSize.w, imgSize.h);
    if (rect.w > 0.005 && rect.h > 0.005) {
      setSlots((prev) => [...prev, { ...rect, id: prev.length }]);
    }
    setDrawing(null);
    setCursor(null);
  }

  function removeLastSlot() {
    setSlots((prev) => prev.slice(0, -1));
  }

  function buildJson() {
    const output = {
      id: frame.id,
      label: frame.label,
      aspectRatio: round4(frame.aspectRatio ?? (imgSize ? imgSize.w / imgSize.h : 0.6667)),
      slots: slots.map((s, i) => ({ id: i, x: s.x, y: s.y, w: s.w, h: s.h, rx: s.rx ?? 0.008 })),
    };
    return JSON.stringify(output, null, 2);
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildJson()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSave() {
    onSave?.(slots.map((s, i) => ({ id: i, x: s.x, y: s.y, w: s.w, h: s.h, rx: s.rx ?? 0.008 })));
    onClose();
  }

  // Draw active rectangle while dragging
  const activeRect = drawing && cursor && imgSize
    ? rectFromPoints(drawing.start, cursor, imgSize.w, imgSize.h)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0 flex-wrap"
        style={{ background: '#1e1b4b', borderBottom: '1px solid #312e81' }}
      >
        <span className="font-bold text-white text-sm inline-flex items-center gap-1.5">
          <Target size={16} /> {t('calib.title', { label: frame.label })}
        </span>
        <span className="text-xs px-2 py-1 rounded" style={{ background: '#312e81', color: '#a5b4fc' }}>
          {t('calib.slotsDefined', { count: slots.length })}
        </span>
        <div className="flex-1" />
        <button
          onClick={removeLastSlot}
          disabled={slots.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-30"
          style={{ background: '#7f1d1d', color: '#fca5a5' }}
        >
          {t('calib.removeLast')}
        </button>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1"
          style={{ background: '#14532d', color: '#86efac' }}
        >
          {copied ? <><Check size={13} strokeWidth={3} /> {t('calib.copied')}</> : t('calib.copyJson')}
        </button>
        <button
          onClick={handleSave}
          disabled={slots.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-30"
          style={{ background: '#6366f1', color: '#fff' }}
        >
          {t('calib.saveClose')}
        </button>
        <button
          onClick={onClose}
          className="text-white opacity-60 hover:opacity-100 leading-none ml-1"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>
      </div>

      {/* Instruction */}
      <div className="text-center py-2 text-xs" style={{ color: '#a5b4fc' }}>
        {t('calib.instruction')}
      </div>

      {/* Main canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        <div
          ref={containerRef}
          className="relative select-none"
          style={{ display: 'inline-block', cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={frame.src}
            alt={frame.label}
            style={{ display: 'block', maxHeight: '80vh', maxWidth: '70vw', userSelect: 'none' }}
            draggable={false}
            onLoad={() => {
              if (imgRef.current) {
                setImgSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
              }
            }}
          />

          {/* Saved slots */}
          {imgSize && slots.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: s.x * imgSize.w,
                top: s.y * imgSize.h,
                width: s.w * imgSize.w,
                height: s.h * imgSize.h,
                border: `2px solid ${COLORS[i % COLORS.length]}`,
                background: `${COLORS[i % COLORS.length]}22`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            >
              <span
                className="absolute top-0 left-0 text-white text-xs font-bold px-1"
                style={{ background: COLORS[i % COLORS.length], fontSize: 10, lineHeight: '16px' }}
              >
                {i + 1}
              </span>
            </div>
          ))}

          {/* Active draw rect */}
          {activeRect && imgSize && (
            <div
              style={{
                position: 'absolute',
                left: activeRect.x * imgSize.w,
                top: activeRect.y * imgSize.h,
                width: activeRect.w * imgSize.w,
                height: activeRect.h * imgSize.h,
                border: '2px dashed #fff',
                background: 'rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* JSON preview panel */}
        <div
          className="ml-4 shrink-0 flex flex-col gap-2"
          style={{ width: 280 }}
        >
          <p className="text-xs font-bold" style={{ color: '#a5b4fc' }}>{t('calib.outputJson')}</p>
          <pre
            className="rounded-xl p-3 text-xs overflow-auto"
            style={{
              background: '#0f172a',
              color: '#86efac',
              maxHeight: '75vh',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {buildJson()}
          </pre>
          <p className="text-xs" style={{ color: '#64748b' }}>
            {t('calib.pasteTo')}{' '}
            <code style={{ color: '#94a3b8' }}>public/frames/{frame.id}.json</code>
          </p>
        </div>
      </div>
    </div>
  );
}
