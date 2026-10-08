import { ScanFace, Image, SlidersHorizontal, Wallet, Download } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const STEPS = [
  { key: 'step.scan', icon: ScanFace },
  { key: 'step.gallery', icon: Image },
  { key: 'step.editor', icon: SlidersHorizontal },
  { key: 'step.cart', icon: Wallet },
  { key: 'step.download', icon: Download },
];

const TILE = 92;

// Icon tiles rather than numbered dots: a customer reads "where am I" from the
// picture at a glance, and the tile is a big enough shape to carry the active
// state by colour alone. Sized as the most important wayfinding on screen —
// it is the one thing telling a customer how far through the flow they are.
// The lines between tiles fill the gap and turn blue up to the current step,
// so progress reads left to right without counting.
export default function StepIndicator({ current }) {
  const { t } = useLang();
  return (
    <div className="flex items-start w-full">
      {STEPS.map(({ key, icon: Icon }, index) => {
        const isDone = index < current;
        const isActive = index === current;
        return (
          <div key={key} className={`flex items-start ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-2.5 shrink-0" style={{ minWidth: TILE }}>
              <div className="relative">
                {/* Active step: a ring pings outward behind the tile (see
                    .step-ping / .step-breathe in index.css). */}
                {isActive && (
                  <span
                    aria-hidden
                    className="step-ping absolute inset-0"
                    style={{ borderRadius: 28, background: 'var(--color-primary)' }}
                  />
                )}
                <div
                  className={`relative flex items-center justify-center transition-colors duration-200 ${isActive ? 'step-breathe' : 'raised-tile'}`}
                  aria-current={isActive ? 'step' : undefined}
                  style={{
                    width: TILE, height: TILE, borderRadius: 28,
                    background: isActive ? 'var(--gradient-primary)' : undefined,
                    color: isActive ? '#fff' : isDone ? 'var(--color-primary)' : 'var(--color-neutral-800)',
                    boxShadow: isActive ? 'var(--shadow-neu-color)' : undefined,
                  }}
                >
                  <Icon size={44} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
              </div>
              <span
                className="uppercase text-center whitespace-nowrap"
                style={{
                  fontSize: 18,
                  fontWeight: isActive ? 900 : 700,
                  letterSpacing: '0.02em',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-neutral-800)',
                }}
              >
                {t(key)}
              </span>
              <span
                className="block h-2 rounded-full w-16"
                style={{ background: isDone || isActive ? 'var(--gradient-primary)' : 'var(--color-neutral-200)' }}
              />
            </div>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className="flex-1 h-1.5 rounded-full mx-2"
                style={{ marginTop: TILE / 2 - 3, background: isDone ? 'var(--gradient-primary)' : 'var(--color-neutral-300)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
