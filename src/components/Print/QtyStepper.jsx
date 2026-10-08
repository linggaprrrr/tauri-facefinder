import { Minus, Plus } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

// − n + quantity control, kiosk-sized. `display` overrides the number shown
// (e.g. "1–3" when photos have different counts); the buttons still step from
// `value`.
export default function QtyStepper({ value, onChange, min = 0, max = 20, display, size = 'md' }) {
  const { t } = useLang();
  const box = size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t('print.copiesLess')}
        className={`raised-tile ${box} rounded-xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40`}
        style={{ color: 'var(--color-neutral-900)' }}
      >
        <Minus size={size === 'lg' ? 24 : 18} strokeWidth={3} />
      </button>
      <span
        className={`raised-tile ${size === 'lg' ? 'min-w-16 h-14 text-2xl' : 'min-w-11 h-10 text-lg'} px-2 rounded-xl flex items-center justify-center font-black tabular-nums`}
        style={{ color: 'var(--color-neutral-900)' }}
        aria-live="polite"
      >
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t('print.copiesMore')}
        className={`${box} rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-40`}
        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
      >
        <Plus size={size === 'lg' ? 24 : 18} strokeWidth={3} />
      </button>
    </div>
  );
}
