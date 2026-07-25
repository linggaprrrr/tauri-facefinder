import { useLang } from '../../../i18n/LanguageContext';

// One tap, whole card — no select-then-confirm step. `method` is a merged
// registry+server-config entry (see useAccessMethods); `price` is the cart
// total, used for kind:'payment' methods' outcome column. kind:'verification'
// methods (event ticket, promo voucher — Phase B/C) show Gratis/Cek potongan
// instead, so this card never needs to change when those land.
export default function AccessMethodCard({ method, price, onSelect }) {
  const { t } = useLang();
  const Icon = method.icon;
  const title = method.title_override ?? t(method.titleKey);
  const description = method.description_override ?? t(method.descKey);

  return (
    <button
      onClick={() => onSelect(method)}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
      style={{
        background: method.is_default ? 'var(--color-primary-50)' : '#fff',
        border: method.is_default ? '2px solid var(--color-primary)' : '1.5px solid var(--color-neutral-200)',
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: method.is_default ? 'var(--color-primary)' : 'var(--color-primary-50)',
          color: method.is_default ? '#fff' : 'var(--color-primary)',
        }}
      >
        <Icon size={22} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-base" style={{ color: 'var(--color-neutral-900)' }}>{title}</span>
          {method.badge === 'recommended' && (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {t('access.recommended')}
            </span>
          )}
        </div>
        <p className="text-sm truncate" style={{ color: 'var(--color-neutral-500)' }}>{description}</p>
      </div>

      <div className="text-right shrink-0 tabular-nums">
        {method.kind === 'payment' ? (
          <span className="font-black text-base" style={{ color: 'var(--color-neutral-800)' }}>
            Rp {price.toLocaleString('id-ID')}
          </span>
        ) : method.badge === 'free' ? (
          <span className="font-black text-base" style={{ color: 'var(--color-success)' }}>{t('access.free')}</span>
        ) : (
          <span className="text-sm font-semibold" style={{ color: 'var(--color-neutral-400)' }}>{t('access.checkDiscount')}</span>
        )}
      </div>

      <span className="shrink-0 text-lg" style={{ color: 'var(--color-neutral-300)' }}>→</span>
    </button>
  );
}
