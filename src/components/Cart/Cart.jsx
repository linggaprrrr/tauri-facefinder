import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingCart, Check, X, Maximize2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import Button from '../common/Button';

export default function Cart() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { selectedPhotos, photoEdits } = state;
  const total = selectedPhotos.reduce((sum, p) => sum + p.price, 0);
  const [preview, setPreview] = useState(null);       // { src, label } | null
  const [confirmRemove, setConfirmRemove] = useState(null); // photo pending removal | null

  function handleRemove(photoId) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: { id: photoId } });
    setConfirmRemove(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-2xl mx-auto w-full py-4 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          {t('cart.title')}
        </h1>
        <Button variant="ghost" onClick={() => navigate('/editor')}>
          <ArrowLeft size={18} /> {t('cart.editor')}
        </Button>
      </div>

      {selectedPhotos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-20 rounded-lg"
          style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-400)' }}
        >
          <ShoppingCart size={64} strokeWidth={1.5} />
          <p className="text-xl font-semibold">{t('cart.empty')}</p>
          <Button onClick={() => navigate('/gallery')}>{t('cart.browse')}</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {selectedPhotos.map((photo) => {
              const editedDataUrl = photoEdits[photo.id]?.dataUrl;
              const isFree = (photo.price ?? 0) === 0;
              const sourceLabel = photo.isAiGenerated
                ? t('cart.aiPhoto')
                : photo.isComposite
                  ? t('cart.framePhoto')
                  : t('cart.original');
              return (
                <div
                  key={photo.id}
                  className="flex items-start gap-4 p-4 rounded-lg"
                  style={{
                    background: '#fff',
                    border: '1.5px solid var(--color-neutral-200)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Thumbnails: original + edited side by side — tap to enlarge */}
                  <div className="flex gap-2 shrink-0">
                    {/* Original */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreview({ src: photo.url ?? photo.proxyUrl ?? photo.thumbnail, label: sourceLabel })}
                        className="relative group rounded-lg overflow-hidden transition-transform active:scale-95"
                        style={{ width: 80, height: 80, padding: 0, border: 'none', cursor: 'pointer' }}
                        aria-label={t('cart.previewAria')}
                      >
                        <img src={photo.thumbnail} alt={sourceLabel} className="w-full h-full object-cover" />
                        <span
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
                        >
                          <Maximize2 size={20} />
                        </span>
                      </button>
                      <span className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>{sourceLabel}</span>
                    </div>

                    {/* Edited result — only if user made edits */}
                    {editedDataUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreview({ src: editedDataUrl, label: t('cart.edited') })}
                          className="relative group rounded-lg overflow-hidden transition-transform active:scale-95"
                          style={{ width: 80, height: 80, padding: 0, border: 'none', cursor: 'pointer' }}
                          aria-label={t('cart.previewAria')}
                        >
                          <img src={editedDataUrl} alt={t('cart.edited')} className="w-full h-full object-cover" />
                          <span
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
                          >
                            <Maximize2 size={20} />
                          </span>
                        </button>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{t('cart.edited')}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold truncate"
                      style={{ color: 'var(--color-neutral-800)' }}
                    >
                      {photo.filename}
                    </p>
                    <p className="font-black text-lg" style={{ color: isFree ? 'var(--color-success, #16a34a)' : 'var(--color-primary)' }}>
                      {isFree ? t('cart.free') : `Rp ${photo.price.toLocaleString('id-ID')}`}
                    </p>
                    {editedDataUrl && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={3} /> {t('cart.withEdit')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all active:scale-90 shrink-0"
                    style={{
                      background: 'var(--color-error-bg)',
                      color: 'var(--color-error)',
                    }}
                    onClick={() => setConfirmRemove(photo)}
                    aria-label={t('cart.removeAria')}
                  >
                    <X size={18} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Price summary */}
          <div
            className="p-5 rounded-lg flex items-center justify-between"
            style={{
              background: 'var(--color-primary-50)',
              border: '2px solid var(--color-primary-100)',
            }}
          >
            <div>
              <p style={{ color: 'var(--color-neutral-600)' }}>
                {t('cart.photoCount', { count: selectedPhotos.length })}
              </p>
              <p className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {total.toLocaleString('id-ID')}
              </p>
            </div>
            <Button size="lg" onClick={() => navigate('/checkout')}>
              {t('cart.payNow')} <ArrowRight size={20} />
            </Button>
          </div>
        </>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="w-full rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: '#fff', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
              >
                <X size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="font-black text-lg leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
                  {t('cart.removeTitle')}
                </h2>
                <p className="text-sm truncate" style={{ color: 'var(--color-neutral-500)' }}>
                  {confirmRemove.filename}
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
              {t('cart.removeConfirm')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
              >
                {t('cart.removeCancel')}
              </button>
              <button
                onClick={() => handleRemove(confirmRemove.id)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                style={{ background: 'var(--color-error)', color: '#fff' }}
              >
                <X size={16} /> {t('cart.removeConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label={t('cart.close')}
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <X size={22} />
          </button>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={preview.src}
              alt={preview.label}
              style={{ maxWidth: 'min(92vw, 900px)', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            />
            <span className="text-sm font-semibold" style={{ color: '#fff' }}>{preview.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
