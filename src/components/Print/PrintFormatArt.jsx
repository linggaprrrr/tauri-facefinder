/**
 * A miniature of what the customer actually receives: one photo, or a strip of
 * N frames down a tall sheet.
 *
 * Driven by `templateVersion.slots` — the same array `composePrintImage` fills
 * — so the picture cannot drift away from the product it is advertising. The
 * two print options previously differed only by their label, which left a
 * customer no way to work out what a "Strip Foto" even is before buying one.
 *
 * Inline SVG rather than bitmaps for the same reason as the scan illustrations:
 * this kiosk runs offline, and a missing image here is a missing product.
 */
const PAPER = '#fff';
const EDGE  = 'var(--color-primary-200)';
const FILL  = 'var(--color-primary-100)';
const INK   = 'var(--color-primary)';

export default function PrintFormatArt({ slots = 1, className = '' }) {
  const frames = Math.max(1, slots);

  // Single-slot template: one landscape print, drawn with a horizon and sun so
  // it reads as "a photo" rather than as an empty rectangle.
  if (frames === 1) {
    return (
      <svg viewBox="0 0 56 56" className={className} aria-hidden="true" focusable="false">
        <rect x="3" y="11" width="50" height="34" rx="4" fill={PAPER} stroke={EDGE} strokeWidth="2" />
        <rect x="7" y="15" width="42" height="26" rx="2" fill={FILL} />
        <circle cx="18" cy="24" r="4" fill={INK} opacity="0.5" />
        <path d="M7 41v-4l11-10 8 8 6-5 17 11z" fill={INK} opacity="0.42" />
      </svg>
    );
  }

  // Strip: a 2x6-shaped sheet with the frames stacked down it. Capped at five
  // drawn frames — past that the shapes stop being legible at this size, and
  // the exact count is spelled out in the label beside the art anyway.
  const drawn = Math.min(frames, 5);
  const TOP = 4, GAP = 2, RUN = 48;
  const h = (RUN - GAP * (drawn - 1)) / drawn;

  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden="true" focusable="false">
      <rect x="19" y="2" width="18" height="52" rx="3" fill={PAPER} stroke={EDGE} strokeWidth="2" />
      {Array.from({ length: drawn }, (_, i) => (
        <rect
          key={i}
          x="22" y={TOP + i * (h + GAP)}
          width="12" height={h} rx="1.5"
          fill={FILL}
        />
      ))}
    </svg>
  );
}
