import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../store/AppContext';
import { createTransaction, getTransaction } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';

const METHODS = [
  { id: 'qris', label: 'QRIS', sub: 'Scan QR untuk bayar', icon: '📱' },
  { id: 'cash', label: 'Cash', sub: 'Bayar di kasir', icon: '💵' },
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function Checkout() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [method, setMethod] = useState(null);
  // 'idle' | 'creating' | 'waiting' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [transaction, setTransaction] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pollRef = useRef(null);
  const timeoutRef = useRef(null);

  const total = state.selectedPhotos.reduce((sum, p) => sum + p.price, 0);
  const { deviceConfig } = state;

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleQrisPay() {
    if (!deviceConfig.unit || !deviceConfig.outlet) {
      setErrorMsg('Konfigurasi perangkat belum diatur. Buka Pengaturan terlebih dahulu.');
      setStatus('error');
      return;
    }
    setStatus('creating');
    setErrorMsg('');
    try {
      const trx = await createTransaction({
        outletId: deviceConfig.outlet.id,
        photos: state.selectedPhotos,
      });
      setTransaction(trx);
      setStatus('waiting');
      startPolling(trx.id);
    } catch {
      setErrorMsg('Gagal membuat transaksi. Coba lagi.');
      setStatus('error');
    }
  }

  function startPolling(transactionId) {
    pollRef.current = setInterval(async () => {
      try {
        const trx = await getTransaction(transactionId);
        if (trx.paid) {
          stopPolling();
          setTransaction(trx);
          dispatch({ type: 'SET_ORDER', payload: trx });
          setStatus('success');
          navigate('/download');
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setErrorMsg('Waktu pembayaran habis. Silakan coba lagi.');
      setStatus('error');
    }, POLL_TIMEOUT_MS);
  }

  function handleCashConfirm() {
    // Cash is handled manually at counter — just navigate forward
    dispatch({ type: 'SET_ORDER', payload: { cash: true, selectedPhotos: state.selectedPhotos, total } });
    navigate('/download');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === 'creating') {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message="Membuat transaksi…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-lg mx-auto w-full py-8">
      {/* Amount */}
      <div className="text-center">
        <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          Pilih Pembayaran
        </h1>
        <p className="text-4xl font-black mt-2" style={{ color: 'var(--color-primary)' }}>
          Rp {total.toLocaleString('id-ID')}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-neutral-500)' }}>
          {state.selectedPhotos.length} foto
        </p>
      </div>

      {/* Method cards — only shown when not waiting for payment */}
      {status !== 'waiting' && (
        <div className="flex gap-4 w-full">
          {METHODS.map(({ id, icon, label, sub }) => (
            <button
              key={id}
              className="flex-1 py-6 rounded-xl font-bold text-lg transition-all active:scale-97"
              style={{
                background: method === id ? 'var(--color-primary-50)' : '#fff',
                border: method === id
                  ? '2.5px solid var(--color-primary)'
                  : '2px solid var(--color-neutral-200)',
                color: method === id ? 'var(--color-primary)' : 'var(--color-neutral-700)',
                boxShadow: method === id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              }}
              onClick={() => { setMethod(id); setStatus('idle'); setErrorMsg(''); }}
            >
              <div className="text-3xl mb-1">{icon}</div>
              <div>{label}</div>
              <div className="text-sm font-normal mt-1" style={{ color: 'var(--color-neutral-500)' }}>
                {sub}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── QRIS panel ── */}
      {method === 'qris' && status === 'idle' && (
        <div
          className="flex flex-col items-center gap-4 p-6 rounded-2xl w-full"
          style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1.5px solid var(--color-neutral-100)' }}
        >
          <p className="text-sm text-center" style={{ color: 'var(--color-neutral-600)' }}>
            Klik tombol di bawah untuk membuat tagihan QRIS.
          </p>
          <Button size="lg" onClick={handleQrisPay} className="w-full">
            Bayar dengan QRIS →
          </Button>
        </div>
      )}

      {/* ── Waiting for QRIS payment ── */}
      {status === 'waiting' && transaction && (
        <div
          className="flex flex-col items-center gap-5 p-6 rounded-2xl w-full"
          style={{ background: '#fff', boxShadow: 'var(--shadow-xl)', border: '2px solid var(--color-primary-100)' }}
        >
          <p className="font-bold text-lg" style={{ color: 'var(--color-neutral-800)' }}>
            Scan QR untuk membayar
          </p>

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

          <div className="text-center">
            <p className="text-xs font-mono" style={{ color: 'var(--color-neutral-400)' }}>
              {transaction.trx_code}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-neutral-500)' }}>
              Total: <strong style={{ color: 'var(--color-primary)' }}>Rp {total.toLocaleString('id-ID')}</strong>
            </p>
          </div>

          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            <span className="animate-pulse">⏳</span> Menunggu pembayaran…
          </div>

          <button
            className="text-sm underline"
            style={{ color: 'var(--color-neutral-400)' }}
            onClick={() => { stopPolling(); setStatus('idle'); setTransaction(null); }}
          >
            Batalkan
          </button>
        </div>
      )}

      {/* ── Cash panel ── */}
      {method === 'cash' && status === 'idle' && (
        <div
          className="flex flex-col items-center gap-5 p-6 rounded-2xl w-full text-center"
          style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1.5px solid var(--color-neutral-100)' }}
        >
          <p className="text-lg font-medium" style={{ color: 'var(--color-neutral-700)' }}>
            Bayar{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              Rp {total.toLocaleString('id-ID')}
            </strong>{' '}
            di kasir, lalu tekan Konfirmasi.
          </p>
          <Button size="lg" onClick={handleCashConfirm} className="w-full">
            Konfirmasi Pembayaran ✓
          </Button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div
          className="flex flex-col items-center gap-3 w-full px-4 py-4 rounded-xl text-center"
          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
        >
          <p className="font-semibold">{errorMsg || 'Terjadi kesalahan.'}</p>
          <button
            className="text-sm underline font-medium"
            onClick={() => { setStatus('idle'); setErrorMsg(''); }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {status !== 'waiting' && (
        <Button variant="ghost" onClick={() => navigate('/cart')}>← Kembali ke Keranjang</Button>
      )}
    </div>
  );
}
