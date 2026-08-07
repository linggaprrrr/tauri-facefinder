import { useState, useEffect } from 'react';
import { Minus, Plus, ImagePlus } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import { useApp } from '../../store/AppContext';
import SlotPhotoPicker from '../Editor/SlotPhotoPicker';

// Slot thumbnails are a fixed size rather than a fraction of the column: the
// cart column is wide on a kiosk, and a proportional slot turned one print line
// into a full screen of scrolling. maxHeight catches tall/portrait slot ratios.
const SLOT_W = 88;
const SLOT_MAX_H = 132;

// Checkout-time print add-on picker — deliberately simple: one shared copies
// count for the whole add-on (matches the backend's single
// TransactionPrintAddon row: one template version, one photo_ids list, one
// copies count). A collage template fills its slots; a single-slot template
// prints ONE chosen cart photo, `copies` times. Printing is decided here,
// once, folded into the same checkout payment — there is no separate
// post-payment print purchase, so a customer never faces a second charge
// just to print.
export default function PrintAddonSelector({ photos, templateVersion, printPrice, initial, onSelectionChange }) {
  const { t } = useLang();
  const { state } = useApp();
  const isCollage = templateVersion.slots?.length > 0;

  // Seeded from the selection already in the store, because this component is
  // remounted every time the customer comes back to the cart from payment.
  // Starting from defaults didn't merely forget the choice — the effect below
  // fires on mount and pushed those defaults over it, so stepping back and
  // forward silently emptied a print the customer had already configured.
  // An edited photo is a second printable version of the same cart item, not a
  // replacement for it — the customer may well want the clean copy on paper and
  // keep the sticker for their phone. So every choice here is a (photo, source)
  // pair rather than a photo id, and both versions are offered wherever a photo
  // is picked. 'edited' stays the default when an edit exists: that is what the
  // printer produced before this existed.
  const editedOf = (photo) => state.photoEdits[photo.id]?.dataUrl ?? null;
  const defaultSource = (photo) => (editedOf(photo) ? 'edited' : 'original');
  const previewOf = (pick) => (pick.source === 'edited' ? editedOf(pick.photo) : null) ?? pick.photo.thumbnail;

  const byPhotoId = (pid) => photos.find((p) => p.photo_id === pid) ?? null;
  // photo_ids alone can't say which version was chosen (the same id covers
  // both), so the restore leans on the sources map saved alongside them.
  const restorePick = (i) => {
    const photo = byPhotoId(initial?.photoIds?.[i]);
    if (!photo) return null;
    const source = initial?.sources?.[photo.photo_id] ?? defaultSource(photo);
    // An edit cleared since then can't be printed — fall back rather than
    // holding a selection that resolves to nothing.
    return { photo, source: source === 'edited' && !editedOf(photo) ? 'original' : source };
  };

  const [copies, setCopies] = useState(initial?.copies ?? 1);
  const [single, setSingle] = useState(
    () => restorePick(0) ?? (photos.length === 1 ? { photo: photos[0], source: defaultSource(photos[0]) } : null)
  );
  const [slotAssignments, setSlotAssignments] = useState(
    // Positional: photoIds is ordered by slot index, same as the backend
    // stores it. A photo dropped from the cart since then restores as an
    // empty slot rather than shifting every later slot up one.
    () => Array(templateVersion.slots?.length ?? 0).fill(null).map((_, i) => restorePick(i))
  );
  const [activeSlot, setActiveSlot] = useState(null);

  // Every printable version in the cart, flattened: an edited photo yields two.
  const variants = photos.flatMap((photo) => (
    editedOf(photo)
      ? [{ photo, source: 'edited' }, { photo, source: 'original' }]
      : [{ photo, source: 'original' }]
  ));

  const picks = isCollage ? slotAssignments.filter(Boolean) : [single].filter(Boolean);
  const photoIds = picks.map((pick) => pick.photo.photo_id);
  // Keyed by photo_id because that is all the transaction carries — the same
  // photo can't be printed as both versions in one add-on, which keeps this
  // map unambiguous where an array would have to stay index-aligned.
  const sources = Object.fromEntries(picks.map((pick) => [pick.photo.photo_id, pick.source]));
  const slotsFilled = !isCollage || slotAssignments.every(Boolean);
  const totalPrice = copies * (printPrice ?? 0);
  const canSubmit = copies > 0 && slotsFilled && photoIds.length > 0;

  // Reported from the derived values, not hand-assembled at each call site.
  // The previous version passed a patch into emit() and merged it with the
  // `photoIds` captured in that render's closure — so selecting a photo emitted
  // the list from *before* the selection, leaving canSubmit false. The row
  // showed its price while the cart total ignored it, because the total only
  // counts an add-on the selector says is submittable.
  //
  // Driving it from an effect means the parent always sees what is actually on
  // screen, and no future call site can reintroduce the same staleness.
  const sourcesKey = JSON.stringify(sources);
  useEffect(() => {
    onSelectionChange?.({ copies, photoIds, sources, totalPrice, canSubmit });
    // photoIds/sources are rebuilt every render, so both are compared by value.
  }, [copies, photoIds.join(','), sourcesKey, totalPrice, canSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  function adjustCopies(delta) {
    const next = Math.max(1, Math.min(20, copies + delta));
    setCopies(next);
  }
  function assignSlot(pick) {
    const next = [...slotAssignments];
    next[activeSlot] = pick;
    setSlotAssignments(next);
    setActiveSlot(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {isCollage ? (
        <>
          {/* Only while something is still missing — repeated on every line, an
              always-on instruction is just noise once the slots are filled. */}
          {!slotsFilled && (
            <p className="text-xs" style={{ color: 'var(--color-neutral-600)' }}>{t('print.collageHint')}</p>
          )}
          {/* Fixed-width thumbnails in a wrapping row, NOT a stretching grid.
              As `grid-cols-2` each slot grew to half the cart column, so a
              single-slot template rendered a preview taller than the viewport
              and two print lines became an endless scroll. */}
          <div className="flex flex-wrap gap-2">
            {templateVersion.slots.map((slot, i) => {
              const assigned = slotAssignments[i];
              return (
                <button
                  key={slot.id ?? i}
                  onClick={() => setActiveSlot(i)}
                  className="relative rounded-xl overflow-hidden shrink-0 cursor-pointer transition-all active:scale-95"
                  style={{
                    width: SLOT_W,
                    aspectRatio: (slot.w ?? 1) / (slot.h ?? 1),
                    maxHeight: SLOT_MAX_H,
                    border: assigned ? '2px solid var(--color-primary)' : '2px dashed var(--color-neutral-300)',
                  }}
                >
                  {assigned ? (
                    <>
                      <img src={previewOf(assigned)} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                      <span
                        className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                        style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      >
                        {t(assigned.source === 'edited' ? 'cart.edited' : 'cart.original')}
                      </span>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ color: 'var(--color-neutral-600)' }}>
                      <ImagePlus size={20} />
                      <span className="text-xs font-medium">{t('print.slotN', { n: i + 1 })}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : variants.length > 1 ? (
        // One tile per printable version, not per photo: a single edited photo
        // still offers two choices, which is why this no longer hides itself
        // when the cart holds only one item.
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {variants.map((v) => {
            const active = single?.photo.id === v.photo.id && single?.source === v.source;
            return (
              <button
                key={`${v.photo.id}:${v.source}`}
                onClick={() => setSingle(v)}
                className="shrink-0 rounded-xl overflow-hidden relative"
                style={{
                  width: 64, height: 64,
                  border: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                }}
              >
                <img src={previewOf(v)} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                <span
                  className="absolute bottom-0 inset-x-0 text-[9px] font-bold py-0.5"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                >
                  {t(v.source === 'edited' ? 'cart.edited' : 'cart.original')}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!canSubmit && (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {isCollage ? t('print.fillAllSlots') : t('print.choosePhotoHint')}
        </p>
      )}

      {/* Copies and money on one row. They were two stacked blocks, which cost a
          whole extra row per print line for six words and a number. */}
      <div
        className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl"
        style={{ border: '1.5px solid var(--color-neutral-200)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-neutral-700)' }}>
            {t('print.copies')}
          </span>
          {/* 36px, up from 28 — these are the only controls on this row a
              finger has to hit accurately. */}
          <button
            onClick={() => adjustCopies(-1)}
            aria-label={t('print.copiesLess')}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center font-black tabular-nums">{copies}</span>
          <button
            onClick={() => adjustCopies(1)}
            aria-label={t('print.copiesMore')}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
            style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="text-right shrink-0 leading-tight">
          <span className="block text-[11px]" style={{ color: 'var(--color-neutral-600)' }}>
            {t('print.perPrint')}: Rp {(printPrice ?? 0).toLocaleString('id-ID')}
          </span>
          <span className="block font-black" style={{ color: 'var(--color-primary)' }}>
            Rp {totalPrice.toLocaleString('id-ID')}
          </span>
        </div>
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
