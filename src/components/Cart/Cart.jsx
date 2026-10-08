import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, X, Printer, ShieldCheck, Wallet, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { usePrintProducts } from '../../hooks/usePrintProducts';
import { copiesOf, setCopies, setCopiesForAll, addCollage, printTotals, MAX_COPIES } from '../../utils/printLines';
import PrintAddonSelector from '../Print/PrintAddonSelector';
import PrintPreview from '../Print/PrintPreview';
import WatermarkOverlay from '../common/WatermarkOverlay';
import QtyStepper from '../Print/QtyStepper';
import ProductArt from '../Print/ProductArt';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import PageHeader from '../common/PageHeader';
import NavBar from '../common/NavBar';

const rp = (n) => `Rp ${n.toLocaleString('id-ID')}`;

// Numbered section card from the design ("1. Pilih Produk", "2. …").
function Section({ title, action, children, className = '' }) {
  return (
    <section className={`card p-4 sm:p-5 flex flex-col gap-3 min-w-0 ${className}`} style={{ borderRadius: '1.75rem' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-black" style={{ color: 'var(--color-neutral-900)' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Product row: round check (top-left), art, name/description, price, and a
// control underneath. `locked` = always included (soft file), check disabled.
function ProductCard({ on, locked, onToggle, art, title, desc, price, control, note }) {
  return (
    <div
      className="relative rounded-2xl p-3 pl-11 flex flex-col gap-2 transition-shadow"
      style={{
        background: 'var(--color-neutral-50)',
        border: `2px solid ${on ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
        boxShadow: on ? '0 0 0 3px var(--color-primary-100), 0 6px 14px rgba(90,64,24,0.16)' : '0 6px 14px rgba(90,64,24,0.12)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={locked}
        aria-pressed={on}
        aria-label={title}
        className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center disabled:cursor-default"
        style={on
          ? { background: 'var(--gradient-primary)', color: '#fff', boxShadow: 'var(--shadow-glow-primary)' }
          : { background: '#fff', border: '2px solid var(--color-neutral-300)' }}
      >
        {on && <Check size={16} strokeWidth={3.5} />}
      </button>
      <div className="flex items-center gap-3">
        {art}
        <span className="flex-1 min-w-0">
          <span className="block text-lg sm:text-xl font-black leading-tight" style={{ color: 'var(--color-neutral-900)' }}>{title}</span>
          <span className="block text-sm leading-snug mt-0.5" style={{ color: 'var(--color-neutral-700)' }}>{desc}</span>
        </span>
      </div>
      {/* Price shares the control row, so the name gets the full width. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-black" style={{ color: 'var(--color-accent-700)' }}>{price}</span>
        {control}
      </div>
      {note && <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>{note}</p>}
    </div>
  );
}

export default function Cart() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { selectedPhotos, photoEdits, printItems, deviceConfig } = state;
  const photoTotal = selectedPhotos.reduce((sum, p) => sum + p.price, 0);
  const [confirmRemove, setConfirmRemove] = useState(null); // photo pending removal | null

  // Prints are folded into the same payment (no post-payment "pay to print"
  // upsell, see Download.jsx), so the total shown here is the real total.
  const { products, canOffer } = usePrintProducts();

  // Which photos the print products apply to. Starts as every photo that can
  // be printed (derived photos without a photo_id cannot be sent as a print).
  const [printFor, setPrintFor] = useState(() => new Set(selectedPhotos.filter((p) => p.photo_id).map((p) => p.id)));
  const ticked = selectedPhotos.filter((p) => p.photo_id && printFor.has(p.id));
  const asLineRef = (p) => ({ photoId: p.photo_id, source: photoEdits[p.id]?.dataUrl ? 'edited' : 'original' });

  const setItems = (next) => dispatch({ type: 'SET_PRINT_ITEMS', payload: next });
  const updateItem = (id, patch) => setItems(printItems.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems(printItems.filter((it) => it.id !== id));

  const singleProducts = products.filter((p) => p.slotCount === 1);
  const collageProducts = products.filter((p) => p.slotCount > 1);

  // A single-slot product's quantity = copies of EACH ticked photo. Photos can
  // differ (the editor sets them one at a time), shown as a range; stepping
  // then evens them out from the highest.
  function productQty(product) {
    const counts = ticked.map((p) => copiesOf(printItems, product.printType, p.photo_id));
    if (!counts.length) return { value: 0 };
    const lo = Math.min(...counts), hi = Math.max(...counts);
    return lo === hi ? { value: hi } : { value: hi, display: `${lo}–${hi}` };
  }
  function setProductQty(product, copies) {
    setItems(setCopiesForAll(printItems, {
      printType: product.printType, photos: ticked.map(asLineRef), copies, price: product.price,
    }));
  }

  // Ticking a photo gives it the product's current quantity; unticking drops
  // its single-photo prints (its collage slots are edited in their own card).
  function togglePrintFor(photo) {
    const on = !printFor.has(photo.id);
    let next = printItems;
    for (const product of singleProducts) {
      const qty = on ? productQty(product).value : 0;
      next = setCopies(next, { printType: product.printType, ...asLineRef(photo), copies: qty, price: product.price });
    }
    setItems(next);
    setPrintFor((prev) => { const s = new Set(prev); on ? s.add(photo.id) : s.delete(photo.id); return s; });
  }
  function toggleAll() {
    const allOn = ticked.length === selectedPhotos.filter((p) => p.photo_id).length;
    if (allOn) {
      let next = printItems;
      for (const product of singleProducts) {
        next = setCopiesForAll(next, { printType: product.printType, photos: ticked.map(asLineRef), copies: 0, price: product.price });
      }
      setItems(next);
      setPrintFor(new Set());
    } else {
      setPrintFor(new Set(selectedPhotos.filter((p) => p.photo_id).map((p) => p.id)));
    }
  }

  function addStrip(product) {
    const photos = (ticked.length ? ticked : selectedPhotos.filter((p) => p.photo_id)).map(asLineRef);
    setItems(addCollage(printItems, { printType: product.printType, photos, slotCount: product.slotCount, price: product.price }));
  }

  const collageLines = printItems
    .map((item) => ({ item, product: collageProducts.find((p) => p.printType === item.printType) }))
    .filter(({ product }) => product);

  // Only submittable lines are billed: a half-configured collage shows on its
  // own card but must not inflate the total the customer is about to pay.
  const printTotal = printItems.reduce((sum, it) => sum + (it.canSubmit ? it.totalPrice : 0), 0);
  const grandTotal = photoTotal + printTotal;

  // Product preview: one tab per product the order can show, Soft File always.
  const previewTabs = [...(canOffer ? products : []), { printType: 'soft', labelKey: 'cart.softFile' }];
  const [tab, setTab] = useState(previewTabs[0].printType);
  const [previewIdx, setPreviewIdx] = useState(0);
  const activeTab = previewTabs.find((p) => p.printType === tab) ?? previewTabs[0];
  const previewPool = ticked.length ? ticked : selectedPhotos;
  const previewPhoto = previewPool[previewIdx % Math.max(1, previewPool.length)];
  // The photo the product cards are drawn from: first ticked, else first.
  const artPhoto = ticked[0] ?? selectedPhotos[0];
  const artSrc = artPhoto ? (photoEdits[artPhoto.id]?.dataUrl ?? artPhoto.thumbnail ?? artPhoto.url) : undefined;
  const lightSrc = (p) => photoEdits[p.id]?.dataUrl ?? p.proxyUrl ?? p.url ?? p.thumbnail;

  function handleRemove(photoId) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: { id: photoId } });
    setConfirmRemove(null);
  }

  return (
    // Fills the panel: header on top, Back/Pay bar pinned to the bottom, and
    // only the order between them scrolls — so the pay action never sits
    // below the fold however long the order gets.
    <div className="flex flex-col gap-4 sm:gap-5 max-w-7xl mx-auto w-full h-full">
      <PageHeader icon={Wallet} title={t('cart.title')} subtitle={t('cart.subtitle')} />

      {selectedPhotos.length === 0 ? (
        <div className="flex justify-center py-10">
          <EmptyState
            icon={ShoppingCart}
            title={t('cart.empty')}
            action={<Button size="lg" className="mt-2" onClick={() => navigate('/gallery')}>{t('cart.browse')}</Button>}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 items-start">

            {/* ── Left: the photos, and what the products will look like ── */}
            <div className="flex flex-col gap-4 min-w-0">
              <Section
                title={t('cart.selectedPhotos', { count: selectedPhotos.length })}
                action={canOffer && (
                  <button type="button" onClick={toggleAll} className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--color-primary)' }}>
                    {ticked.length ? t('cart.printNone') : t('cart.printAll')}
                  </button>
                )}
              >
                {canOffer && <p className="text-base -mt-1" style={{ color: 'var(--color-neutral-700)' }}>{t('cart.tickHint')}</p>}
                <div className="grid grid-cols-3 gap-2.5">
                  {selectedPhotos.map((photo) => {
                    const on = printFor.has(photo.id) && !!photo.photo_id;
                    return (
                      <div key={photo.id} className="relative">
                        <button
                          type="button"
                          onClick={() => canOffer && photo.photo_id && togglePrintFor(photo)}
                          aria-pressed={canOffer ? on : undefined}
                          className="block w-full aspect-[4/5] rounded-2xl overflow-hidden"
                          style={{ boxShadow: canOffer && on ? '0 0 0 3px var(--color-primary)' : 'var(--shadow-sm)' }}
                        >
                          <img src={photoEdits[photo.id]?.dataUrl ?? photo.thumbnail ?? photo.url} alt="" className="w-full h-full object-cover" />
                        </button>
                        {canOffer && photo.photo_id && (
                          <span
                            aria-hidden
                            className="absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center pointer-events-none"
                            style={{ background: on ? 'var(--color-primary)' : 'rgba(255,255,255,0.9)', color: '#fff', border: on ? 'none' : '1.5px solid var(--color-neutral-300)' }}
                          >
                            {on && <Check size={18} strokeWidth={3.5} />}
                          </span>
                        )}
                        <span className="absolute top-1 right-1">
                          <IconButton icon={X} label={t('cart.removeAria')} variant="danger" size="sm" onClick={() => setConfirmRemove(photo)} />
                        </span>
                        <span className="absolute bottom-2 left-2 right-2 text-sm font-black text-white text-right" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                          {photo.price ? rp(photo.price) : t('cart.free')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title={t('cart.previewTitle')}>
                <div className="flex gap-1.5 p-1 rounded-full" style={{ background: 'var(--color-neutral-100)' }} role="tablist">
                  {previewTabs.map((p) => (
                    <button
                      key={p.printType}
                      type="button"
                      role="tab"
                      aria-selected={activeTab.printType === p.printType}
                      onClick={() => setTab(p.printType)}
                      className="flex-1 py-2.5 rounded-full text-base font-bold transition-colors"
                      style={activeTab.printType === p.printType
                        ? { background: 'var(--gradient-primary)', color: '#fff', boxShadow: 'var(--shadow-glow-primary)' }
                        : { color: 'var(--color-neutral-800)' }}
                    >
                      {t(p.labelKey)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <IconButton icon={ChevronLeft} label={t('editor.prevPhoto')} variant="subtle" size="sm" disabled={previewPool.length < 2} onClick={() => setPreviewIdx((i) => (i - 1 + previewPool.length) % previewPool.length)} />
                  {/* min-w-0: without it this flex item grows to the preview's
                      natural width and a wide 4R spilled over the next column. */}
                  <div className="flex-1 min-w-0 flex justify-center py-2">
                    {previewPhoto && (activeTab.printType === 'soft' ? (
                      // The soft file is the photo itself, on the customer's phone.
                      <div className="w-36 rounded-[1.75rem] p-2" style={{ background: 'var(--color-neutral-900)', boxShadow: 'var(--shadow-lg)' }}>
                        <div className="relative rounded-[1.25rem] overflow-hidden">
                          <img src={lightSrc(previewPhoto)} alt="" className="block w-full aspect-[9/16] object-cover" />
                          <WatermarkOverlay scale={0.4} />
                        </div>
                      </div>
                    ) : (
                      <PrintPreview
                        templateVersion={activeTab.template.currentVersion}
                        srcs={Array.from({ length: activeTab.slotCount }, (_, i) => lightSrc(previewPool[(previewIdx + i) % previewPool.length]))}
                        outletName={deviceConfig?.outlet?.name}
                        // Height-bound, not width-bound: a 2x6 strip sized to the
                        // column's width came out ~960px tall.
                        className="h-64 w-auto max-w-full rounded-md"
                      />
                    ))}
                  </div>
                  <IconButton icon={ChevronRight} label={t('editor.nextPhoto')} variant="subtle" size="sm" disabled={previewPool.length < 2} onClick={() => setPreviewIdx((i) => (i + 1) % previewPool.length)} />
                </div>
              </Section>
            </div>

            {/* ── Right: products and what they cost ── */}
            <div className="flex flex-col gap-4 min-w-0">
              <Section title={t('cart.productsTitle')}>
                {/* One card per product, as in the design: a round check, the
                    product drawn from the customer's own photo, price, and
                    (for prints) the quantity. */}
                {canOffer && products.map((product) => {
                  const single = product.slotCount === 1;
                  const q = single ? productQty(product) : null;
                  const strips = single ? 0 : collageLines.filter(({ item }) => item.printType === product.printType).length;
                  const on = single ? q.value > 0 : strips > 0;
                  const toggle = () => {
                    if (single) setProductQty(product, on ? 0 : 1);
                    else if (on) setItems(printItems.filter((it) => it.printType !== product.printType));
                    else addStrip(product);
                  };
                  return (
                    <ProductCard
                      key={product.printType}
                      on={on}
                      onToggle={toggle}
                      art={<ProductArt kind={product.printType === 'secondary' ? 'strip' : 'print'} src={artSrc} />}
                      title={t(product.labelKey)}
                      desc={single ? t('cart.perPhoto') : (strips ? t('cart.stripsAdded', { count: strips }) : t('cart.stripDesc', { count: product.slotCount }))}
                      price={rp(product.price)}
                      control={single ? (
                        <QtyStepper value={q.value} display={q.display} max={MAX_COPIES} onChange={(n) => setProductQty(product, n)} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => addStrip(product)}
                          className="raised-tile flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-bold"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <Plus size={16} strokeWidth={3} /> {t('cart.addStrip')}
                        </button>
                      )}
                      note={single && !ticked.length ? t('cart.tickFirst') : null}
                    />
                  );
                })}

                {/* Soft file — every photo in the order IS the digital file, so
                    it is always included: locked on, no stepper, priced per photo. */}
                <ProductCard
                  on
                  locked
                  art={<ProductArt kind="soft" src={artSrc} />}
                  title={t('cart.softFile')}
                  desc={t('cart.softFileDesc')}
                  price={rp(photoTotal)}
                  control={
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-black" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                      <Check size={14} strokeWidth={3} /> {t('cart.included')}
                    </span>
                  }
                />
              </Section>

              <Section title={<span className="flex items-center gap-2"><ShoppingCart size={20} /> {t('cart.summaryTitle')}</span>}>
                <div className="flex flex-col gap-2">
                  {canOffer && products.map((product) => {
                    const tot = printTotals(printItems, product.printType);
                    if (!tot.copies) return null;
                    return (
                      <div key={product.printType} className="flex items-baseline justify-between gap-3 text-base">
                        <span style={{ color: 'var(--color-neutral-800)' }}>
                          <span className="font-bold">{t(product.labelKey)}</span>{' '}
                          <span style={{ color: 'var(--color-neutral-600)' }}>{rp(product.price)} × {tot.copies}</span>
                        </span>
                        <span className="font-bold" style={{ color: 'var(--color-neutral-900)' }}>{rp(tot.price)}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between gap-3 text-base">
                    <span style={{ color: 'var(--color-neutral-800)' }}>
                      <span className="font-bold">{t('cart.softFile')}</span>{' '}
                      <span style={{ color: 'var(--color-neutral-600)' }}>{t('cart.photoCount', { count: selectedPhotos.length })}</span>
                    </span>
                    <span className="font-bold" style={{ color: 'var(--color-neutral-900)' }}>{rp(photoTotal)}</span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-3" style={{ borderTop: '2px dashed var(--color-neutral-300)' }}>
                  <span className="font-black text-lg" style={{ color: 'var(--color-neutral-900)' }}>{t('common.total')}</span>
                  <span className="text-2xl font-black" style={{ color: 'var(--color-accent-700)' }}>{rp(grandTotal)}</span>
                </div>
                <p className="text-sm flex items-start gap-1.5" style={{ color: 'var(--color-neutral-600)' }}>
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" /> {t('cart.secureNote')}
                </p>
              </Section>
            </div>
          </div>

          {/* Collage prints only: a template with several slots still has
              slots to (re)fill and copies to set, and PrintAddonSelector is the
              only thing that does that. */}
          {collageLines.length > 0 && (
            <div className="card overflow-hidden" style={{ borderRadius: '1.75rem' }}>
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
                <div key={item.id} className="px-4 py-4" style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
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
                    printPrice={product.price}
                    initial={item}
                    onSelectionChange={(sel) => updateItem(item.id, sel)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NavBar
        back={{ label: t('nav.back'), sub: t('cart.backSub'), onClick: () => navigate('/editor') }}
        next={selectedPhotos.length ? {
          label: t('cart.payNow'),
          sub: `${t('common.total')} ${rp(grandTotal)}`,
          onClick: () => navigate('/checkout'),
        } : undefined}
      />

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
