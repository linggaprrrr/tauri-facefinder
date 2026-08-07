import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode, Smartphone, AlertTriangle, Printer } from 'lucide-react';
import { useApp } from '../../../../store/AppContext';
import { useLang } from '../../../../i18n/LanguageContext';
import { createTransaction, getTransaction, cancelTransaction } from '../../../../api/mockApi';
import { savePendingOrder, updatePendingOrder, clearPendingOrder } from '../../../../utils/pendingOrder';
import LoadingSpinner from '../../../common/LoadingSpinner';
import Button from '../../../common/Button';

const POLL_INTERVAL_MS = 3000;

// Extracted from Checkout.jsx verbatim (Phase A of the Access Method
// redesign) — this IS today's whole checkout flow for the zero-props case.
// "Skip the chooser" means skip the access-method card grid, not this
// screen: the order-summary-then-pay step below is QRIS's own confirm step,
// not the chooser, and must render identically to preserve today's behavior
// for every outlet that only has QRIS enabled (i.e. all of them, today).
//
// promoCode/discountAmount (Phase B): a Promo Voucher that only partially
// covers the cart chains here for the remainder (ScanRunner's 'discounted'
// outcome) — discountAmount is a client-side estimate for display only, the
// server recomputes and applies the real discount when the transaction is
// created (same as the existing, previously-unwired promo_code contract).
export default function QrisRunner({ promoCode, discountAmount = 0 } = {}) {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();

  // 'idle' | 'creating' | 'waiting' | 'error'
  const [status, setStatus] = useState('idle');
  const [transaction, setTransaction] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  // null | 'back' | 'cancel-only'
  const [confirmMode, setConfirmMode] = useState(null);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  // Keep refs in sync for unmount cleanup
  const transactionRef = useRef(null);
  const statusRef = useRef('idle');

  useEffect(() => { transactionRef.current = transaction; }, [transaction]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const total = state.selectedPhotos.reduce((sum, p) => sum + p.price, 0);
  const { deviceConfig, printItems } = state;

  // Decided back on the Cart screen — this screen just confirms + folds it
  // into the same payment, it's not an editable control here.
  const billableItems = printItems.filter((item) => item.canSubmit);
  const addonEstimate = billableItems.reduce((sum, item) => sum + item.totalPrice, 0);
  // Once a transaction exists, its server-computed final_price is authoritative
  // (it already folds in the print add-on server-side) — before that, this is
  // just a client-side estimate for the confirm screen, same as discountAmount.
  //
  // The print is discountable, so it belongs INSIDE the max(): added after it,
  // the way the server used to, the screen showed "diskon 100%" next to a total
  // that still charged full price for the print.
  const displayTotal = transaction ? transaction.final_price : Math.max(total + addonEstimate - discountAmount, 0);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  // On unmount, just stop polling — do NOT auto-cancel. Cancelling a 'waiting'
  // transaction races the payment: the customer may have paid moments earlier,
  // before the DOKU webhook lands. Abandoned transactions expire on DOKU's side,
  // and a persisted pendingOrder lets us recover a paid one on next launch.
  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  const handleCancel = useCallback(async (mode) => {
    setConfirmMode(null);
    stopPolling();
    const trxId = transactionRef.current?.id;
    setStatus('idle');
    setTransaction(null);
    setErrorMsg('');
    // Explicit user cancel → drop the recovery record too.
    clearPendingOrder();
    if (trxId) {
      try { await cancelTransaction(trxId); } catch { /* silent */ }
    }
    if (mode === 'back') navigate('/');
  }, [navigate]);

  async function handleQrisPay() {
    if (!deviceConfig.unit || !deviceConfig.outlet) {
      setErrorMsg(t('checkout.errNoConfig'));
      setStatus('error');
      return;
    }
    setStatus('creating');
    setErrorMsg('');
    try {
      // Attach each output's edited render (stickers/text/filter) so the customer
      // receives what they actually made. Collage/AI photos already carry their
      // render as original_path, but any decoration on top lives in photoEdits.
      const photosWithEdits = state.selectedPhotos.map((p) => ({
        ...p,
        edited_image: state.photoEdits[p.id]?.dataUrl ?? null,
      }));
      const trx = await createTransaction({
        outletId: deviceConfig.outlet.id,
        photos: photosWithEdits,
        promoCode,
        printItems,
      });
      setTransaction(trx);
      // Persist immediately — before payment — so even a crash mid-payment
      // leaves a recoverable trx_code (pickup is retrievable from any device).
      savePendingOrder({
        id: trx.id,
        trxCode: trx.trx_code,
        total: trx.final_price ?? total,
        photos: state.selectedPhotos.map((p) => ({
          id: p.id, photo_id: p.photo_id, filename: p.filename, price: p.price, thumbnail: p.thumbnail,
        })),
      });
      const dueSeconds = (trx.payment_due_minutes ?? 5) * 60;
      setStatus('waiting');
      startPolling(trx.id, dueSeconds);
    } catch (err) {
      setErrorMsg(t('checkout.errCreate', { msg: err.message }));
      setStatus('error');
    }
  }

  function startPolling(transactionId, dueSeconds) {
    // Poll for payment status
    pollRef.current = setInterval(async () => {
      try {
        const trx = await getTransaction(transactionId);
        if (trx.paid) {
          stopPolling();
          updatePendingOrder({ paid: true });
          dispatch({ type: 'SET_ORDER', payload: trx });
          navigate('/download');
        }
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS);

    // Countdown tick
    let remaining = dueSeconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      // No setCountdown any more — the visible timer was dropped once DOKU's
      // hosted page started showing its own. The call outlived the state and
      // threw every tick, which killed this interval's body before it could
      // reach the expiry branch: the payment never timed out and the pending
      // transaction was never cancelled.
      if (remaining <= 0) {
        stopPolling();
        setErrorMsg(t('checkout.errTimeout'));
        setStatus('error');
        if (transactionRef.current?.id) {
          cancelTransaction(transactionRef.current.id).catch(() => {});
        }
      }
    }, 1000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'creating') {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message={t('checkout.creating')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-6xl mx-auto w-full py-8">

      {/* ── Idle: summary + pay button ── */}
      {status === 'idle' && (
        <div className="flex flex-col gap-5 w-full max-w-md">
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
              {t('checkout.confirmTitle')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-600)' }}>
              {t('checkout.photosSelected', { count: state.selectedPhotos.length })}
            </p>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', border: '1.5px solid var(--color-neutral-200)', boxShadow: 'var(--shadow-sm)' }}
          >
            {state.selectedPhotos.map((photo, i) => (
              <div
                key={photo.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-sm truncate" style={{ color: 'var(--color-neutral-700)' }}>
                    {photo.filename ?? t('common.photoN', { n: i + 1 })}
                  </span>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-3" style={{ color: 'var(--color-neutral-800)' }}>
                  Rp {photo.price.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
            {/* Itemised, not just announced by the pill below: at Rp 100 photo
                − Rp 100 voucher = Rp 200 total, an unlisted print makes the
                screen look like it is overcharging. */}
            {billableItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                  >
                    <Printer size={14} />
                  </div>
                  <span className="text-sm truncate" style={{ color: 'var(--color-neutral-700)' }}>
                    {t(item.printType === 'secondary' ? 'print.typeSecondary' : 'print.typePrimary')}
                    {' · '}{t('download.printItem', { n: item.copies })}
                  </span>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-3" style={{ color: 'var(--color-neutral-800)' }}>
                  Rp {item.totalPrice.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>{t('scan.discountApplied')}</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                  - Rp {discountAmount.toLocaleString('id-ID')}
                </span>
              </div>
            )}
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ background: 'var(--color-primary-50)' }}
            >
              <span className="font-bold" style={{ color: 'var(--color-neutral-800)' }}>{t('common.total')}</span>
              <span className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {displayTotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <Button size="lg" onClick={handleQrisPay} className="w-full">
            <QrCode size={20} /> {t('checkout.payQris')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/cart')} className="w-full">
            <ArrowLeft size={18} /> {t('checkout.backToCart')}
          </Button>
        </div>
      )}

      {/* ── QRIS Payment Screen ── */}
      {status === 'waiting' && transaction && (
        <div className="flex flex-col sm:flex-row gap-6 w-full items-stretch sm:items-start">

          {/* Left: DOKU payment gateway card — sized to be the focal point;
              DOKU's own hosted page already shows its payment countdown, so
              we don't duplicate one here. */}
          <div
            className="flex flex-col items-center gap-4 p-6 rounded-3xl shrink-0 w-full sm:w-auto"
            style={{
              background: '#fff',
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--color-primary-100)',
            }}
          >
            {/* QRIS badge */}
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-full text-xs font-black tracking-widest"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                QRIS
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
              >
                <span className="animate-pulse">●</span> {t('checkout.waiting')}
              </div>
            </div>

            {/* DOKU's hosted checkout page, embedded — it has the actual QRIS
                QR (payment_url is a checkout-link page, not a QRIS payload,
                so rendering it as our own QR code isn't scannable by e-wallet
                "scan QRIS" flows; embedding skips that dead end entirely). */}
            <iframe
              src={transaction.payment_url}
              title="DOKU QRIS"
              className="rounded-2xl"
              style={{ width: 620, height: 640, maxWidth: '100%', border: '1.5px solid var(--color-neutral-200)' }}
            />

            <p className="text-xs text-center" style={{ color: 'var(--color-neutral-600)' }}>
              {t('checkout.scanInstr')}
            </p>
          </div>

          {/* Right: Order summary */}
          <div
            className="flex-1 flex flex-col rounded-3xl overflow-hidden"
            style={{
              background: '#fff',
              boxShadow: 'var(--shadow-lg)',
              border: '1.5px solid var(--color-neutral-100)',
            }}
          >
            <div className="px-6 py-4" style={{ background: 'var(--color-primary)', color: '#fff' }}>
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest mb-1">{t('checkout.trxCode')}</p>
              <p className="font-mono font-black text-lg">{transaction.trx_code}</p>
            </div>

            <div className="px-6 pt-4 flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-neutral-600)' }}>
                {t('checkout.orderDetails')}
              </p>
              {state.selectedPhotos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-sm truncate" style={{ color: 'var(--color-neutral-700)' }}>
                      {photo.filename ?? t('common.photoN', { n: i + 1 })}
                    </span>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-3" style={{ color: 'var(--color-neutral-800)' }}>
                    Rp {photo.price.toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="mx-6 my-5 p-4 rounded-2xl flex items-center justify-between"
              style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary-100)' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary-400)' }}>
                  {t('checkout.totalPayment')}
                </p>
                <p className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                  Rp {displayTotal.toLocaleString('id-ID')}
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                <Smartphone size={24} />
              </div>
            </div>

            <div className="flex flex-col gap-2 px-6 pb-6">
              <button
                onClick={() => setConfirmMode('back')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--color-neutral-100)',
                  color: 'var(--color-neutral-600)',
                  border: '1.5px solid var(--color-neutral-200)',
                }}
              >
                <ArrowLeft size={16} /> {t('checkout.backCancel')}
              </button>
              <button
                onClick={() => setConfirmMode('cancel-only')}
                className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)' }}
              >
                {t('checkout.cancelTrx')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm cancel modal ── */}
      {confirmMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="flex flex-col gap-5 p-8 rounded-3xl w-full max-w-sm mx-4 text-center"
            style={{ background: '#fff', boxShadow: 'var(--shadow-xl)' }}
          >
            <div className="flex justify-center" style={{ color: 'var(--color-warning)' }}>
              <AlertTriangle size={40} />
            </div>
            <div>
              <p className="text-lg font-black" style={{ color: 'var(--color-neutral-900)' }}>
                {t('checkout.cancelTitle')}
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--color-neutral-600)' }}>
                {confirmMode === 'back'
                  ? t('checkout.cancelBackMsg')
                  : t('checkout.cancelOnlyMsg')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmMode(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: 'var(--color-neutral-100)',
                  color: 'var(--color-neutral-700)',
                  border: '1.5px solid var(--color-neutral-200)',
                }}
              >
                {t('checkout.continuePay')}
              </button>
              <button
                onClick={() => handleCancel(confirmMode)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}
              >
                {t('checkout.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <div
            className="flex flex-col items-center gap-3 w-full px-6 py-5 rounded-2xl text-center"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}
          >
            <AlertTriangle size={30} />
            <p className="font-semibold">{errorMsg || t('checkout.genericError')}</p>
          </div>
          <Button onClick={() => { setStatus('idle'); setErrorMsg(''); }} className="w-full">
            {t('common.retry')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/cart')} className="w-full">
            <ArrowLeft size={18} /> {t('checkout.backToCart')}
          </Button>
        </div>
      )}
    </div>
  );
}
