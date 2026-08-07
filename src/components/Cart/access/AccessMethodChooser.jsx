import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../../i18n/LanguageContext';
import AccessMethodCard from './AccessMethodCard';

// Only rendered when more than one access method is enabled — the
// zero/one-method skip rule lives in Checkout.jsx, not here.
export default function AccessMethodChooser({ methods, price, photoCount, onSelect }) {
  const { t } = useLang();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 w-full max-w-md sm:max-w-3xl mx-auto py-8">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-neutral-600)' }}>
        <span>{t('access.yourPhotos', { count: photoCount })}</span>
        <span className="text-sm normal-case font-black tracking-normal" style={{ color: 'var(--color-neutral-800)' }}>
          Rp {price.toLocaleString('id-ID')}
        </span>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>{t('access.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-600)' }}>{t('access.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {methods.map((method) => (
          <AccessMethodCard key={method.key} method={method} price={price} onSelect={onSelect} />
        ))}
      </div>

      {/* A real button, not grey text: on a touch screen a faint centred label
          reads as a caption, so a customer who changed their mind had nothing
          that looked pressable. */}
      <button
        onClick={() => navigate('/cart')}
        className="mx-auto flex items-center justify-center gap-2 rounded-full font-bold active:scale-95 transition-transform"
        style={{
          padding: '12px 28px',
          fontSize: 16,
          background: '#fff',
          color: 'var(--color-neutral-700)',
          border: '2px solid var(--color-neutral-300)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <ArrowLeft size={18} /> {t('checkout.backToCart')}
      </button>
    </div>
  );
}
