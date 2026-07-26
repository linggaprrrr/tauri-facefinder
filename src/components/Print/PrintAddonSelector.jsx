import { useState, useEffect } from 'react';
import { Minus, Plus, ImagePlus } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import SlotPhotoPicker from '../Editor/SlotPhotoPicker';

// Checkout-time print add-on picker — simpler than the after-the-fact
// PrintModal on purpose: one shared copies count for the whole add-on
// (matches the backend's single TransactionPrintAddon row: one template
// version, one photo_ids list, one copies count). A collage template fills
// its slots exactly like PrintModal already does; a single-slot template
// prints ONE chosen cart photo, `copies` times. Printing several DIFFERENT
// photos independently, each with its own copy count, stays a PrintModal-only
// (post-payment) capability — this is a quick checkbox, not a full editor.
export default function PrintAddonSelector({ photos, templateVersion, printPrice, onSelectionChange }) {
  const { t } = useLang();
  const isCollage = templateVersion.slots?.length > 0;

  const [copies, setCopies] = useState(1);
  const [photoId, setPhotoId] = useState(photos.length === 1 ? photos[0].id : null);
  const [slotAssignments, setSlotAssignments] = useState(() => Array(templateVersion.slots?.length ?? 0).fill(null));
  const [activeSlot, setActiveSlot] = useState(null);

  const photoIds = isCollage
    ? slotAssignments.map((p) => p?.photo_id).filter(Boolean)
    : [photos.find((p) => p.id === photoId)?.photo_id].filter(Boolean);
  const slotsFilled = !isCollage || slotAssignments.every(Boolean);
  const totalPrice = copies * (printPrice ?? 0);
  const canSubmit = copies > 0 && slotsFilled && photoIds.length > 0;

  function emit(next) {
    const merged = { copies, photoIds, ...next };
    onSelectionChange?.({
      copies: merged.copies,
      photoIds: merged.photoIds,
      totalPrice: merged.copies * (printPrice ?? 0),
      canSubmit: merged.copies > 0 && merged.photoIds.length > 0 && (!isCollage || slotsFilled),
    });
  }

  // Report the initial selection once mounted — copies/photoId already have
  // sane defaults (1 copy; the lone cart photo if there's only one), so the
  // parent shouldn't have to wait for the customer to touch the stepper.
  useEffect(() => { emit({}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function adjustCopies(delta) {
    const next = Math.max(1, Math.min(20, copies + delta));
    setCopies(next);
    emit({ copies: next });
  }
  function assignSlot(photo) {
    const next = [...slotAssignments];
    next[activeSlot] = photo;
    setSlotAssignments(next);
    setActiveSlot(null);
    emit({ photoIds: next.map((p) => p?.photo_id).filter(Boolean) });
  }
  function pickPhoto(id) {
    setPhotoId(id);
    const photo = photos.find((p) => p.id === id);
    emit({ photoIds: photo ? [photo.photo_id] : [] });
  }

  return (
    <div className="flex flex-col gap-3">
      {isCollage ? (
        <>
          <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>{t('print.collageHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {templateVersion.slots.map((slot, i) => {
              const assigned = slotAssignments[i];
              return (
                <button
                  key={slot.id ?? i}
                  onClick={() => setActiveSlot(i)}
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    aspectRatio: (slot.w ?? 1) / (slot.h ?? 1),
                    border: assigned ? '2px solid var(--color-primary)' : '2px dashed var(--color-neutral-300)',
                  }}
                >
                  {assigned ? (
                    <img src={assigned.thumbnail} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ color: 'var(--color-neutral-400)' }}>
                      <ImagePlus size={20} />
                      <span className="text-xs font-medium">{t('print.slotN', { n: i + 1 })}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => pickPhoto(p.id)}
              className="shrink-0 rounded-xl overflow-hidden"
              style={{
                width: 56, height: 56,
                border: photoId === p.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              <img src={p.thumbnail} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      ) : null}

      {!canSubmit && (
        <p className="text-xs" style={{ color: 'var(--color-warning, #d97706)' }}>
          {isCollage ? t('print.fillAllSlots') : t('print.choosePhotoHint')}
        </p>
      )}

      <div className="flex items-center justify-between p-2 rounded-xl" style={{ border: '1.5px solid var(--color-neutral-200)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-neutral-700)' }}>{t('print.copies')}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => adjustCopies(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-neutral-100)' }}><Minus size={14} /></button>
          <span className="w-5 text-center font-bold text-sm">{copies}</span>
          <button onClick={() => adjustCopies(1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}><Plus size={14} /></button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-neutral-500)' }}>{t('print.perPrint')}: Rp {(printPrice ?? 0).toLocaleString('id-ID')}</span>
        <span className="font-bold" style={{ color: 'var(--color-primary)' }}>Rp {totalPrice.toLocaleString('id-ID')}</span>
      </div>

      {isCollage && activeSlot !== null && (
        <SlotPhotoPicker
          photos={photos}
          assignedPhotoIds={slotAssignments.filter(Boolean).map((p) => p.id)}
          slotIndex={activeSlot}
          onPick={assignSlot}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
