import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import ownizeLogo from '../../assets/ownize_logo.png';
import Button from '../common/Button';

async function downloadPhotoUrl(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objUrl);
}

export default function Download() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { selectedPhotos } = state;
  const [downloading, setDownloading] = useState({});

  if (!selectedPhotos.length) {
    navigate('/');
    return null;
  }

  function handleRestart() {
    dispatch({ type: 'RESET' });
    navigate('/');
  }

  async function handleDownload(photo, index) {
    setDownloading((d) => ({ ...d, [photo.id]: true }));
    try {
      const filename = photo.filename ?? `foto_${index + 1}.jpg`;
      await downloadPhotoUrl(photo.url, filename);
    } finally {
      setDownloading((d) => ({ ...d, [photo.id]: false }));
    }
  }

  async function handleDownloadAll() {
    for (let i = 0; i < selectedPhotos.length; i++) {
      await handleDownload(selectedPhotos[i], i);
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto py-8">

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <img src={ownizeLogo} alt="Ownize" className="w-10 h-10 object-contain" />
          <span className="font-black text-2xl" style={{ color: 'var(--color-primary)' }}>
            Ownize Face Finder
          </span>
        </div>
        <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          Foto Anda Siap!
        </h1>
        <p className="mt-1 text-base" style={{ color: 'var(--color-neutral-500)' }}>
          {selectedPhotos.length} foto dipilih — klik tombol untuk mengunduh
        </p>
      </div>

      {/* Photo list */}
      <div
        className="w-full rounded-3xl overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: 'var(--shadow-xl)',
          border: '2px solid var(--color-neutral-100)',
        }}
      >
        <div className="flex flex-col">
          {selectedPhotos.map((photo, i) => (
            <div
              key={photo.id}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: i < selectedPhotos.length - 1 ? '1px solid var(--color-neutral-100)' : 'none' }}
            >
              <img
                src={photo.thumbnail ?? photo.url}
                alt=""
                className="rounded-xl object-cover shrink-0"
                style={{ width: 72, height: 56 }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-neutral-800)' }}
                  title={photo.filename}
                >
                  {photo.filename ?? `Foto ${i + 1}`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-neutral-400)' }}>
                  {photo.outlet_name ?? ''}
                </p>
              </div>
              <button
                disabled={downloading[photo.id]}
                onClick={() => handleDownload(photo, i)}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
              >
                {downloading[photo.id] ? '...' : '⬇ Unduh'}
              </button>
            </div>
          ))}
        </div>

        {/* Download all */}
        {selectedPhotos.length > 1 && (
          <div className="px-6 py-4" style={{ borderTop: '2px solid var(--color-neutral-100)' }}>
            <button
              onClick={handleDownloadAll}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              ⬇ Unduh Semua ({selectedPhotos.length} foto)
            </button>
          </div>
        )}
      </div>

      <Button size="xl" onClick={handleRestart} className="w-full max-w-xs">
        Scan Baru
      </Button>
    </div>
  );
}
