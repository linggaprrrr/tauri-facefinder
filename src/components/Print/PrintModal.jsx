import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Minus, Plus, CheckCircle2, AlertTriangle, ImagePlus } from 'lucide-react';
import { createPrintTransaction, getTransaction, createPrintJob } from '../../api/mockApi';
import { composePrintImage } from '../../utils/composePrintImage';
import { enqueuePrint } from '../../utils/printQueue';
import { useLang } from '../../i18n/LanguageContext';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';
import SlotPhotoPicker from '../Editor/SlotPhotoPicker';

const POLL_INTERVAL_MS = 3000;

// Paid printing on the Download screen: pick photo(s)/copies → pay QRIS
// (price computed server-side) → compose + hand off to the local print
// queue once confirmed paid. Printing itself never blocks this modal — it
// moves to 'done' as soon as jobs are queued; actual print outcome is
// reported async and surfaced (with a reprint option) on the Download screen.
//
// templateVersion is guaranteed non-null here — Download.jsx only offers the
// print button once a template has resolved. Two modes based on its slots:
// single-slot (Phase 1: per-cart-photo copies, one job per photo) or collage
// (Phase 2: assign one cart photo per slot, one job for the whole sheet).
export default function PrintModal({ photos, photoEdits, outletId, printerName, printSetting, templateVersion, downloadUrl, outletName, onJobQueued, onClose }) {
  const { t } = useLang();
  const [view, setView] = useState('select'); // select | creating | paying | printing | done | error
  const printPrice = printSetting?.print_price ?? null;
  const [transaction, setTransaction] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);

  const isCollage = templateVersion.slots?.length > 0;

  // ── Single-slot mode: per-cart-photo copies ──
  const [sel, setSel] = useState(() => {
    const init = {};
    for (const p of photos) {
      init[p.id] = { source: photoEdits[p.id]?.dataUrl ? 'edited' : 'original', copies: 0 };
    }
    return init;
  });

  // ── Collage mode: one assigned photo per slot + a single copies count ──
  const [slotAssignments, setSlotAssignments] = useState(() => Array(templateVersion.slots?.length ?? 0).fill(null));
  const [collageCopies, setCollageCopies] = useState(0);
  const [activeSlot, setActiveSlot] = useState(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const totalCopies = isCollage ? collageCopies : Object.values(sel).reduce((s, x) => s + x.copies, 0);
  const totalPrice = totalCopies * (printPrice ?? 0);
  const slotsFilled = !isCollage || slotAssignments.every(Boolean);
  const canPay = totalCopies > 0 && slotsFilled;

  function setCopies(id, delta) {
    setSel((cur) => ({ ...cur, [id]: { ...cur[id], copies: Math.max(0, Math.min(20, cur[id].copies + delta)) } }));
  }
  function setSource(id, source) {
    setSel((cur) => ({ ...cur, [id]: { ...cur[id], source } }));
  }
  function adjustCollageCopies(delta) {
    setCollageCopies((c) => Math.max(0, Math.min(20, c + delta)));
  }
  function assignSlot(photo) {
    setSlotAssignments((cur) => { const next = [...cur]; next[activeSlot] = photo; return next; });
    setActiveSlot(null);
  }

  const runPrints = useCallback(async () => {
    // Original photos aren't printed via printFromUrl's raw-bytes path
    // anymore — everything funnels through a dataURL so it can be composed
    // onto the template and persisted in the local queue for retry-after-restart.
    async function resolvePrintSource(photo, source) {
      if (source === 'edited' && photoEdits[photo.id]?.dataUrl) return photoEdits[photo.id].dataUrl;
      const resp = await fetch(photo.proxyUrl ?? photo.url);
      if (!resp.ok) throw new Error(`Could not load image (${resp.status})`);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(blob);
      });
    }

    setView('printing');
    setErrorMsg('');
    const tokens = { outlet_name: outletName ?? '', download_url: downloadUrl ?? '' };
    const queuedJobs = [];

    if (isCollage) {
      try {
        const rawSrcs = await Promise.all(
          slotAssignments.map((p) => resolvePrintSource(p, photoEdits[p.id]?.dataUrl ? 'edited' : 'original'))
        );
        const finalDataUrl = await composePrintImage(templateVersion, rawSrcs, tokens);
        const job = await createPrintJob({
          transactionId: transaction.id,
          outletId,
          templateVersionId: templateVersion.id,
          photoIds: slotAssignments.map((p) => p.photo_id),
          copies: collageCopies,
        });
        enqueuePrint({ jobId: job.id, printerName, dataUrl: finalDataUrl, copies: collageCopies });
        queuedJobs.push({ jobId: job.id, printerName, dataUrl: finalDataUrl, copies: collageCopies });
      } catch {
        // Couldn't compose/register the collage — nothing was queued.
      }
    } else {
      for (const p of photos) {
        const { source, copies } = sel[p.id];
        if (copies < 1) continue;
        try {
          const rawSrc = await resolvePrintSource(p, source);
          const finalDataUrl = await composePrintImage(templateVersion, [rawSrc], tokens);
          const job = await createPrintJob({
            transactionId: transaction.id,
            outletId,
            templateVersionId: templateVersion.id,
            photoIds: [p.photo_id],
            copies,
          });
          enqueuePrint({ jobId: job.id, printerName, dataUrl: finalDataUrl, copies });
          queuedJobs.push({ jobId: job.id, photoId: p.id, printerName, dataUrl: finalDataUrl, copies });
        } catch {
          // Couldn't even register the job (network/backend down) — nothing was
          // queued for this photo, so there's no reprint affordance for it either.
        }
      }
    }

    if (queuedJobs.length) onJobQueued?.(queuedJobs);
    setView(queuedJobs.length > 0 ? 'done' : 'error');
  }, [photos, sel, photoEdits, printerName, templateVersion, transaction, outletId, onJobQueued, isCollage, slotAssignments, collageCopies, outletName, downloadUrl]);

  function startPolling(id) {
    pollRef.current = setInterval(async () => {
      try {
        const trx = await getTransaction(id);
        if (trx.paid) {
          clearInterval(pollRef.current);
          runPrints();
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL_MS);
  }

  async function handlePay() {
    if (!canPay) return;
    setView('creating');
    setErrorMsg('');
    try {
      const trx = await createPrintTransaction({ outletId, copies: totalCopies });
      setTransaction(trx);
      setView('paying');
      startPolling(trx.id);
    } catch (err) {
      setErrorMsg(err.message);
      setView('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col w-full max-w-md rounded-3xl overflow-hidden" style={{ background: '#fff', boxShadow: 'var(--shadow-xl)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: 'var(--color-primary)', color: '#fff' }}>
          <span className="font-bold text-lg flex items-center gap-2"><Printer size={20} /> {t('print.title')}</span>
          <button onClick={onClose} aria-label={t('common.close')} className="opacity-80 hover:opacity-100"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5">
          {/* ── Select ── */}
          {view === 'select' && (
            !printPrice ? (
              <p className="text-center text-sm py-8" style={{ color: 'var(--color-neutral-500)' }}>{t('print.notAvailable')}</p>
            ) : isCollage ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>
                  {t('print.collageHint')} <span className="font-semibold">{t('print.perPrint')}: Rp {printPrice.toLocaleString('id-ID')}</span>
                </p>
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
                <div className="flex items-center justify-between p-2 rounded-xl" style={{ border: '1.5px solid var(--color-neutral-200)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-neutral-700)' }}>{t('print.copies')}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustCollageCopies(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-neutral-100)' }}><Minus size={14} /></button>
                    <span className="w-5 text-center font-bold text-sm">{collageCopies}</span>
                    <button onClick={() => adjustCollageCopies(1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>
                  {t('print.selectHint')} <span className="font-semibold">{t('print.perPrint')}: Rp {printPrice.toLocaleString('id-ID')}</span>
                </p>
                {photos.map((p) => {
                  const hasEdit = !!photoEdits[p.id]?.dataUrl;
                  const s = sel[p.id];
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ border: '1.5px solid var(--color-neutral-200)' }}>
                      <img src={p.thumbnail} alt="" className="rounded-lg object-cover shrink-0" style={{ width: 48, height: 48 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1">
                          {['original', 'edited'].map((src) => {
                            const disabled = src === 'edited' && !hasEdit;
                            const active = s.source === src;
                            return (
                              <button
                                key={src}
                                disabled={disabled}
                                onClick={() => setSource(p.id, src)}
                                className="text-xs font-semibold px-2 py-1 rounded-md disabled:opacity-30"
                                style={{
                                  background: active ? 'var(--color-primary)' : 'var(--color-neutral-100)',
                                  color: active ? '#fff' : 'var(--color-neutral-600)',
                                }}
                              >
                                {t(src === 'original' ? 'print.original' : 'print.edited')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setCopies(p.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-neutral-100)' }}><Minus size={14} /></button>
                        <span className="w-5 text-center font-bold text-sm">{s.copies}</span>
                        <button onClick={() => setCopies(p.id, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}><Plus size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {view === 'creating' && <div className="py-10"><LoadingSpinner message={t('print.creating')} /></div>}

          {/* ── Paying ── */}
          {view === 'paying' && transaction && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-neutral-700)' }}>{t('print.payTitle')}</p>
              <div className="p-3 rounded-2xl" style={{ background: 'var(--color-neutral-50)', border: '1.5px solid var(--color-neutral-200)' }}>
                <QRCodeSVG value={transaction.payment_url} size={200} level="H" fgColor="#013F65" />
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>Rp {totalPrice.toLocaleString('id-ID')}</p>
              <p className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>{t('print.totalCopies', { n: totalCopies })}</p>
            </div>
          )}

          {view === 'printing' && <div className="py-10"><LoadingSpinner message={t('print.printing')} /></div>}

          {view === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={48} style={{ color: 'var(--color-success)' }} />
              <p className="text-lg font-black" style={{ color: 'var(--color-neutral-900)' }}>{t('print.doneTitle')}</p>
              <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>{t('print.doneDesc')}</p>
            </div>
          )}

          {view === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle size={40} style={{ color: 'var(--color-error)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>{errorMsg || t('print.printErr')}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
          {view === 'select' && printPrice && (
            <Button onClick={handlePay} disabled={!canPay} className="w-full">
              {t('print.payAndPrint')} · Rp {totalPrice.toLocaleString('id-ID')}
            </Button>
          )}
          {view === 'done' && <Button onClick={onClose} className="w-full">{t('common.close')}</Button>}
          {view === 'error' && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} className="flex-1">{t('common.close')}</Button>
              {transaction && <Button onClick={runPrints} className="flex-1">{t('print.retry')}</Button>}
            </div>
          )}
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
