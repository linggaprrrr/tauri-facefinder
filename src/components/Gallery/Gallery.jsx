import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, SearchX, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import PhotoCard from './PhotoCard';
import PhotoPreview from './PhotoPreview';
import Button from '../common/Button';

export default function Gallery() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { photos, selectedPhotos } = state;
  const ratioRequests = useRef(new Set());

  const outlets = useMemo(() => {
    const names = photos.map((p) => p.outlet_name).filter(Boolean);
    return ['All', ...Array.from(new Set(names))];
  }, [photos]);

  // Count photos per outlet for chip badges
  const outletCounts = useMemo(() => {
    const counts = { All: photos.length };
    photos.forEach((p) => {
      if (p.outlet_name) counts[p.outlet_name] = (counts[p.outlet_name] || 0) + 1;
    });
    return counts;
  }, [photos]);

  const [activeOutlet, setActiveOutlet] = useState('All');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoRatios, setPhotoRatios] = useState({});

  const visiblePhotos = useMemo(
    () => activeOutlet === 'All' ? photos : photos.filter((p) => p.outlet_name === activeOutlet),
    [photos, activeOutlet]
  );

  useEffect(() => {
    let cancelled = false;
    visiblePhotos.forEach((photo) => {
      if (photoRatios[photo.id] || !photo.thumbnail) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        setPhotoRatios((cur) => cur[photo.id] ? cur : { ...cur, [photo.id]: img.naturalWidth / img.naturalHeight });
      };
      img.src = photo.thumbnail;
    });
    return () => { cancelled = true; };
  }, [visiblePhotos, photoRatios]);

  function handleToggle(photo) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: photo });
  }

  function handleRatioChange(photoId, ratio) {
    if (!ratio) return;
    setPhotoRatios((cur) => cur[photoId] === ratio ? cur : { ...cur, [photoId]: ratio });
  }

  const totalPrice = selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  // Max 4 thumbnails shown in footer strip
  const STRIP_MAX = 4;
  const stripPhotos = selectedPhotos.slice(0, STRIP_MAX);
  const extraCount  = selectedPhotos.length - STRIP_MAX;

  return (
    <div className="flex flex-col h-full gap-4 max-w-8xl mx-auto w-full">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('gallery.title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-neutral-500)' }}>
            {t('gallery.subtitle', { count: photos.length })}
            {photos.length > 0 && (
              <span style={{ color: 'var(--color-neutral-400)' }}>
                {' '}— {t('gallery.tapHint')}
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> {t('gallery.rescan')}
        </Button>
      </div>

      {/* Outlet filter chips with photo count */}
      {outlets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0">
          {outlets.map((name) => {
            const isActive = activeOutlet === name;
            const count = outletCounts[name] ?? 0;
            const label = name === 'All' ? t('gallery.all') : name;
            return (
              <button
                key={name}
                onClick={() => setActiveOutlet(name)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-neutral-100)',
                  color:      isActive ? '#fff'                  : 'var(--color-neutral-700)',
                  border:     isActive ? '2px solid var(--color-primary)' : '2px solid var(--color-neutral-200)',
                  boxShadow:  isActive ? '0 2px 10px rgba(1,125,197,0.25)' : 'none',
                }}
              >
                {label}
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    minWidth: 18, height: 18, padding: '0 4px',
                    background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--color-neutral-200)',
                    color:      isActive ? '#fff'                    : 'var(--color-neutral-500)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {visiblePhotos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="festive-card flex flex-col items-center gap-4 text-center px-10 py-12 max-w-md">
            <div
              className="bob flex items-center justify-center w-24 h-24 rounded-full text-white"
              style={{ background: 'var(--gradient-accent)', boxShadow: 'var(--shadow-glow-accent)' }}
            >
              <SearchX size={44} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
              {t('gallery.emptyTitle')}
            </h2>
            <p className="text-base" style={{ color: 'var(--color-neutral-500)' }}>
              {t('gallery.emptyDesc')}
            </p>
            <Button size="lg" onClick={() => navigate('/')} className="mt-2">
              <ArrowLeft size={20} /> {t('gallery.rescan')}
            </Button>
          </div>
        </div>
      ) : (
        /* Masonry grid — restored original layout */
        <div className="gallery-masonry flex-1 overflow-y-auto pb-4 no-scrollbar">
          {visiblePhotos.map((photo) => {
            const orderIdx = selectedPhotos.findIndex((p) => p.id === photo.id);
            const isSelected = orderIdx !== -1;
            return (
              <PhotoCard
                key={photo.id}
                photo={photo}
                aspectRatio={photoRatios[photo.id]}
                selected={isSelected}
                selectionOrder={isSelected ? orderIdx + 1 : null}
                onPreview={setPreviewPhoto}
                onRatioChange={handleRatioChange}
                onToggle={handleToggle}
              />
            );
          })}
        </div>
      )}

      {/* Sticky footer — always visible */}
      <div
        className="shrink-0 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          background: '#fff',
          border: '1.5px solid var(--color-primary-100)',
          boxShadow: 'var(--shadow-lg)',
          minHeight: 68,
        }}
      >
        {selectedPhotos.length === 0 ? (
          /* Hint state — no selection yet.
             pl reserve clears the fixed WhatsApp button on desktop; none on mobile
             where the help FAB sits below the footer flow. */
          <p className="flex-1 text-sm font-medium pl-0 sm:pl-[148px]" style={{ color: 'var(--color-neutral-400)' }}>
            {t('gallery.footerEmpty')}
          </p>
        ) : (
          /* Thumbnail strip */
          <div className="flex items-center gap-2 flex-1 min-w-0 pl-0 sm:pl-[120px]">
            {stripPhotos.map((p) => (
              <div key={p.id} className="relative shrink-0 group">
                <img
                  src={p.thumbnail}
                  alt=""
                  className="rounded-lg object-cover"
                  style={{
                    width: 44, height: 33,
                    border: '2px solid var(--color-primary)',
                  }}
                />
                {/* × deselect button */}
                <button
                  onClick={() => handleToggle(p)}
                  aria-label={t('gallery.removeAria')}
                  className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: 16, height: 16,
                    background: 'var(--color-danger, #ef4444)',
                    color: '#fff',
                    border: '1.5px solid #fff',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <X size={8} strokeWidth={3} />
                </button>
              </div>
            ))}
            {extraCount > 0 && (
              <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-neutral-400)' }}>
                +{extraCount}
              </span>
            )}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {selectedPhotos.length > 0 && (
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-neutral-500)' }}>
                {t('gallery.selected', { count: selectedPhotos.length })}
              </p>
              <p className="text-lg font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {totalPrice.toLocaleString('id-ID')}
              </p>
            </div>
          )}
          <Button
            size="lg"
            onClick={() => navigate('/editor')}
            disabled={selectedPhotos.length === 0}
          >
            {t('gallery.continue')} <ArrowRight size={20} />
          </Button>
        </div>
      </div>

      {/* Preview modal */}
      {previewPhoto && (
        <PhotoPreview
          photo={previewPhoto}
          photos={visiblePhotos}
          selected={selectedPhotos.some((p) => p.id === previewPhoto.id)}
          onClose={() => setPreviewPhoto(null)}
          onNavigate={setPreviewPhoto}
          onToggleSelect={() => handleToggle(previewPhoto)}
        />
      )}
    </div>
  );
}
