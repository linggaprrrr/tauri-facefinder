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
    <div className="flex flex-col gap-5 w-full max-w-md mx-auto py-8">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-neutral-400)' }}>
        <span>{t('access.yourPhotos', { count: photoCount })}</span>
        <span className="text-sm normal-case font-black tracking-normal" style={{ color: 'var(--color-neutral-800)' }}>
          Rp {price.toLocaleString('id-ID')}
        </span>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>{t('access.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>{t('access.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        {methods.map((method) => (
          <AccessMethodCard key={method.key} method={method} price={price} onSelect={onSelect} />
        ))}
      </div>

      <button
        onClick={() => navigate('/cart')}
        className="flex items-center justify-center gap-1.5 py-2 text-sm font-semibold"
        style={{ color: 'var(--color-neutral-500)' }}
      >
        <ArrowLeft size={16} /> {t('checkout.backToCart')}
      </button>
    </div>
  );
}
