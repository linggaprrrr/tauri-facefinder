/**
 * Illustrations for the three scan instructions.
 *
 * Drawn inline rather than sourced as stock photography, for three reasons
 * that all bite on this particular device:
 *   · the kiosk runs offline (see the bundled fonts in index.css) — a remote
 *     asset is a broken image at the exact moment a customer needs guidance;
 *   · a photo of a specific person implies whose face the machine expects;
 *   · an SVG stays crisp on whatever panel the outlet happens to have, without
 *     shipping three resolutions of each step.
 *
 * The figure is a flat brand-tinted silhouette on purpose: it reads as
 * "a person" where an illustrated face reads as "this person".
 */
const BG    = 'var(--color-primary-50)';
const BODY  = 'var(--color-primary-200)';
const INK   = 'var(--color-primary-700)';
const GUIDE = 'var(--color-accent)';

function Frame({ children }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill={BG} />
      {children}
    </svg>
  );
}

function Person({ cy = 31, smile = false }) {
  return (
    <>
      <path d="M17 57c0-8.5 6.8-12.5 15-12.5s15 4 15 12.5z" fill={BODY} />
      <ellipse cx="32" cy={cy} rx="11" ry="12.5" fill={BODY} />
      <circle cx="28" cy={cy - 1} r="1.5" fill={INK} />
      <circle cx="36" cy={cy - 1} r="1.5" fill={INK} />
      {smile ? (
        <path
          d={`M27.5 ${cy + 4.5}c1.8 2.6 7.2 2.6 9 0`}
          stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none"
        />
      ) : (
        <path
          d={`M28.5 ${cy + 5.5}h7`}
          stroke={INK} strokeWidth="1.8" strokeLinecap="round"
        />
      )}
    </>
  );
}

/* 1 — face the camera directly */
export function StepFaceCamera() {
  return (
    <Frame>
      {/* Camera centred above the head: the sight line is the instruction. */}
      <rect x="25" y="5" width="14" height="10" rx="3" fill={INK} />
      <circle cx="32" cy="10" r="3.2" fill={BG} />
      <path d="M32 16.5v2.5" stroke={GUIDE} strokeWidth="2" strokeLinecap="round" />
      <Person />
    </Frame>
  );
}

/* 2 — put your face inside the oval */
export function StepInsideOval() {
  return (
    <Frame>
      {/* Same dashed oval the live overlay draws, so the picture and the
          camera view agree with each other. */}
      <ellipse
        cx="32" cy="32" rx="16" ry="20"
        fill="none" stroke={GUIDE} strokeWidth="2" strokeDasharray="4 3"
      />
      {/* Number, not a string: cy is used in arithmetic below, and "30" + 5.5
          would concatenate to "305.5" and throw the mouth off the canvas. */}
      <Person cy={30} />
    </Frame>
  );
}

/* 3 — smile naturally */
export function StepSmile() {
  return (
    <Frame>
      <Person smile />
      <path
        d="M48 14l1.4 3.6L53 19l-3.6 1.4L48 24l-1.4-3.6L43 19l3.6-1.4z"
        fill={GUIDE}
      />
    </Frame>
  );
}
