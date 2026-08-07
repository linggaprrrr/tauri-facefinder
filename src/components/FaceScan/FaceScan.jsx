import { useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, ShieldCheck, Lightbulb } from 'lucide-react';
import { StepFaceCamera, StepInsideOval, StepSmile } from './ScanStepArt';
import { useCamera } from '../../hooks/useCamera';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { scanFace } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import FaceOverlay from './FaceOverlay';

// ponytail: `ideal`, and no facingMode — a USB webcam has no front/back and
// exact 640x480 makes it OverconstrainedError instead of just picking a size.
//
// 720p rather than 480p: paired with forceScreenshotSourceSize below, this is
// what the face search actually receives, and 3x the pixels on a face is the
// cheapest available improvement to match reliability. Still `ideal`, so a
// camera that cannot do 720p negotiates its own closest mode instead of
// failing — the Windows USB-webcam case fixed in 1db27bc stays safe.
//
// Note the stream is 16:9 while the preview box below is 4:3, so the preview
// is a centre crop and the capture is *wider* than what the customer sees. A
// centred face is always inside both; it only means the frame carries a little
// more of the room than the oval implies.
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 } };

const STEPS = [
  { Art: StepFaceCamera, key: 'scan.step1' },
  { Art: StepInsideOval, key: 'scan.step2' },
  { Art: StepSmile,      key: 'scan.step3' },
];

const TIPS = ['scan.tip1', 'scan.tip2', 'scan.tip3', 'scan.tip4'];

export default function FaceScan() {
  const { webcamRef, capture } = useCamera();
  const { dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | scanning | error
  const [errorKey, setErrorKey] = useState('scan.error');
  const [cameraReady, setCameraReady] = useState(false);
  // Raw getUserMedia error name (NotAllowedError / NotReadableError / …). The
  // translated line alone can't tell "permission" from "another app has the cam".
  const [errorDetail, setErrorDetail] = useState('');

  const handleCapture = useCallback(async () => {
    const image = capture();
    if (!image) {
      // Webcam hasn't produced a frame yet (no camera, permission denied, or not ready).
      setErrorDetail('');
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
    /* Three columns only from xl. Below that the guidance stacks under the
       camera at full width rather than being squeezed into a narrow rail —
       the columns need real width now that the type is sized for the 50–70cm
       viewing distance the tips themselves ask for. */
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-8 grid gap-5 xl:gap-8 xl:grid-cols-[18rem_minmax(0,1fr)_18rem] items-start">

      {/* ── Left: how to scan + tips ──
          Two cards side by side while stacked, one above the other once the
          rail exists. */}
      <aside className="order-2 xl:order-1 w-full grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="card p-5 flex flex-col gap-4">
          <h2 className="text-h3 font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('scan.howTitle')}
          </h2>
          {STEPS.map(({ Art, key }, i) => (
            <div key={key} className="flex items-center gap-3">
              <span className="shrink-0" style={{ width: 60, height: 60 }}>
                <Art />
              </span>
              <p className="text-base font-semibold leading-snug" style={{ color: 'var(--color-neutral-800)' }}>
                <span style={{ color: 'var(--color-primary)' }}>{i + 1}.</span> {t(key)}
              </p>
            </div>
          ))}
        </div>

        <div
          className="p-5 rounded-xl flex flex-col gap-2.5"
          style={{ background: 'var(--color-accent-50)', border: '1.5px solid var(--color-accent-100)' }}
        >
          <h2 className="text-h3 font-black flex items-center gap-2" style={{ color: 'var(--color-neutral-900)' }}>
            <Lightbulb size={20} /> {t('scan.tipsTitle')}
          </h2>
          {TIPS.map((key) => (
            <p key={key} className="text-base flex items-start gap-2 leading-snug" style={{ color: 'var(--color-neutral-800)' }}>
              <Check size={18} strokeWidth={3} className="shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} />
              {t(key)}
            </p>
          ))}
        </div>
      </aside>

      {/* ── Center: heading, camera, CTA ── */}
      <div className="order-1 xl:order-2 flex flex-col items-center gap-5 w-full min-w-0">
        <div className="text-center">
          <h1 className="text-3xl sm:text-display font-black text-gradient-brand pb-1">
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
              // Capture at the camera's own resolution, not the element's.
              // react-webcam defaults to `video.clientWidth` for the canvas, so
              // without this the face sent to search is only as detailed as the
              // video happens to be *laid out* — a narrower column silently
              // produced a smaller image, a weaker embedding, and a similarity
              // score that drifted across the backend's threshold. It also
              // caches that canvas on first capture, so the size was decided
              // once per session by whatever the layout measured at that moment.
              forceScreenshotSourceSize
              videoConstraints={VIDEO_CONSTRAINTS}
              className="block w-full h-full object-cover"
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={(err) => {
                console.error('getUserMedia failed:', err);
                setCameraReady(false);
                setErrorDetail(err?.name || String(err));
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
            {errorDetail && <span className="block text-xs font-normal opacity-70">{errorDetail}</span>}
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
      </div>

      {/* ── Right: what happens next ── */}
      <aside className="order-3 w-full grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="card p-5 flex flex-col gap-2.5">
          <span
            className="flex items-center justify-center rounded-xl"
            style={{ width: 48, height: 48, background: 'var(--color-accent-50)', color: 'var(--color-accent-700)' }}
          >
            <Zap size={24} />
          </span>
          <h2 className="text-h3 font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('scan.benefitFastTitle')}
          </h2>
          <p className="text-base leading-snug" style={{ color: 'var(--color-neutral-700)' }}>
            {t('scan.benefitFastDesc')}
          </p>
        </div>

        <div className="card p-5 flex flex-col gap-2.5">
          <span
            className="flex items-center justify-center rounded-xl"
            style={{ width: 48, height: 48, background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
          >
            <ShieldCheck size={24} />
          </span>
          <h2 className="text-h3 font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('scan.benefitPrivacyTitle')}
          </h2>
          {/* Reuses the existing privacy line rather than writing a new one —
              this is a claim about data handling, not marketing copy to vary. */}
          <p className="text-base leading-snug" style={{ color: 'var(--color-neutral-700)' }}>
            {t('scan.privacy')}
          </p>
        </div>
      </aside>
    </div>
  );
}
