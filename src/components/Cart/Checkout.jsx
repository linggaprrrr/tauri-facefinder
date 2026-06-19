import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, QrCode, Smartphone, AlertTriangle } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { createTransaction, getTransaction, cancelTransaction } from '../../api/mockApi';
import { savePendingOrder, updatePendingOrder, clearPendingOrder } from '../../utils/pendingOrder';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';

const POLL_INTERVAL_MS = 3000;

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Checkout() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();

  // 'idle' | 'creating' | 'waiting' | 'error'
  const [status, setStatus] = useState('idle');
  const [transaction, setTransaction] = useState(null);
  const [countdown, setCountdown] = useState(300);
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
  const { deviceConfig } = state;

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
    setCountdown(300);
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
      });
      setTransaction(trx);
      // Persist immediately — before payment — so even a crash mid-payment
      // leaves a recoverable trx_code (pickup is retrievable from any device).
      savePendingOrder({
        id: trx.id,
        trxCode: trx.trx_code,
        total,
        photos: state.selectedPhotos.map((p) => ({
          id: p.id, photo_id: p.photo_id, filename: p.filename, price: p.price, thumbnail: p.thumbnail,
        })),
      });
      const dueSeconds = (trx.payment_due_minutes ?? 5) * 60;
      setCountdown(dueSeconds);
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
      setCountdown(remaining);
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

  const countdownColor = countdown <= 60
    ? 'var(--color-error)'
    : countdown <= 120
      ? 'var(--color-warning)'
      : 'var(--color-primary)';

  return (
    <div className="flex flex-col items-center gap-8 max-w-3xl mx-auto w-full py-8">

      {/* ── Idle: summary + pay button ── */}
      {status === 'idle' && (
        <div className="flex flex-col gap-5 w-full max-w-md">
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
              {t('checkout.confirmTitle')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>
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
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ background: 'var(--color-primary-50)' }}
            >
              <span className="font-bold" style={{ color: 'var(--color-neutral-800)' }}>{t('common.total')}</span>
              <span className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {total.toLocaleString('id-ID')}
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

          {/* Left: QR Code card */}
          <div
            className="flex flex-col items-center gap-4 p-6 rounded-3xl shrink-0 w-full sm:w-auto sm:min-w-[300px]"
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

            {/* QR Code */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: 'var(--color-neutral-50)', border: '1.5px solid var(--color-neutral-200)' }}
            >
              <QRCodeSVG
                value={transaction.payment_url}
                size={220}
                level="H"
                fgColor="#013F65"
              />
            </div>

            {/* Countdown */}
            <div className="flex flex-col items-center gap-1 w-full">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-neutral-400)' }}>
                {t('checkout.dueLabel')}
              </p>
              <div
                className="text-4xl font-black font-mono tabular-nums"
                style={{ color: countdownColor, transition: 'color 0.5s' }}
              >
                {formatCountdown(countdown)}
              </div>
              {/* Progress bar */}
              <div
                className="w-full rounded-full overflow-hidden mt-1"
                style={{ height: 6, background: 'var(--color-neutral-200)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(countdown / ((transaction.payment_due_minutes ?? 5) * 60)) * 100}%`,
                    background: countdownColor,
                    transition: 'width 1s linear, background 0.5s',
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: 'var(--color-neutral-500)' }}>
              {t('checkout.scanInstr')}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full">
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
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-neutral-400)' }}>
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
                  Rp {total.toLocaleString('id-ID')}
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                <Smartphone size={24} />
              </div>
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
              <p className="text-sm mt-2" style={{ color: 'var(--color-neutral-500)' }}>
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
