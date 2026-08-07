import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingCart, Check, X, Plus, Minus, Printer, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { isTauri } from '../../native/print';
import { usePrintSetting } from '../../hooks/usePrintSetting';
import { usePrintTemplates } from '../../hooks/usePrintTemplates';
import { printAddonStatus } from '../../utils/printAddonStatus';
import { usePrinterHealth } from '../../hooks/usePrinterHealth';
import { getPrintStock } from '../../utils/heartbeat';
import PrintAddonSelector from '../Print/PrintAddonSelector';
import PrintFormatArt from '../Print/PrintFormatArt';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';

function SummaryRow({ label, value, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span style={{ color: 'var(--color-neutral-600)' }}>{label}</span>
      <span
        className={muted ? 'font-medium' : 'font-bold'}
        style={{ color: muted ? 'var(--color-neutral-600)' : 'var(--color-neutral-800)' }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Cart() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { selectedPhotos, photoEdits, deviceConfig, printItems } = state;
  const total = selectedPhotos.reduce((sum, p) => sum + p.price, 0);
  const [confirmRemove, setConfirmRemove] = useState(null); // photo pending removal | null

  // Print add-on — decided here so the total shown is the real total before
  // ever reaching checkout, folded into the same payment (no post-payment
  // "pay to print" upsell, see Download.jsx).
  const outletId = deviceConfig?.outlet?.id;
  const { setting: printSetting, loading: printSettingLoading } = usePrintSetting(outletId);
  const { printTemplates } = usePrintTemplates(outletId);

  // Two products: Primary (normal photo layout) and Secondary (photo strip).
  // Offerability lives in printAddonStatus, so the Settings screen can explain a
  // missing print option to staff using the very logic that hid it.
  // Checked at the cart, not at the last heartbeat: this is the moment the
  // kiosk decides whether to take money for a print.
  const printerHealth = usePrinterHealth(deviceConfig ?? {});
  const addonStatus = printAddonStatus({
    deviceConfig, printSetting, printSettingLoading, printTemplates,
    printerHealth, printStock: getPrintStock(),
  });

  // Both products are offerable side by side now — the exclusive Cetak Foto /
  // Strip Foto toggle existed only because the transaction could hold one
  // template. An order is a list of lines, so a 4R and a strip are just two of
  // them, and two prints of different photos are two more.
  const PRODUCTS = [
    { printType: 'primary', template: addonStatus.primary, labelKey: 'print.typePrimary' },
    { printType: 'secondary', template: addonStatus.secondary, labelKey: 'print.typeSecondary' },
  ].filter((p) => p.template?.currentVersion && p.template?.price);

  const canOfferPrintAddon = isTauri() && addonStatus.ok && PRODUCTS.length > 0;
  // Only submittable lines are billed: a half-configured line shows its price on
  // its own row but must not inflate the total the customer is about to pay.
  const addonEstimate = printItems.reduce((sum, item) => sum + (item.canSubmit ? item.totalPrice : 0), 0);

  // Summary counts, all derived from what is actually in the order. Rows render
  // only when non-zero — a breakdown padded with zeroes reads as boilerplate
  // and stops being checked.
  const aiCount        = selectedPhotos.filter((p) => p.isAiGenerated).length;
  const compositeCount = selectedPhotos.filter((p) => p.isComposite).length;
  const plainCount     = selectedPhotos.length - aiCount - compositeCount;
  const printCopies    = printItems.reduce((n, it) => n + (it.canSubmit ? (it.copies ?? 0) : 0), 0);

  function setItems(next) {
    dispatch({ type: 'SET_PRINT_ITEMS', payload: next });
  }
  // `photo` is optional. Added from a photo's own row it seeds that photo, so a
  // single-slot print is finished the moment it is created and the customer
  // never has to re-pick the picture they were already looking at. A collage
  // gets its first slot filled and still asks for the rest.
  //
  // Seeded in the shape PrintAddonSelector restores from: photoIds carries
  // `photo_id` (not the photo_face `id`), and `sources` is keyed by that same
  // photo_id — so a collage line still restores correctly when the selector
  // does mount for it.
  function addItem(printType, photo) {
    const product = PRODUCTS.find((p) => p.printType === printType);
    const price = product?.template?.price ?? 0;
    const slotCount = product?.template?.currentVersion?.slots?.length || 1;

    const seeded = photo
      ? {
          photoIds: [photo.photo_id],
          sources: { [photo.photo_id]: photoEdits[photo.id]?.dataUrl ? 'edited' : 'original' },
        }
      : { photoIds: [], sources: {} };

    // A single-slot print seeded from a photo row is finished the moment it is
    // created, so it has to be billable immediately — nothing else will run to
    // make it so. A collage has other slots left to fill and stays incomplete
    // until PrintAddonSelector reports otherwise.
    const complete = seeded.photoIds.length >= slotCount;

    setItems([...printItems, {
      // Stable identity for React keys and updates. Two lines can hold the same
      // template and the same photo — "two copies, printed separately" is a
      // legitimate order — so nothing about the contents identifies a line.
      id: crypto.randomUUID(),
      printType, copies: 1, ...seeded,
      totalPrice: complete ? price : 0,
      canSubmit: complete,
    }]);
  }

  // Lines whose template has more than one slot. Those cannot be completed from
  // a photo row — seeding fills slot 0 and the rest still need picking — so they
  // are the only reason the print section below still exists.
  const collageLines = printItems
    .map((item) => ({ item, product: PRODUCTS.find((p) => p.printType === item.printType) }))
    .filter(({ product }) => (product?.template?.currentVersion?.slots?.length || 1) > 1);

  // Cart owns this arithmetic for inline prints. PrintAddonSelector emits
  // totalPrice/canSubmit from an effect, but a single-slot print added from a
  // photo row never mounts that component, so nothing else would recompute them
  // and the cart total would ignore every quantity change.
  function setLineCopies(line, next, price, slotCount) {
    const copies = Math.max(1, Math.min(20, next));
    updateItem(line.id, {
      copies,
      totalPrice: copies * price,
      canSubmit: (line.photoIds?.length ?? 0) >= slotCount,
    });
  }
  function updateItem(id, patch) {
    setItems(printItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  function removeItem(id) {
    setItems(printItems.filter((item) => item.id !== id));
  }

  function handleRemove(photoId) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: { id: photoId } });
    setConfirmRemove(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto w-full py-4 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h1 font-black on-bg-text" style={{ color: 'var(--color-neutral-900)' }}>
          {t('cart.title')}
        </h1>
        <Button variant="ghost" onClick={() => navigate('/editor')}>
          <ArrowLeft size={18} /> {t('cart.editor')}
        </Button>
      </div>

      {selectedPhotos.length === 0 ? (
        <div className="flex justify-center py-10">
          <EmptyState
            icon={ShoppingCart}
            title={t('cart.empty')}
            action={<Button size="lg" className="mt-2" onClick={() => navigate('/gallery')}>{t('cart.browse')}</Button>}
          />
        </div>
      ) : (
        /* Two columns: the order on the left, what it costs on the right.
           The summary was previously a band at the bottom of a single column,
           so on a long order the total — and the pay button — sat below the
           fold while the customer was still deciding. */
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] items-start">

          {/* ── Left: order lines ── */}
          <div className="flex flex-col gap-3 min-w-0">
            {selectedPhotos.map((photo) => {
              const editedDataUrl = photoEdits[photo.id]?.dataUrl;
              const isFree = (photo.price ?? 0) === 0;
              const sourceLabel = photo.isAiGenerated
                ? t('cart.aiPhoto')
                : photo.isComposite
                  ? t('cart.framePhoto')
                  : t('cart.original');
              return (
                <div key={photo.id} className="card flex items-start gap-4 p-4">
                  {/* Thumbnails: original + edited side by side */}
                  <div className="flex gap-2 shrink-0">
                    {/* Original */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="rounded-lg overflow-hidden" style={{ width: 80, height: 80 }}>
                        <img src={photo.thumbnail} alt={sourceLabel} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-neutral-600)' }}>{sourceLabel}</span>
                    </div>

                    {/* Edited result — only if user made edits */}
                    {editedDataUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="rounded-lg overflow-hidden" style={{ width: 80, height: 80 }}>
                          <img src={editedDataUrl} alt={t('cart.edited')} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{t('cart.edited')}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--color-neutral-800)' }}>
                      {photo.filename}
                    </p>
                    <p className="font-black text-lg" style={{ color: isFree ? 'var(--color-success)' : 'var(--color-primary)' }}>
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

                  {/* The whole print flow lives on the photo's own row: add,
                      set quantity, remove. There is no separate section to
                      scroll to, and no step where the customer re-picks the
                      picture already in front of them.

                      One line per (photo, product): a second copy is a
                      quantity, not a second line, which is why the add button
                      turns into a stepper once it exists. */}
                  {canOfferPrintAddon && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-center">
                      {PRODUCTS.map((product) => {
                        const slotCount = product.template.currentVersion?.slots?.length || 1;
                        const price = product.template.price ?? 0;
                        const line = printItems.find(
                          (it) => it.printType === product.printType && it.photoIds?.[0] === photo.photo_id
                        );

                        if (!line) {
                          return (
                            <button
                              key={product.printType}
                              onClick={() => addItem(product.printType, photo)}
                              className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
                              style={{
                                background: '#fff',
                                border: '1.5px solid var(--color-primary-100)',
                                boxShadow: 'var(--shadow-sm)',
                              }}
                            >
                              <PrintFormatArt slots={slotCount} className="w-8 h-8 shrink-0" />
                              <span className="text-left leading-tight">
                                <span className="block text-xs font-bold" style={{ color: 'var(--color-neutral-900)' }}>
                                  {t(product.labelKey)}
                                </span>
                                <span className="block text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
                                  Rp {price.toLocaleString('id-ID')}
                                </span>
                              </span>
                              <span
                                className="flex items-center justify-center rounded-full shrink-0"
                                style={{ width: 26, height: 26, background: 'var(--color-primary)', color: '#fff' }}
                              >
                                <Plus size={15} strokeWidth={3} />
                              </span>
                            </button>
                          );
                        }

                        return (
                          <div
                            key={product.printType}
                            className="inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl"
                            style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary)' }}
                          >
                            <PrintFormatArt slots={slotCount} className="w-8 h-8 shrink-0" />
                            <span className="text-left leading-tight">
                              <span className="block text-xs font-bold" style={{ color: 'var(--color-neutral-900)' }}>
                                {t(product.labelKey)}
                              </span>
                              <span className="block text-[11px] font-black" style={{ color: 'var(--color-primary)' }}>
                                Rp {(line.copies * price).toLocaleString('id-ID')}
                              </span>
                            </span>

                            <span className="flex items-center gap-0.5">
                              <button
                                onClick={() => setLineCopies(line, line.copies - 1, price, slotCount)}
                                disabled={line.copies <= 1}
                                aria-label={t('print.copies')}
                                className="w-8 h-8 rounded-lg inline-flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed active:scale-90 transition-all"
                                style={{ background: '#fff', color: 'var(--color-primary)' }}
                              >
                                <Minus size={15} strokeWidth={3} />
                              </button>
                              <span
                                className="text-sm font-black tabular-nums text-center"
                                style={{ minWidth: 20, color: 'var(--color-neutral-900)' }}
                              >
                                {line.copies}
                              </span>
                              <button
                                onClick={() => setLineCopies(line, line.copies + 1, price, slotCount)}
                                aria-label={t('print.copies')}
                                className="w-8 h-8 rounded-lg inline-flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                                style={{ background: 'var(--color-primary)', color: '#fff' }}
                              >
                                <Plus size={15} strokeWidth={3} />
                              </button>
                            </span>

                            <IconButton
                              icon={X}
                              label={t('print.removeLine')}
                              variant="danger"
                              size="sm"
                              onClick={() => removeItem(line.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <IconButton
                    icon={X}
                    label={t('cart.removeAria')}
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmRemove(photo)}
                  />
                </div>
              );
            })}

            {/* Collage prints only. A single-slot print is created, counted
                and removed entirely from its photo's row above, so it needs
                nothing here — but a template with several slots still has
                empty ones to fill, and PrintAddonSelector is the only thing
                that can fill them. Rendering this unconditionally is what put
                a whole second section under a cart that did not need one. */}
            {collageLines.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-4">
                  <span
                    className="flex items-center justify-center rounded-xl shrink-0"
                    style={{ width: 42, height: 42, background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                  >
                    <Printer size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-h3 font-black leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
                      {t('checkout.addPrint')}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
                      {t('print.collageHint')}
                    </p>
                  </div>
                </div>

                {collageLines.map(({ item, product }) => (
                  <div key={item.id} className="px-4 py-4" style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="font-bold" style={{ color: 'var(--color-neutral-900)' }}>
                        {t(product.labelKey)}
                      </p>
                      <IconButton
                        icon={X}
                        label={t('print.removeLine')}
                        variant="danger"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      />
                    </div>
                    <PrintAddonSelector
                      photos={selectedPhotos}
                      templateVersion={product.template.currentVersion}
                      printPrice={product.template.price}
                      initial={item}
                      onSelectionChange={(sel) => updateItem(item.id, sel)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: sticky order summary ── */}
          <aside className="card p-5 flex flex-col gap-3 w-full lg:sticky lg:top-4">
            <h2 className="text-h3 font-black flex items-center gap-2" style={{ color: 'var(--color-neutral-900)' }}>
              <ShoppingCart size={20} /> {t('cart.summaryTitle')}
            </h2>

            <div className="flex flex-col gap-1.5">
              <SummaryRow label={t('cart.rowItems')} value={selectedPhotos.length} />
              {plainCount > 0     && <SummaryRow muted label={t('cart.rowPhotos')} value={plainCount} />}
              {aiCount > 0        && <SummaryRow muted label={t('cart.rowAi')} value={aiCount} />}
              {compositeCount > 0 && <SummaryRow muted label={t('cart.rowFrame')} value={compositeCount} />}
              {printCopies > 0    && <SummaryRow label={t('cart.rowPrints')} value={printCopies} />}
            </div>

            <div style={{ borderTop: '1px dashed var(--color-neutral-200)' }} />

            <div className="flex flex-col gap-1.5">
              <SummaryRow label={t('cart.subtotalPhotos')} value={`Rp ${total.toLocaleString('id-ID')}`} />
              {addonEstimate > 0 && (
                <SummaryRow label={t('cart.subtotalPrints')} value={`Rp ${addonEstimate.toLocaleString('id-ID')}`} />
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-neutral-200)' }} />

            <div className="flex items-baseline justify-between gap-3">
              <span className="font-bold" style={{ color: 'var(--color-neutral-800)' }}>{t('common.total')}</span>
              <span className="text-h3 font-black" style={{ color: 'var(--color-primary)' }}>
                Rp {(total + addonEstimate).toLocaleString('id-ID')}
              </span>
            </div>

            <Button size="lg" className="w-full" onClick={() => navigate('/checkout')}>
              {t('cart.payNow')} <ArrowRight size={20} />
            </Button>

            <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-neutral-600)' }}>
              <ShieldCheck size={14} className="shrink-0 mt-0.5" /> {t('cart.secureNote')}
            </p>
          </aside>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <Modal title={t('cart.removeTitle')} onClose={() => setConfirmRemove(null)} size="sm">
          <div className="px-6 py-5 flex flex-col gap-4">
            <p className="text-sm truncate font-semibold" style={{ color: 'var(--color-neutral-800)' }}>
              {confirmRemove.filename}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
              {t('cart.removeConfirm')}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmRemove(null)}>
                {t('cart.removeCancel')}
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => handleRemove(confirmRemove.id)}>
                <X size={16} /> {t('cart.removeConfirmBtn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
