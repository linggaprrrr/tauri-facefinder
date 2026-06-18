import { useState, useRef, useEffect } from 'react';
import { X, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { aiTransform, ApiError } from '../../api/mockApi';

export default function AiTransformPreview({ template, currentPhoto, outletId, onApply, onDiscard }) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const beforeImg = template.before_url;
  const afterImg  = template.after_url;

  const onMoveRef = useRef(null);
  onMoveRef.current = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(98, Math.max(2, raw)));
  };

  useEffect(() => {
    const move = (e) => onMoveRef.current(e);
    const up   = ()  => { isDragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend',  up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend',  up);
    };
  }, []);

  async function handleApply() {
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const photoUrl = currentPhoto?.url ?? currentPhoto?.proxyUrl;
      const result = await aiTransform({
        outletId,
        photoUrl,
        templateId: template.id,
      });
      onApply(result.image_url);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.kind === 'rate_limit'
          ? t('ai.errorRateLimit')
          : t('ai.errorGeneric');
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={status === 'loading' ? undefined : onDiscard}
    >
      <div
        className="rounded-3xl overflow-hidden flex flex-col sm:flex-row w-full mx-3"
        style={{
          background: '#fff',
          maxWidth: 'min(840px, calc(100vw - 24px))',
          maxHeight: '90vh',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Before/after slider ── */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '56%',
            height: isMobile ? '42vh' : undefined,
            flexShrink: 0,
            display: 'flex',
            overflow: 'hidden',
            touchAction: 'none',
            userSelect: 'none',
            background: '#000',
          }}
          onMouseDown={() => { isDragging.current = true; }}
          onTouchStart={() => { isDragging.current = true; }}
        >
          {/* Before */}
          <div className="relative w-full h-full flex items-center justify-center">
            {beforeImg ? (
              <img
                src={beforeImg}
                alt="before"
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>{t('ai.before')}</div>
            )}
            <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, pointerEvents: 'none' }}>
              {t('ai.before')}
            </div>
          </div>

          {/* After */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              userSelect: 'none',
              willChange: 'clip-path',
              clipPath: `inset(0px 0px 0px ${sliderPos}%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {afterImg ? (
              <img
                src={afterImg}
                alt="after"
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>{t('ai.after')}</div>
            )}
            <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, pointerEvents: 'none' }}>
              {t('ai.after')}
            </div>
          </div>

          {/* Slider handle */}
          <div
            role="slider"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sliderPos)}
            style={{ position: 'absolute', top: 0, height: '100%', left: `${sliderPos}%`, transform: 'translate3d(-50%, 0, 0)', background: 'none', border: 0, padding: 0, pointerEvents: 'all', cursor: 'ew-resize', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onMouseDown={(e) => { e.stopPropagation(); isDragging.current = true; }}
            onTouchStart={(e) => { e.stopPropagation(); isDragging.current = true; }}
          >
            <div style={{ flexGrow: 1, width: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
            <div style={{ display: 'grid', gridAutoFlow: 'column', gap: 8, placeContent: 'center', flexShrink: 0, width: 48, height: 48, borderRadius: '50%', border: '2px solid #fff', backdropFilter: 'blur(7px)', background: 'rgba(0,0,0,0.18)', boxShadow: '0 0 4px rgba(0,0,0,0.35)', color: '#fff' }}>
              <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderRight: '9px solid #fff', borderBottom: '7px solid transparent' }} />
              <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderRight: '9px solid #fff', borderBottom: '7px solid transparent', transform: 'rotate(180deg)' }} />
            </div>
            <div style={{ flexGrow: 1, width: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
          </div>
        </div>

        {/* ── Info panel ── */}
        <div className="flex flex-col flex-1 min-h-0 p-6 gap-4 overflow-y-auto">
          {/* Close */}
          <div className="flex justify-end">
            <button
              onClick={status === 'loading' ? undefined : onDiscard}
              disabled={status === 'loading'}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Name + tag */}
          <div className="flex flex-col gap-2">
            <h2 className="font-black text-2xl leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
              {template.label}
            </h2>
            {template.tag && (
              <span
                className="text-sm font-bold px-3 py-1 rounded-full self-start"
                style={
                  template.tag_color
                    ? { background: template.tag_color.bg, color: template.tag_color.color }
                    : { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)' }
                }
              >
                {template.tag}
              </span>
            )}
          </div>

          {/* Loading state */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-medium text-center" style={{ color: 'var(--color-neutral-600)' }}>
                {t('ai.transforming')}
              </p>
              <p className="text-xs text-center" style={{ color: 'var(--color-neutral-400)' }}>
                {t('ai.transformingNote')}
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div
              className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <p className="text-xs leading-snug" style={{ color: '#991b1b' }}>{errorMsg}</p>
            </div>
          )}

          {/* Idle info note */}
          {status === 'idle' && (
            <div
              className="rounded-xl px-3 py-2.5 flex items-start gap-2 mt-auto"
              style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}
            >
              <Sparkles size={15} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs leading-snug" style={{ color: 'var(--color-primary)' }}>
                {t('ai.applyNote')}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={status === 'loading' ? undefined : onDiscard}
              disabled={status === 'loading'}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
            >
              <X size={15} /> {t('ai.closeBtn')}
            </button>
            <button
              onClick={status === 'error' ? handleApply : handleApply}
              disabled={status === 'loading'}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {status === 'loading' ? (
                <><Loader2 size={15} className="animate-spin" /> {t('ai.applying')}</>
              ) : status === 'error' ? (
                <><RefreshCw size={15} /> {t('ai.retryBtn')}</>
              ) : (
                <><Sparkles size={15} /> {t('ai.applyBtn')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
