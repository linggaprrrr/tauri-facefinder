import { useMemo, useState } from 'react';

const OVERLAY_MIN_SIZE = 12;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBoundingBox(rawBox) {
  if (!rawBox) return null;

  if (Array.isArray(rawBox)) {
    if (rawBox.length >= 4) {
      const [x, y, width, height] = rawBox;
      return {
        x: toFiniteNumber(x),
        y: toFiniteNumber(y),
        width: toFiniteNumber(width),
        height: toFiniteNumber(height),
      };
    }
    if (rawBox.length === 1) return extractBoundingBox(rawBox[0]);
  }

  if (typeof rawBox === 'object') {
    const x = toFiniteNumber(rawBox.x ?? rawBox.left ?? rawBox.xmin ?? rawBox[0]);
    const y = toFiniteNumber(rawBox.y ?? rawBox.top ?? rawBox.ymin ?? rawBox[1]);
    const width = toFiniteNumber(rawBox.width ?? rawBox.w ?? rawBox[2]);
    const height = toFiniteNumber(rawBox.height ?? rawBox.h ?? rawBox[3]);
    if (x !== null && y !== null && width !== null && height !== null) {
      return { x, y, width, height };
    }
  }

  return null;
}

function normalizeBoundingBox(rawBox, dimensions) {
  const box = extractBoundingBox(rawBox);
  if (!box || !dimensions.width || !dimensions.height) return null;

  const usesNormalizedCoordinates =
    box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 &&
    box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;

  const left   = usesNormalizedCoordinates ? box.x * 100      : (box.x / dimensions.width) * 100;
  const top    = usesNormalizedCoordinates ? box.y * 100      : (box.y / dimensions.height) * 100;
  const width  = usesNormalizedCoordinates ? box.width * 100  : (box.width / dimensions.width) * 100;
  const height = usesNormalizedCoordinates ? box.height * 100 : (box.height / dimensions.height) * 100;

  const cl = Math.min(Math.max(left, 0), 100);
  const ct = Math.min(Math.max(top, 0), 100);
  const cw = Math.min(Math.max(width, 0), 100 - cl);
  const ch = Math.min(Math.max(height, 0), 100 - ct);

  if (cw <= 0 || ch <= 0) return null;

  return {
    left: `${cl}%`,
    top: `${ct}%`,
    width:  `max(${cw}%, ${OVERLAY_MIN_SIZE}px)`,
    height: `max(${ch}%, ${OVERLAY_MIN_SIZE}px)`,
  };
}

const FALLBACK_RATIO = 1;

export default function PhotoCard({
  photo,
  aspectRatio,
  selected,
  selectionOrder,
  onPreview,
  onRatioChange,
  onToggle,
}) {
  const [loaded, setLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const resolvedAspectRatio = aspectRatio || FALLBACK_RATIO;

  const boundingBoxStyle = useMemo(
    () => normalizeBoundingBox(photo.bounding_box, imageDimensions),
    [photo.bounding_box, imageDimensions]
  );

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-200"
      style={{
        boxShadow: selected
          ? '0 0 0 3px var(--color-primary), 0 4px 20px rgba(1,125,197,0.25)'
          : 'var(--shadow-sm)',
        transform: selected ? 'translateY(-2px)' : 'none',
        aspectRatio: `${resolvedAspectRatio}`,
        background: 'var(--color-neutral-100)',
        width: '100%',
        maxWidth: '22rem',
        maxHeight: '42rem',
      }}
      onClick={() => onPreview(photo)}
    >
      {/* Skeleton while loading */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'var(--color-neutral-200)' }}
        />
      )}

      <img
        src={photo.thumbnail}
        alt="Photo"
        className="absolute inset-0 block h-full w-full object-cover"
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth && naturalHeight) {
            setImageDimensions({ width: naturalWidth, height: naturalHeight });
            onRatioChange?.(photo.id, naturalWidth / naturalHeight);
          }
          setLoaded(true);
        }}
      />

      {/* Blue overlay tint when selected */}
      {selected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(1,125,197,0.1)' }}
        />
      )}

      {boundingBoxStyle && (
        <div className="face-scan-box" style={boundingBoxStyle} aria-hidden="true">
          <div className="face-scan-corners" />
          <div className="scan-mask" />
        </div>
      )}

      {/* Best / label badge — top left */}
      {photo.label && (
        <span
          className="absolute top-2 left-2 text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--color-accent)', color: 'var(--color-neutral-900)' }}
        >
          {photo.label}
        </span>
      )}

      {/* Selection number badge — top right, 44px ghost tap zone */}
      <button
        className="absolute top-1.5 right-1.5 flex items-center justify-center transition-all active:scale-90"
        style={{
          width: 44,
          height: 44,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        onClick={(e) => { e.stopPropagation(); onToggle(photo); }}
        aria-pressed={selected}
        aria-label={selected ? 'Hapus dari pilihan' : 'Pilih foto'}
      >
        <span
          className="flex items-center justify-center rounded-full font-black text-sm transition-all"
          style={{
            width: 28,
            height: 28,
            background: selected ? 'var(--color-primary)' : 'rgba(255,255,255,0.82)',
            color: selected ? '#fff' : 'var(--color-neutral-400)',
            border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
            backdropFilter: 'blur(4px)',
            boxShadow: selected ? '0 2px 10px rgba(1,125,197,0.4)' : '0 1px 4px rgba(0,0,0,0.15)',
            fontSize: selected ? 13 : 0,
          }}
        >
          {selected ? selectionOrder : ''}
        </span>
      </button>

      {/* Bottom gradient bar — outlet + price */}
      <div
        className="absolute bottom-0 inset-x-0 flex items-end justify-between p-2.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
      >
        {photo.outlet_name && (
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {photo.outlet_name}
          </span>
        )}
        <span className="text-sm font-bold ml-auto" style={{ color: '#fff' }}>
          Rp {photo.price.toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  );
}
