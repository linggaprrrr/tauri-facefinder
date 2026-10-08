import { useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, ScanFace, ArrowRight } from 'lucide-react';
import { StepFaceCamera, StepInsideOval, StepSmile } from './ScanStepArt';
import { useCamera } from '../../hooks/useCamera';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { scanFace } from '../../api/mockApi';
import LoadingSpinner from '../common/LoadingSpinner';
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

  const canScan = status !== 'scanning' && cameraReady;

  return (
    /* Theme-park layout: camera card, one big "Scan my face" button, then the
       three steps. Portrait stacks them; a landscape kiosk puts the steps in a
       rail beside the camera so nothing has to scroll. */
    <div className="w-full max-w-4xl mx-auto grid gap-5 sm:gap-6 xl:landscape:max-w-7xl xl:landscape:grid-cols-[minmax(0,1fr)_24rem] items-start">

      {/* Capped on a landscape kiosk: at full column width the 4:3 camera is
          taller than a 1080px screen leaves, pushing the Scan button below the
          fold. Portrait has the height, so it stays full width there. */}
      <div className="flex flex-col gap-5 min-w-0 w-full xl:landscape:max-w-[700px] xl:landscape:justify-self-center">
        {/* Camera card */}
        <div className="card p-2.5 sm:p-3" style={{ borderRadius: '2rem' }}>
          {status === 'scanning' ? (
            <div
              className="w-full aspect-[4/3] flex items-center justify-center rounded-3xl"
              style={{ background: 'var(--color-primary-50)' }}
            >
              <LoadingSpinner message={t('scan.scanningFace')} />
            </div>
          ) : (
            <div className="relative rounded-3xl overflow-hidden w-full aspect-[4/3]" style={{ background: 'var(--color-neutral-800)' }}>
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
              {cameraReady && (
                <span
                  className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-black tracking-wide text-white"
                  style={{ background: 'rgba(14,31,77,0.55)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                  {t('scan.live')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error feedback */}
        {status === 'error' && (
          <p
            className="font-semibold px-4 py-3 rounded-xl text-center"
            style={{
              color: 'var(--color-error)',
              background: 'var(--color-error-bg)',
            }}
          >
            {t(errorKey)}
            {errorDetail && <span className="block text-xs font-normal opacity-70">{errorDetail}</span>}
          </p>
        )}

        {/* Primary CTA — the whole pill is the button. We DON'T hard-disable on
            a missed heartbeat (that would falsely block the kiosk's main action
            on a transient blip); instead the attempt surfaces a clear
            'reconnecting' message on a real network error, and the offline
            banner already signals connectivity. */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={!canScan}
          className="card flex items-center gap-3 sm:gap-5 w-full rounded-full p-2 sm:p-3 text-left transition-transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ borderRadius: 9999, boxShadow: canScan ? 'var(--shadow-glow-primary)' : 'var(--shadow-sm)', border: '2px solid var(--color-primary-200)' }}
        >
          <span className="raised-tile hidden sm:flex shrink-0 items-center justify-center rounded-full w-20 h-20" style={{ color: 'var(--color-neutral-900)' }}>
            <ScanFace size={40} strokeWidth={1.8} />
          </span>
          <span className="flex-1 min-w-0 pl-3 sm:pl-0">
            <span className="block text-xl sm:text-h2 font-black leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
              {status === 'scanning' ? t('scan.scanning') : t('scan.cta')}
            </span>
            <span className="block text-sm sm:text-lg" style={{ color: 'var(--color-neutral-700)' }}>{t('scan.ctaSub')}</span>
          </span>
          <span
            className="flex shrink-0 items-center justify-center rounded-full w-14 h-14 sm:w-20 sm:h-20 text-white"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
          >
            <ArrowRight size={34} strokeWidth={2.6} />
          </span>
        </button>

        {/* Reuses the existing privacy line rather than writing a new one —
            this is a claim about data handling, not marketing copy to vary. */}
        <p className="flex items-center justify-center gap-2 text-sm text-center" style={{ color: 'var(--color-neutral-700)' }}>
          <ShieldCheck size={18} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
          {t('scan.privacy')}
        </p>
      </div>

      {/* How to scan: numbered steps, with the tips as chips underneath. */}
      <section className="card p-5 sm:p-6 flex flex-col gap-5">
        <h2 className="text-h3 font-black" style={{ color: 'var(--color-neutral-900)' }}>
          {t('scan.howTitle')}
        </h2>
        <ol className="grid grid-cols-3 xl:landscape:grid-cols-1 gap-3 sm:gap-4">
          {STEPS.map(({ Art, key }, i) => (
            <li key={key} className="flex flex-col xl:landscape:flex-row items-center gap-3 text-center xl:landscape:text-left">
              <span className="relative raised-tile flex items-center justify-center rounded-3xl shrink-0 w-24 h-24">
                <span className="w-16 h-16"><Art /></span>
                <span
                  className="absolute -top-2 -left-2 flex items-center justify-center rounded-full w-8 h-8 text-sm font-black text-white"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  {i + 1}
                </span>
              </span>
              <span className="text-base sm:text-lg font-bold leading-snug" style={{ color: 'var(--color-neutral-900)' }}>
                {t(key)}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-1" aria-label={t('scan.tipsTitle')}>
          {TIPS.map((key) => (
            <span
              key={key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: 'var(--color-accent-50)', color: 'var(--color-neutral-800)', border: '1px solid var(--color-accent-100)' }}
            >
              <Check size={16} strokeWidth={3} style={{ color: 'var(--color-success)' }} />
              {t(key)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
