import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Ticket, Percent } from 'lucide-react';
import { useApp } from '../../../../store/AppContext';
import { useLang } from '../../../../i18n/LanguageContext';
import { validateAccessMethod, grantAccess } from '../../../../api/mockApi';
import LoadingSpinner from '../../../common/LoadingSpinner';
import Button from '../../../common/Button';

// Shared by Event Ticket and Promo Voucher — same scan/type → validate →
// outcome shape for both, only the copy and reason-code map differ (a ticket
// is all-or-nothing; a voucher can also come back 'discounted' and chain
// into QrisRunner for the remainder). A HID keyboard-wedge scanner needs no
// special handling here: it just "types" into whichever field has focus, so
// one autofocused text input serves both scanning and manual entry.
const VOUCHER_REASONS = {
  invalid: 'error.voucherInvalid',
  inactive: 'error.voucherInvalid',
  not_started: 'error.voucherNotStarted',
  expired: 'error.voucherExpired',
  redeemed: 'error.voucherRedeemed',
  unavailable: 'error.methodUnavailable',
  network: 'error.offline',
};

const TICKET_REASONS = {
  invalid: 'error.ticketInvalid',
  used: 'error.ticketUsed',
  expired: 'error.ticketExpired',
  not_started: 'error.ticketNotStarted',
  wrong_event: 'error.ticketWrongEvent',
  unavailable: 'error.methodUnavailable',
  verification_unavailable: 'error.methodUnavailable',
  network: 'error.offline',
};

export default function ScanRunner({ method, onChainToQris, onBack }) {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const isTicket = method.key === 'event_ticket';
  const reasonKeys = isTicket ? TICKET_REASONS : VOUCHER_REASONS;
  const Icon = isTicket ? Ticket : Percent;

  const [code, setCode] = useState('');
  const [status, setStatus] = useState('arm'); // arm | checking | granting | rejected
  const [rejectReason, setRejectReason] = useState(null);
  const inputRef = useRef(null);

  const { deviceConfig, selectedPhotos, photoEdits, printItems } = state;
  // The print add-on counts toward the amount a voucher has to cover: a grant
  // covers the whole order, prints included. Validating against photos alone
  // let a Rp 100 voucher report "fully covers" a Rp 300 cart and take the grant
  // path, which then dropped the paid print instead of chaining to QRIS for the
  // remainder.
  const addonTotal = printItems.reduce((sum, item) => sum + (item.canSubmit ? item.totalPrice : 0), 0);
  const total = selectedPhotos.reduce((sum, p) => sum + p.price, 0) + addonTotal;

  useEffect(() => {
    if (status === 'arm' || status === 'rejected') inputRef.current?.focus();
  }, [status]);

  async function submitCode(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || status === 'checking' || status === 'granting') return;
    setStatus('checking');
    try {
      const result = await validateAccessMethod({
        outletId: deviceConfig.outlet.id,
        methodKey: method.key,
        code: trimmed,
        orderAmount: total,
      });

      if (result.outcome === 'rejected') {
        setRejectReason(result.reason ?? 'invalid');
        setStatus('rejected');
        return;
      }

      if (result.outcome === 'discounted') {
        onChainToQris({ promoCode: result.promo_code, discountAmount: result.discount_amount });
        return;
      }

      // 'granted' — a ticket, or a voucher that fully covers the order.
      setStatus('granting');
      const photosWithEdits = selectedPhotos.map((p) => ({
        ...p,
        edited_image: photoEdits[p.id]?.dataUrl ?? null,
      }));
      const order = await grantAccess({
        outletId: deviceConfig.outlet.id,
        methodKey: method.key,
        code: trimmed,
        photos: photosWithEdits,
        printItems,
      });
      dispatch({ type: 'SET_ORDER', payload: order });
      navigate('/download');
    } catch {
      setRejectReason('network');
      setStatus('rejected');
    }
  }

  function retry() {
    setCode('');
    setRejectReason(null);
    setStatus('arm');
  }

  const title = method.title_override ?? t(method.titleKey);

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto w-full py-10">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
      >
        <Icon size={28} />
      </div>
      <h1 className="text-xl font-black text-center" style={{ color: 'var(--color-neutral-900)' }}>{title}</h1>

      {(status === 'arm' || status === 'checking') && (
        <form onSubmit={submitCode} className="flex flex-col gap-4 w-full">
          <p className="text-sm text-center" style={{ color: 'var(--color-neutral-500)' }}>
            {isTicket ? t('scan.armTicket') : t('scan.armVoucher')}
          </p>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={status === 'checking'}
            placeholder={isTicket ? t('scan.codePlaceholderTicket') : t('scan.codePlaceholderVoucher')}
            className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-wider outline-none"
            style={{ border: '1.5px solid var(--color-neutral-200)' }}
            autoFocus
          />
          {status === 'checking' ? (
            <div className="py-2"><LoadingSpinner message={isTicket ? t('scan.checkingTicket') : t('scan.checkingVoucher')} /></div>
          ) : (
            <Button type="submit" size="lg" disabled={!code.trim()} className="w-full">
              {t('scan.submit')}
            </Button>
          )}
        </form>
      )}

      {status === 'granting' && (
        <div className="py-6"><LoadingSpinner message={isTicket ? t('scan.ticketOkDesc') : t('scan.voucherGranting')} /></div>
      )}

      {status === 'rejected' && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div
            className="w-full px-5 py-4 rounded-2xl text-center"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}
          >
            <p className="font-semibold">{t(reasonKeys[rejectReason] ?? 'error.generic')}</p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={onBack} className="flex-1">
              {t('scan.tryAnother')}
            </Button>
            <Button onClick={retry} className="flex-1">
              <RefreshCw size={16} /> {t('scan.retry')}
            </Button>
          </div>
        </div>
      )}

      {status !== 'rejected' && (
        /* A real button, like the cart's back control: as faint centred text
           this read as a caption, leaving a customer who picked the wrong
           method with nothing that looked pressable. */
        <button
          onClick={onBack}
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
          <ArrowLeft size={18} /> {t('scan.tryAnother')}
        </button>
      )}
    </div>
  );
}
