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
            {/* Step circle */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-200"
                style={{
                  background: isActive
                    ? 'var(--gradient-primary)'
                    : isDone
                    ? 'var(--gradient-accent)'
                    : 'var(--color-neutral-200)',
                  color: isActive || isDone ? '#fff' : 'var(--color-neutral-500)',
                  boxShadow: isActive
                    ? 'var(--shadow-glow-primary)'
                    : isDone
                    ? 'var(--shadow-glow-accent)'
                    : 'none',
                  transform: isActive ? 'scale(1.12)' : 'scale(1)',
                }}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className="text-sm font-semibold hidden md:inline"
                style={{
                  color: isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-neutral-400)',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEP_KEYS.length - 1 && (
              <div
                className="w-7 h-1 mx-2 rounded-full transition-all duration-300"
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
