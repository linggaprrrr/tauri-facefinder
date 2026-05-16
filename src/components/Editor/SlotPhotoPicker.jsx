export default function SlotPhotoPicker({ photos, assignedPhotoIds, slotIndex, onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#fff', width: 420, maxHeight: '80vh' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: '#7c3aed', color: '#fff' }}
        >
          <span className="font-bold text-base">Pilih Foto untuk Slot {slotIndex + 1}</span>
          <button
            onClick={onClose}
            className="text-white opacity-70 hover:opacity-100 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo) => {
              const isUsed = assignedPhotoIds.includes(photo.id);
              return (
                <button
                  key={photo.id}
                  onClick={() => onPick(photo)}
                  className="relative rounded-xl overflow-hidden transition-all active:scale-95"
                  style={{
                    aspectRatio: '1',
                    outline: isUsed ? '2px solid #7c3aed' : '2px solid transparent',
                    opacity: isUsed ? 0.6 : 1,
                  }}
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: 'cover' }}
                  />
                  {isUsed && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'rgba(124,58,237,0.45)' }}
                    >
                      Dipakai
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
