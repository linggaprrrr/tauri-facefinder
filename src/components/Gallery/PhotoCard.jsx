import { useMemo, useState } from 'react';

const FALLBACK_RATIO = 1;
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

    if (rawBox.length === 1) {
      return extractBoundingBox(rawBox[0]);
    }
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

  const left = usesNormalizedCoordinates ? box.x * 100 : (box.x / dimensions.width) * 100;
  const top = usesNormalizedCoordinates ? box.y * 100 : (box.y / dimensions.height) * 100;
  const width = usesNormalizedCoordinates ? box.width * 100 : (box.width / dimensions.width) * 100;
  const height = usesNormalizedCoordinates ? box.height * 100 : (box.height / dimensions.height) * 100;

  const clampedLeft = Math.min(Math.max(left, 0), 100);
  const clampedTop = Math.min(Math.max(top, 0), 100);
  const clampedWidth = Math.min(Math.max(width, 0), 100 - clampedLeft);
  const clampedHeight = Math.min(Math.max(height, 0), 100 - clampedTop);

  if (clampedWidth <= 0 || clampedHeight <= 0) return null;

  return {
    left: `${clampedLeft}%`,
    top: `${clampedTop}%`,
    width: `max(${clampedWidth}%, ${OVERLAY_MIN_SIZE}px)`,
    height: `max(${clampedHeight}%, ${OVERLAY_MIN_SIZE}px)`,
  };
}

export default function PhotoCard({
  photo,
  aspectRatio,
  selected,
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
      className="mb-4 break-inside-avoid"
    >
      <div
        className="relative rounded-lg overflow-hidden cursor-pointer select-none transition-all duration-200"
        style={{
          boxShadow: selected ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
          outline: selected ? '3px solid var(--color-primary)' : '3px solid transparent',
          outlineOffset: '2px',
          transform: selected ? 'scale(1.03)' : 'scale(1)',
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
          loading="lazy"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight) {
              setImageDimensions({ width: naturalWidth, height: naturalHeight });
              onRatioChange(photo.id, naturalWidth / naturalHeight);
            }
            setLoaded(true);
          }}
        />

        {boundingBoxStyle && (
          <div className="face-scan-box" style={boundingBoxStyle} aria-hidden="true">
            <div className="face-scan-corners" />
            <div className="scan-mask" />
          </div>
        )}

        {/* Similarity label badge */}
        {photo.label && (
          <span
            className="absolute top-2 left-2 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-neutral-900)',
            }}
          >
            {photo.label}
          </span>
        )}

        {/* Select toggle button — always visible, top-right */}
        <button
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-all active:scale-90"
          style={{
            background: selected ? 'var(--color-primary)' : 'rgba(255,255,255,0.75)',
            color: selected ? '#fff' : 'var(--color-neutral-500)',
            border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { e.stopPropagation(); onToggle(photo); }}
        >
          ✓
        </button>

        {/* Bottom bar: price */}
        <div
          className="absolute bottom-0 inset-x-0 flex items-center p-3"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
        >
          <span className="text-white text-sm font-bold">
            Rp {photo.price.toLocaleString('id-ID')}
          </span>
        </div>
      </div>
    </div>
  );
}
