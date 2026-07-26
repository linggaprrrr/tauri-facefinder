import { useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../hooks/useCamera';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { scanFace } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import FaceOverlay from './FaceOverlay';

const VIDEO_CONSTRAINTS = { width: 640, height: 480, facingMode: 'user' };

export default function FaceScan() {
  const { webcamRef, capture } = useCamera();
  const { dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | scanning | error
  const [errorKey, setErrorKey] = useState('scan.error');
  const [cameraReady, setCameraReady] = useState(false);

  const handleCapture = useCallback(async () => {
    const image = capture();
    if (!image) {
      // Webcam hasn't produced a frame yet (no camera, permission denied, or not ready).
      setErrorKey('scan.cameraError');
      setStatus('error');
      return;
    }
    setStatus('scanning');
    dispatch({ type: 'SET_CAPTURED_FACE', payload: image });
    try {
      const result = await scanFace(image);
      dispatch({ type: 'SET_PHOTOS', payload: result.photos });
      navigate('/gallery');
    } catch (err) {
      console.error('scanFace failed:', err);
      // A dead link / timeout reads as "reconnecting", not "scan failed".
      const offlineKind = err?.kind === 'network' || err?.kind === 'timeout';
      setErrorKey(offlineKind ? 'scan.offline' : 'scan.error');
      setStatus('error');
    }
  }, [capture, dispatch, navigate]);

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-8 w-full max-w-2xl mx-auto py-4 sm:py-10">
      {/* Page heading */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-5xl font-black text-gradient-brand pb-1">
          {t('scan.title')}
        </h1>
        <p className="mt-2 text-base sm:text-lg" style={{ color: 'var(--color-neutral-600)' }}>
          {t('scan.positionPre')}<strong>{t('scan.action')}</strong>
        </p>
      </div>

      {/* Camera / loading area — responsive: fills width on phones, capped at
          640px on desktop, with a 4:3 box so it never overflows the viewport. */}
      {status === 'scanning' ? (
        <div
          className="w-full max-w-[640px] aspect-[4/3] flex items-center justify-center rounded-3xl"
          style={{ background: 'var(--color-primary-50)' }}
        >
          <LoadingSpinner message={t('scan.scanningFace')} />
        </div>
      ) : (
        <div
          className="relative rounded-3xl overflow-hidden w-full max-w-[640px] aspect-[4/3]"
          style={{
            boxShadow: 'var(--shadow-pop)',
            border: '4px solid #fff',
            outline: '3px solid var(--color-primary-200)',
          }}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={VIDEO_CONSTRAINTS}
            className="block w-full h-full object-cover"
            onUserMedia={() => setCameraReady(true)}
            onUserMediaError={() => {
              setCameraReady(false);
              setErrorKey('scan.cameraError');
              setStatus('error');
            }}
          />
          <FaceOverlay />
        </div>
      )}

      {/* Error feedback */}
      {status === 'error' && (
        <p
          className="font-semibold px-4 py-3 rounded-xl"
          style={{
            color: 'var(--color-error)',
            background: 'var(--color-error-bg)',
          }}
        >
          {t(errorKey)}
        </p>
      )}

      {/* Primary CTA. We DON'T hard-disable on a missed heartbeat (that would
          falsely block the kiosk's main action on a transient blip); instead the
          attempt surfaces a clear 'reconnecting' message on a real network error,
          and the offline banner already signals connectivity. */}
      <Button
        size="lg"
        onClick={handleCapture}
        disabled={status === 'scanning' || !cameraReady}
        className="w-full max-w-72"
      >
        {status === 'scanning' ? t('scan.scanning') : t('scan.cta')}
      </Button>

      <p className="text-sm" style={{ color: 'var(--color-neutral-400)' }}>
        {t('scan.privacy')}
      </p>
    </div>
  );
}
