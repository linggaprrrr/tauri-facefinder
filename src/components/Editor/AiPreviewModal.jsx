import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Wand2 } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Preview modal shown when customer taps "Buat dengan AI".
 * Displays the template's sample before/after images so the customer can
 * decide whether to spend their free quota, then confirms the generation.
 */
export default function AiPreviewModal({ template, onConfirm, onClose }) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const move = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const raw = ((clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.min(98, Math.max(2, raw)));
    };
    const up = () => { isDragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, []);

  const hasSample = !!(template?.before_url && template?.after_url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl overflow-hidden flex flex-col w-full mx-3"
        style={{
          background: '#fff',
          maxWidth: hasSample ? 'min(960px, calc(100vw - 48px))' : 420,
          maxHeight: '92vh',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          flexDirection: isMobile || !hasSample ? 'column' : 'row',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Before/after slider (sample images from the template) ── */}
        {hasSample && (
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width: isMobile ? '100%' : '60%',
              height: isMobile ? '40vh' : 'min(72vh, 600px)',
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
              <img
                src={template.before_url}
                alt="before"
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              />
              <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, pointerEvents: 'none' }}>
                {t('ai.before')}
              </div>
            </div>

            {/* After */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                userSelect: 'none', willChange: 'clip-path',
                clipPath: `inset(0px 0px 0px ${sliderPos}%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <img
                src={template.after_url}
                alt="after"
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              />
              <div style={{ position: 'absolute', top: 14, right: 14, background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={12} /> {t('ai.after')}
              </div>
            </div>

            {/* Slider handle */}
            <div
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
        )}

        {/* ── Info panel ── */}
        <div className="flex flex-col flex-1 min-h-0 p-6 gap-4 overflow-y-auto">
          {/* Close */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              <Sparkles size={15} /> {t('ai.previewTitle')}
            </div>
            <h2 className="font-black text-2xl leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
              {template?.label}
            </h2>
          </div>

          {!hasSample && (
            <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
              {t('ai.noSampleNote')}
            </p>
          )}

          <div
            className="rounded-xl px-3 py-2.5 flex items-start gap-2 mt-auto"
            style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}
          >
            <Sparkles size={15} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs leading-snug" style={{ color: 'var(--color-primary)' }}>
              {t('ai.previewNote')}
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={onConfirm}
              className="py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              <Wand2 size={16} /> {t('ai.confirmGenerate')}
            </button>
            <button
              onClick={onClose}
              className="py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
            >
              {t('ai.cancelGenerate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
