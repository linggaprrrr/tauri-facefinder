import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import Button from '../common/Button';

export default function Cart() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { selectedPhotos, photoEdits } = state;
  const total = selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  function handleRemove(photoId) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: { id: photoId } });
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
          Your Cart
        </h1>
        <Button variant="ghost" onClick={() => navigate('/editor')}>← Editor</Button>
      </div>

      {selectedPhotos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-20 rounded-lg"
          style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-400)' }}
        >
          <span className="text-6xl">🛒</span>
          <p className="text-xl font-semibold">Your cart is empty</p>
          <Button onClick={() => navigate('/gallery')}>Browse Photos</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {selectedPhotos.map((photo) => {
              const editedDataUrl = photoEdits[photo.id]?.dataUrl;
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
                  {/* Thumbnails: original + edited side by side */}
                  <div className="flex gap-2 shrink-0">
                    {/* Original */}
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={photo.thumbnail}
                        alt="Original"
                        className="rounded-lg object-cover"
                        style={{ width: 80, height: 80 }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>Original</span>
                    </div>

                    {/* Edited result — only if user made edits */}
                    {editedDataUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={editedDataUrl}
                          alt="Edited"
                          className="rounded-lg object-cover"
                          style={{ width: 80, height: 80 }}
                        />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Edited</span>
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
                    <p className="font-black text-lg" style={{ color: 'var(--color-primary)' }}>
                      Rp {photo.price.toLocaleString('id-ID')}
                    </p>
                    {editedDataUrl && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                      >
                        ✓ Dengan edit
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
                    onClick={() => handleRemove(photo.id)}
                    aria-label="Remove photo"
                  >
                    ✕
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
                {selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''}
              </p>
              <p className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {total.toLocaleString('id-ID')}
              </p>
            </div>
            <Button size="lg" onClick={() => navigate('/checkout')}>
              Pay Now →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
