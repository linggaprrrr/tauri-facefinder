import { useMemo, useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';

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

/**
 * A single search result.
 *
 * Tapping the card opens the preview, which is where the photo can actually be
 * judged and then chosen — the preview carries its own Select button and
 * prev/next, so it is the full picking flow rather than a detour from it. The
 * circle badge stays as a direct toggle for anyone who already knows they want
 * the photo and does not need to look closer.
 *
 * The two controls are siblings, not nested (nesting buttons is invalid HTML),
 * which is what makes the grid keyboard-reachable and gives each the global
 * focus ring for free.
 */
export default function PhotoCard({ photo, selected, selectionOrder, onPreview, onToggle }) {
  const { t } = useLang();
  const [loaded, setLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const boundingBoxStyle = useMemo(
    () => normalizeBoundingBox(photo.bounding_box, imageDimensions),
    [photo.bounding_box, imageDimensions]
  );

  const name = photo.filename || photo.outlet_name || '';

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        boxShadow: selected
          ? '0 0 0 3px var(--color-primary), 0 4px 20px rgba(1,125,197,0.25)'
          : 'var(--shadow-sm)',
        transform: selected ? 'translateY(-2px)' : 'none',
        // Fixed ratio, so rows line up and the grid reads as a grid. Photos are
        // mixed portrait and landscape; object-cover absorbs the difference.
        aspectRatio: '4 / 3',
        background: 'var(--color-neutral-100)',
      }}
    >
      <button
        type="button"
        onClick={() => onPreview(photo)}
        aria-label={t('gallery.previewAria', { name })}
        className="absolute inset-0 block w-full h-full cursor-pointer select-none"
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
          alt=""
          className="absolute inset-0 block h-full w-full object-cover"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth && naturalHeight) {
              setImageDimensions({ width: naturalWidth, height: naturalHeight });
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

        {/* Best / label badge — offset to clear the selection control */}
        {photo.label && (
          <span
            className="absolute top-2 left-11 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-accent)', color: 'var(--color-neutral-900)' }}
          >
            {photo.label}
          </span>
        )}

        {/* Bottom gradient bar — filename + price */}
        <div
          className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-2 p-2.5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
        >
          <span
            className="text-xs font-semibold truncate text-left"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {name}
          </span>
          <span className="text-sm font-bold shrink-0" style={{ color: '#fff' }}>
            Rp {photo.price.toLocaleString('id-ID')}
          </span>
        </div>
      </button>

      {/* Direct select toggle. The visible circle is 26px but the button is a
          44px target — the old version's 28px badge was the single hardest
          thing to hit on this screen. */}
      <button
        type="button"
        onClick={() => onToggle(photo)}
        aria-pressed={selected}
        aria-label={t(selected ? 'gallery.deselectAria' : 'gallery.selectAria', { name })}
        className="absolute top-0 left-0 z-10 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
        style={{ width: 44, height: 44, background: 'transparent', border: 'none', padding: 0 }}
      >
        <span
          className="flex items-center justify-center rounded-full font-black transition-all"
          style={{
            width: 26,
            height: 26,
            fontSize: 13,
            background: selected ? 'var(--color-primary)' : 'rgba(255,255,255,0.82)',
            color: '#fff',
            border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.18)',
            backdropFilter: 'blur(4px)',
            boxShadow: selected ? '0 2px 10px rgba(1,125,197,0.4)' : '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          {selected ? selectionOrder : ''}
        </span>
      </button>
    </div>
  );
}
