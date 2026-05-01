import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../store/AppContext';
import { confirmPayment } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';

const QRIS_URL = 'https://example.com/qris/merchant-face-finder';

const METHODS = [
  { id: 'qris', icon: '', label: 'QRIS', sub: 'Scan QR to pay' },
  { id: 'cash', icon: '', label: 'Cash', sub: 'Pay at counter' },
];

export default function Checkout() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [method, setMethod] = useState(null);
  const [status, setStatus] = useState('idle');

  const total = state.selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  async function handleConfirm() {
    if (!method) return;
    setStatus('processing');
    try {
      const order = await confirmPayment({ method, photos: state.selectedPhotos });
      dispatch({ type: 'SET_ORDER', payload: order });
      navigate('/download');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message="Processing payment…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-lg mx-auto w-full py-8">
      {/* Amount */}
      <div className="text-center">
        <h1 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          Choose Payment
        </h1>
        <p
          className="text-4xl font-black mt-2"
          style={{ color: 'var(--color-primary)' }}
        >
          Rp {total.toLocaleString('id-ID')}
        </p>
      </div>

      {/* Method cards */}
      <div className="flex gap-4 w-full">
        {METHODS.map(({ id, icon, label, sub }) => (
          <button
            key={id}
            className="flex-1 py-6 rounded-lg font-bold text-lg transition-all active:scale-97"
            style={{
              background: method === id ? 'var(--color-primary-50)' : '#fff',
              border: method === id
                ? '2.5px solid var(--color-primary)'
                : '2px solid var(--color-neutral-200)',
              color: method === id ? 'var(--color-primary)' : 'var(--color-neutral-700)',
              boxShadow: method === id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            }}
            onClick={() => setMethod(id)}
          >
            <div className="text-3xl mb-1">{icon}</div>
            <div>{label}</div>
            <div className="text-sm font-normal mt-1" style={{ color: 'var(--color-neutral-500)' }}>
              {sub}
            </div>
          </button>
        ))}
      </div>

      {/* QRIS panel */}
      {method === 'qris' && (
        <div
          className="flex flex-col items-center gap-4 p-6 rounded-lg w-full"
          style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1.5px solid var(--color-neutral-100)' }}
        >
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'var(--color-neutral-50)', border: '1.5px solid var(--color-neutral-200)' }}
          >
            <QRCodeSVG
              value={QRIS_URL}
              size={200}
              level="H"
              fgColor="var(--color-primary-900)"
            />
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--color-neutral-500)' }}>
            Open your banking or e-wallet app and scan this QR code
          </p>
          <Button size="lg" onClick={handleConfirm} className="w-full">
            I've Paid ✓
          </Button>
        </div>
      )}

      {/* Cash panel */}
      {method === 'cash' && (
        <div
          className="flex flex-col items-center gap-5 p-6 rounded-lg w-full text-center"
          style={{ background: '#fff', boxShadow: 'var(--shadow-lg)', border: '1.5px solid var(--color-neutral-100)' }}
        >
          
          <p className="text-lg font-medium" style={{ color: 'var(--color-neutral-700)' }}>
            Please pay{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              Rp {total.toLocaleString('id-ID')}
            </strong>{' '}
            at the counter, then tap Confirm.
          </p>
          <Button size="lg" onClick={handleConfirm} className="w-full">
            Confirm Payment ✓
          </Button>
        </div>
      )}

      {status === 'error' && (
        <p
          className="font-semibold px-4 py-3 rounded-lg"
          style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)' }}
        >
          Payment failed. Please try again.
        </p>
      )}

      <Button variant="ghost" onClick={() => navigate('/cart')}>← Back to Cart</Button>
    </div>
  );
}
