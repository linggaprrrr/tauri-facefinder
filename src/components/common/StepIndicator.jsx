import { ScanFace, Image, SlidersHorizontal, Wallet, Download } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const STEPS = [
  { key: 'step.scan', icon: ScanFace },
  { key: 'step.gallery', icon: Image },
  { key: 'step.editor', icon: SlidersHorizontal },
  { key: 'step.cart', icon: Wallet },
  { key: 'step.download', icon: Download },
];

// Icon tiles rather than numbered dots: a customer reads "where am I" from the
// picture at a glance, and the tile is a big enough shape to carry the active
// state by colour alone. The underline under each label fills as the flow
// advances, so progress reads left to right without counting.
export default function StepIndicator({ current }) {
  const { t } = useLang();
  return (
    <div className="flex items-start justify-between gap-1 w-full">
      {STEPS.map(({ key, icon: Icon }, index) => {
        const isDone = index < current;
        const isActive = index === current;
        return (
          <div key={key} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <div
                className={`flex items-center justify-center transition-all duration-200 ${isActive ? '' : 'raised-tile'}`}
                style={{
                  width: 72, height: 72, borderRadius: 22,
                  background: isActive ? 'var(--gradient-primary)' : undefined,
                  color: isActive ? '#fff' : isDone ? 'var(--color-primary)' : 'var(--color-neutral-800)',
                  boxShadow: isActive ? 'var(--shadow-glow-primary)' : undefined,
                  transform: isActive ? 'scale(1.08)' : 'none',
                }}
              >
                <Icon size={34} strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span
                className="uppercase text-center truncate max-w-full"
                style={{
                  fontSize: 16,
                  fontWeight: isActive ? 900 : 700,
                  letterSpacing: '0.02em',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-neutral-800)',
                }}
              >
                {t(key)}
              </span>
              <span
                className="block h-1.5 rounded-full w-14"
                style={{ background: isDone || isActive ? 'var(--gradient-primary)' : 'var(--color-neutral-200)' }}
              />
            </div>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className="shrink-0 w-4 h-0.5 rounded-full"
                style={{ marginTop: 36, background: 'var(--color-neutral-300)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
