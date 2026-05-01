import { useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../hooks/useCamera';
import { useApp } from '../../store/AppContext';
import { scanFace } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import FaceOverlay from './FaceOverlay';

const VIDEO_CONSTRAINTS = { width: 640, height: 480, facingMode: 'user' };

export default function FaceScan() {
  const { webcamRef, capture } = useCamera();
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | scanning | error

  const handleCapture = useCallback(async () => {
    const image = capture();
    if (!image) return;
    setStatus('scanning');
    dispatch({ type: 'SET_CAPTURED_FACE', payload: image });
    try {
      const result = await scanFace(image);
      dispatch({ type: 'SET_PHOTOS', payload: result.photos });
      navigate('/gallery');
    } catch {
      setStatus('error');
    }
  }, [capture, dispatch, navigate]);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto py-10">
      {/* Page heading */}
      <div className="text-center">
        <h1
          className="text-4xl font-black"
          style={{ color: 'var(--color-neutral-900)' }}
        >
          Find Your Photos
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--color-neutral-600)' }}>
          Position your face inside the oval and tap <strong>Scan</strong>
        </p>
      </div>

      {/* Camera / loading area */}
      {status === 'scanning' ? (
        <div
          className="w-[640px] h-[480px] flex items-center justify-center rounded-3xl"
          style={{ background: 'var(--color-primary-50)' }}
        >
          <LoadingSpinner message="Scanning your face…" />
        </div>
      ) : (
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            boxShadow: 'var(--shadow-xl)',
            border: '3px solid var(--color-primary-100)',
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
          Something went wrong. Please try again.
        </p>
      )}

      {/* Primary CTA */}
      <Button
        size="lg"
        onClick={handleCapture}
        disabled={status === 'scanning'}
        className="w-72"
      >
        {status === 'scanning' ? 'Scanning…' : 'Scan My Face'}
      </Button>

      <p className="text-sm" style={{ color: 'var(--color-neutral-400)' }}>
        No data is stored — scans are used only to find your photos
      </p>
    </div>
  );
}
