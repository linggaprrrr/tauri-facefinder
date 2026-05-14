import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PhotoCard from './PhotoCard';
import PhotoPreview from './PhotoPreview';
import Button from '../common/Button';

export default function Gallery() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { photos, selectedPhotos } = state;
  const ratioRequests = useRef(new Set());

  const configuredOutlet = state.deviceConfig?.outlet?.name ?? null;

  const basePhotos = useMemo(
    () => configuredOutlet ? photos.filter((p) => p.outlet_name === configuredOutlet) : photos,
    [photos, configuredOutlet]
  );

  const outlets = useMemo(() => {
    const names = basePhotos.map((p) => p.outlet_name).filter(Boolean);
    return ['All', ...Array.from(new Set(names))];
  }, [basePhotos]);

  const [activeOutlet, setActiveOutlet] = useState('All');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoRatios, setPhotoRatios] = useState({});

  const visiblePhotos = useMemo(
    () => activeOutlet === 'All' ? basePhotos : basePhotos.filter((p) => p.outlet_name === activeOutlet),
    [basePhotos, activeOutlet]
  );

  useEffect(() => {
    let cancelled = false;

    visiblePhotos.forEach((photo) => {
      if (photoRatios[photo.id] || ratioRequests.current.has(photo.id) || !photo.thumbnail) {
        return;
      }

      ratioRequests.current.add(photo.id);

      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        ratioRequests.current.delete(photo.id);
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;

        setPhotoRatios((current) => {
          if (current[photo.id]) return current;
          return {
            ...current,
            [photo.id]: img.naturalWidth / img.naturalHeight,
          };
        });
      };
      img.onerror = () => {
        ratioRequests.current.delete(photo.id);
      };
      img.src = photo.thumbnail;
    });

    return () => {
      cancelled = true;
    };
  }, [visiblePhotos, photoRatios]);

  function handleToggle(photo) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: photo });
  }

  function handleRatioChange(photoId, ratio) {
    if (!ratio) return;

    setPhotoRatios((current) => {
      if (current[photoId] === ratio) return current;
      return { ...current, [photoId]: ratio };
    });
  }

  return (
    <div className="flex flex-col h-full gap-5 max-w-8xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
            Your Photos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-neutral-500)' }}>
            {basePhotos.length} photos found — tap to preview and select
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>← Rescan</Button>
      </div>

      {/* Outlet sub-tabs */}
      {outlets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {outlets.map((name) => (
            <button
              key={name}
              onClick={() => setActiveOutlet(name)}
              className="shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: activeOutlet === name ? 'var(--color-primary)' : 'var(--color-neutral-100)',
                color: activeOutlet === name ? '#fff' : 'var(--color-neutral-700)',
                border: activeOutlet === name
                  ? '2px solid var(--color-primary)'
                  : '2px solid var(--color-neutral-200)',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Photo masonry */}
      <div className="gallery-masonry flex-1 overflow-y-auto pb-4 no-scrollbar">
        {visiblePhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            aspectRatio={photoRatios[photo.id]}
            selected={selectedPhotos.some((p) => p.id === photo.id)}
            onPreview={setPreviewPhoto}
            onRatioChange={handleRatioChange}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Sticky footer bar — only when photos are selected */}
      {selectedPhotos.length > 0 && (
        <div
          className="sticky bottom-0 p-4 flex items-center justify-between rounded-lg"
          style={{
            background: '#fff',
            border: '2px solid var(--color-primary-100)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <p className="font-bold" style={{ color: 'var(--color-neutral-800)' }}>
            {selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''} selected
          </p>
          <Button size="lg" onClick={() => navigate('/download')}>
            Download →
          </Button>
        </div>
      )}

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
