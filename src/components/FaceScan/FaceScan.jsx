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
      setErrorKey('scan.error');
      setStatus('error');
    }
  }, [capture, dispatch, navigate]);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto py-10">
      {/* Page heading */}
      <div className="text-center">
        <h1 className="text-5xl font-black text-gradient-brand pb-1">
          {t('scan.title')}
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--color-neutral-600)' }}>
          {t('scan.positionPre')}<strong>{t('scan.action')}</strong>
        </p>
      </div>

      {/* Camera / loading area */}
      {status === 'scanning' ? (
        <div
          className="w-[640px] h-[480px] flex items-center justify-center rounded-3xl"
          style={{ background: 'var(--color-primary-50)' }}
        >
          <LoadingSpinner message={t('scan.scanningFace')} />
        </div>
      ) : (
        <div
          className="relative rounded-3xl overflow-hidden"
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
            className="block"
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

      {/* Primary CTA */}
      <Button
        size="lg"
        onClick={handleCapture}
        disabled={status === 'scanning'}
        className="w-72"
      >
        {status === 'scanning' ? t('scan.scanning') : t('scan.cta')}
      </Button>

      <p className="text-sm" style={{ color: 'var(--color-neutral-400)' }}>
        {t('scan.privacy')}
      </p>
    </div>
  );
}
