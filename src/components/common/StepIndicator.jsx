import { Check } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const STEP_KEYS = ['step.scan', 'step.gallery', 'step.editor', 'step.cart', 'step.download'];

export default function StepIndicator({ current }) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      {STEP_KEYS.map((key, index) => {
        const label = t(key);
        const isDone = index < current;
        const isActive = index === current;

        return (
          <div key={key} className="flex items-center">
            {/* Step circle. Sized for a kiosk read at arm's length — this is
                the only thing on screen telling a customer how far through the
                flow they are, and it was set smaller than the body text. */}
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-full font-black transition-all duration-200"
                style={{
                  width: 44, height: 44, fontSize: 19,
                  background: isActive
                    ? 'var(--gradient-primary)'
                    : isDone
                    ? 'var(--gradient-accent)'
                    : 'var(--color-neutral-200)',
                  color: isActive || isDone ? '#fff' : 'var(--color-neutral-600)',
                  boxShadow: isActive
                    ? 'var(--shadow-glow-primary)'
                    : isDone
                    ? 'var(--shadow-glow-accent)'
                    : 'none',
                  transform: isActive ? 'scale(1.12)' : 'scale(1)',
                }}
              >
                {isDone ? <Check size={22} strokeWidth={3.5} /> : index + 1}
              </div>
              <span
                className="hidden md:inline transition-all"
                style={{
                  // The current step outweighs the rest: heavier, darker, and a
                  // step larger, so "where am I" is answered by weight rather
                  // than by reading all five labels.
                  fontSize: isActive ? 18 : 16,
                  fontWeight: isActive ? 900 : 600,
                  color: isActive
                    ? 'var(--color-primary)'
                    : isDone
                    ? 'var(--color-neutral-700)'
                    : 'var(--color-neutral-600)',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEP_KEYS.length - 1 && (
              <div
                className="w-8 h-1.5 mx-2.5 rounded-full transition-all duration-300"
                style={{
                  background: isDone
                    ? 'var(--gradient-accent)'
                    : 'var(--color-neutral-200)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
