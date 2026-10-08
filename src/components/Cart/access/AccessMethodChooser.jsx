import { Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../../i18n/LanguageContext';
import AccessMethodCard from './AccessMethodCard';
import PageHeader from '../../common/PageHeader';
import NavBar from '../../common/NavBar';

// Only rendered when more than one access method is enabled — the
// zero/one-method skip rule lives in Checkout.jsx, not here.
export default function AccessMethodChooser({ methods, price, photoCount, onSelect }) {
  const { t } = useLang();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 w-full max-w-md sm:max-w-3xl mx-auto min-h-full">
      <PageHeader
        icon={Wallet}
        title={t('access.title')}
        subtitle={t('access.subtitle')}
        action={
          <span className="text-right block">
            <span className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-neutral-600)' }}>
              {t('access.yourPhotos', { count: photoCount })}
            </span>
            <span className="block text-xl font-black" style={{ color: 'var(--color-primary)' }}>
              Rp {price.toLocaleString('id-ID')}
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {methods.map((method) => (
          <AccessMethodCard key={method.key} method={method} price={price} onSelect={onSelect} />
        ))}
      </div>

      <div className="mt-auto">
        <NavBar back={{ label: t('nav.back'), sub: t('checkout.backToCart'), onClick: () => navigate('/cart') }} />
      </div>
    </div>
  );
}
