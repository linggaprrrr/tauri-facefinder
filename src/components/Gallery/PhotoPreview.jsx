import { useEffect, useCallback } from 'react';
import { usePhotoCache } from '../../hooks/usePhotoCache';

export default function PhotoPreview({ photo, photos, onClose, onNavigate, selected, onToggleSelect }) {
  const cachedUrl = usePhotoCache(photo.url ?? photo.thumbnail);
  const currentIndex = photos.findIndex((p) => p.id === photo.id);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(photos[currentIndex - 1]);
  }, [currentIndex, photos, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(photos[currentIndex + 1]);
  }, [currentIndex, photos, onNavigate]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      {/* Modal panel — stop propagation so inner clicks don't close */}
      <div
        className="relative flex flex-col rounded-lg overflow-hidden"
        style={{
          maxWidth: '80vw',
          maxHeight: '88vh',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          background: '#111',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all hover:scale-110"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
          onClick={onClose}
        >
          ✕
        </button>

        {/* Label badge */}
        {photo.label && (
          <span
            className="absolute top-3 left-3 z-10 text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'var(--color-accent)', color: 'var(--color-neutral-900)' }}
          >
            {photo.label}
          </span>
        )}

        {/* Image */}
        <img
          src={photo.url ?? photo.thumbnail}
          alt="Preview"
          className="block object-contain"
          style={{ maxHeight: '72vh', maxWidth: '80vw' }}
        />

        {/* Bottom bar */}
        <div
          className="flex items-center justify-between px-5 py-4 gap-4"
          style={{ background: '#1a1a1a' }}
        >
          {/* Outlet + price */}
          <div>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {photo.outlet_name}
            </p>
            <p className="text-base font-black" style={{ color: '#fff' }}>
              Rp {photo.price.toLocaleString('id-ID')}
            </p>
          </div>

          {/* Counter */}
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {currentIndex + 1} / {photos.length}
          </p>

          {/* Select button */}
          <button
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: selected ? 'var(--color-primary)' : 'var(--color-accent)',
              color: selected ? '#fff' : 'var(--color-neutral-900)',
            }}
            onClick={onToggleSelect}
          >
            {selected ? '✓ Selected' : '+ Select'}
          </button>
        </div>
      </div>

      {/* Prev arrow */}
      {currentIndex > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          ‹
        </button>
      )}

      {/* Next arrow */}
      {currentIndex < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          ›
        </button>
      )}
    </div>
  );
}
