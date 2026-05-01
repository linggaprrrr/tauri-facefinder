import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../store/AppContext';
import Button from '../common/Button';

export default function Download() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { order } = state;

  if (!order) {
    navigate('/');
    return null;
  }

  function handleRestart() {
    dispatch({ type: 'RESET' });
    navigate('/');
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-lg mx-auto w-full py-12">
      {/* Success icon */}
     

      <div className="text-center">
        <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          Payment Successful!
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--color-neutral-500)' }}>
          Scan the QR code below to download your photos
        </p>
      </div>

      {/* QR card */}
      <div
        className="flex flex-col items-center gap-4 p-8 rounded-3xl w-full"
        style={{
          background: '#fff',
          boxShadow: 'var(--shadow-xl)',
          border: '2px solid var(--color-primary-100)',
        }}
      >
        {/* Branded QR frame */}
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary-100)' }}
        >
          <QRCodeSVG
            value={order.downloadUrl}
            size={240}
            level="H"
            fgColor="#013F65"
          />
        </div>

        <p className="font-mono text-xs" style={{ color: 'var(--color-neutral-400)' }}>
          {order.orderId}
        </p>

        {/* Validity note */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          <span>⏱</span> Valid for 24 hours
        </div>
      </div>

      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--color-neutral-400)' }}>
        Scan with any phone camera to download your photos directly.
      </p>

      <Button size="xl" onClick={handleRestart} className="w-64">
         Buat Transaksi Baru
      </Button>
    </div>
  );
}
