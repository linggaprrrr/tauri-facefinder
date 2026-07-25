import { ArrowRight } from 'lucide-react';
import { useLang } from '../../../i18n/LanguageContext';

// Card version — one big icon illustration over a colored label bar, tap
// anywhere to select. `method` is a merged registry+server-config entry (see
// useAccessMethods); `price` is the cart total, used for kind:'payment'
// methods' outcome line. kind:'verification' methods (event ticket, promo
// voucher) show Gratis/Cek potongan instead, so this never changes when a
// new verification method lands.
export default function AccessMethodCard({ method, price, onSelect }) {
  const { t } = useLang();
  const Icon = method.icon;
  const title = method.title_override ?? t(method.titleKey);
  const barColor = method.is_default ? 'var(--color-primary)' : 'var(--color-neutral-900)';

  return (
    <button
      onClick={() => onSelect(method)}
      className="relative flex flex-col w-full rounded-[28px] overflow-hidden text-left transition-all active:scale-[0.97]"
      style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1.5px solid var(--color-neutral-100)' }}
    >
      {method.badge === 'recommended' && (
        <span
          className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          {t('access.recommended')}
        </span>
      )}

      <div className="flex-1 flex items-center justify-center py-10 px-6 min-h-[160px]">
        <Icon size={104} strokeWidth={1.4} style={{ color: 'var(--color-neutral-900)' }} />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: barColor }}>
        <div className="min-w-0">
          <p className="font-black text-base truncate" style={{ color: '#fff' }}>{title}</p>
          <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {method.kind === 'payment'
              ? `Rp ${price.toLocaleString('id-ID')}`
              : method.badge === 'free'
                ? t('access.free')
                : t('access.checkDiscount')}
          </p>
        </div>
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ border: '1.5px solid rgba(255,255,255,0.6)', color: '#fff' }}
        >
          <ArrowRight size={16} />
        </span>
      </div>
    </button>
  );
}
