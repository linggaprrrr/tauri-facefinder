import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';
import { getTransaction } from '../../api/mockApi';
import { clearPendingOrder } from '../../utils/pendingOrder';
import { useLang } from '../../i18n/LanguageContext';
import Button from './Button';

const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_LINK ?? 'https://myphoto.com';

// Shown on startup when a recent pendingOrder exists — i.e. the kiosk reset
// after a customer started/finished paying. Re-checks the transaction (payment
// is webhook-authoritative on the backend) and surfaces the pickup QR for a
// paid order, so a crash/reboot never strands a paying customer.
export default function OrderRecovery({ order, onClose }) {
  const { t } = useLang();
  // 'checking' | 'paid' | 'pending' | 'gone' | 'error'
  const [view, setView] = useState('checking');

  const check = useCallback(async () => {
    setView('checking');
    try {
      const trx = await getTransaction(order.id);
      if (trx.paid) setView('paid');
      else if (['cancelled', 'expired', 'failed'].includes(trx.status)) setView('gone');
      else setView('pending');
    } catch {
      // Don't discard a possibly-paid order on a transient error — let them retry.
      setView('error');
    }
  }, [order.id]);

  // Defer out of the effect body (check() sets state synchronously).
  useEffect(() => { const id = setTimeout(check, 0); return () => clearTimeout(id); }, [check]);

  function dismiss() { onClose(); }
  function finish() { clearPendingOrder(); onClose(); }

  const pickupUrl = `${DOWNLOAD_BASE}/myqr/${order.trxCode}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="flex flex-col gap-4 p-6 rounded-3xl w-full max-w-sm text-center"
        style={{ background: '#fff', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-neutral-400)' }}>
            {t('recovery.title')}
          </span>
          <button
            onClick={dismiss}
            aria-label={t('common.close')}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)' }}
          >
            <X size={16} />
          </button>
        </div>

        {view === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="w-8 h-8 rounded-full border-4 animate-spin"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>{t('recovery.checking')}</p>
          </div>
        )}

        {view === 'paid' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
              <CheckCircle2 size={22} />
              <p className="text-lg font-black">{t('recovery.paidTitle')}</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>{t('recovery.paidDesc')}</p>
            <div className="p-3 rounded-2xl" style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary-100)' }}>
              <QRCodeSVG value={pickupUrl} size={180} level="H" fgColor="#013F65" />
            </div>
            <p className="font-mono text-xs break-all" style={{ color: 'var(--color-neutral-400)' }}>
              {t('recovery.code')}: {order.trxCode}
            </p>
            <Button onClick={finish} className="w-full">{t('recovery.done')}</Button>
          </div>
        )}

        {view === 'pending' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
              <Clock size={22} />
              <p className="text-lg font-black">{t('recovery.pendingTitle')}</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>{t('recovery.pendingDesc')}</p>
            <div className="flex gap-2 w-full">
              <Button variant="ghost" onClick={dismiss} className="flex-1">{t('recovery.dismiss')}</Button>
              <Button onClick={check} className="flex-1">{t('recovery.recheck')}</Button>
            </div>
          </div>
        )}

        {view === 'gone' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-neutral-500)' }}>
              <AlertTriangle size={22} />
              <p className="text-lg font-black">{t('recovery.goneTitle')}</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>{t('recovery.goneDesc')}</p>
            <Button onClick={finish} className="w-full">{t('recovery.done')}</Button>
          </div>
        )}

        {view === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={22} />
              <p className="text-sm font-semibold">{t('recovery.errorDesc')}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="ghost" onClick={dismiss} className="flex-1">{t('recovery.dismiss')}</Button>
              <Button onClick={check} className="flex-1">{t('recovery.recheck')}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
