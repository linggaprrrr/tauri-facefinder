import { useLang } from '../../i18n/LanguageContext';
import { useApp } from '../../store/AppContext';
import Modal from '../common/Modal';

export default function SlotPhotoPicker({ photos, assignedPhotoIds, slotIndex, onPick, onClose }) {
  const { t } = useLang();
  const { state } = useApp();
  // Both printable versions of every photo. An edit doesn't replace the
  // original — the customer may want the clean copy on paper and keep the
  // sticker for their phone — so each gets its own tile, previewing exactly
  // what that choice puts on the paper.
  const editedOf = (photo) => state.photoEdits[photo.id]?.dataUrl ?? null;
  const variants = photos.flatMap((photo) => (
    editedOf(photo)
      ? [{ photo, source: 'edited' }, { photo, source: 'original' }]
      : [{ photo, source: 'original' }]
  ));
  return (
    <Modal title={t('picker.title', { n: slotIndex + 1 })} onClose={onClose} size="md">
        <div className="p-4 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            {variants.map(({ photo, source }) => {
              const isUsed = assignedPhotoIds.includes(photo.id);
              const edited = editedOf(photo);
              return (
                <button
                  key={`${photo.id}:${source}`}
                  onClick={() => onPick({ photo, source })}
                  className="relative rounded-xl overflow-hidden transition-all active:scale-95"
                  style={{
                    aspectRatio: '1',
                    outline: isUsed ? '2px solid #7c3aed' : '2px solid transparent',
                    opacity: isUsed ? 0.6 : 1,
                  }}
                >
                  <img
                    src={source === 'edited' ? edited : photo.url}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: 'cover' }}
                  />
                  {!isUsed && (
                    <span
                      className="absolute bottom-0 inset-x-0 text-[10px] font-bold py-0.5"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                    >
                      {t(source === 'edited' ? 'cart.edited' : 'cart.original')}
                    </span>
                  )}
                  {isUsed && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'rgba(124,58,237,0.45)' }}
                    >
                      {t('picker.used')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
    </Modal>
  );
}
