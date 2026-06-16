import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Minus, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getOutletPrintPrice, createPrintTransaction, getTransaction } from '../../api/mockApi';
import { printImage, printFromUrl } from '../../native/print';
import { useLang } from '../../i18n/LanguageContext';
import LoadingSpinner from '../common/LoadingSpinner';
import Button from '../common/Button';

const POLL_INTERVAL_MS = 3000;

// Paid printing on the Download screen: pick version + copies per photo → pay
// QRIS (price computed server-side) → silently print once confirmed paid.
export default function PrintModal({ photos, photoEdits, outletId, printerName, onClose }) {
  const { t } = useLang();
  const [view, setView] = useState('select'); // select | creating | paying | printing | done | error
  const [printPrice, setPrintPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);

  // Per-photo selection: { [photo.id]: { source, copies } }
  const [sel, setSel] = useState(() => {
    const init = {};
    for (const p of photos) {
      init[p.id] = { source: photoEdits[p.id]?.dataUrl ? 'edited' : 'original', copies: 0 };
    }
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    getOutletPrintPrice(outletId)
      .then((price) => { if (!cancelled) setPrintPrice(price); })
      .catch(() => { if (!cancelled) setPrintPrice(null); })
      .finally(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [outletId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const totalCopies = Object.values(sel).reduce((s, x) => s + x.copies, 0);
  const totalPrice = totalCopies * (printPrice ?? 0);

  function setCopies(id, delta) {
    setSel((cur) => ({ ...cur, [id]: { ...cur[id], copies: Math.max(0, Math.min(20, cur[id].copies + delta)) } }));
  }
  function setSource(id, source) {
    setSel((cur) => ({ ...cur, [id]: { ...cur[id], source } }));
  }

  const runPrints = useCallback(async () => {
    setView('printing');
    setErrorMsg('');
    let failed = 0;
    for (const p of photos) {
      const { source, copies } = sel[p.id];
      if (copies < 1) continue;
      try {
        if (source === 'edited' && photoEdits[p.id]?.dataUrl) {
          await printImage(printerName, photoEdits[p.id].dataUrl, copies);
        } else {
          await printFromUrl(printerName, p.proxyUrl ?? p.url, copies);
        }
      } catch {
        failed += 1;
      }
    }
    setView(failed > 0 ? 'error' : 'done');
  }, [photos, sel, photoEdits, printerName]);

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
    if (totalCopies < 1) return;
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
            priceLoading ? (
              <div className="py-10"><LoadingSpinner /></div>
            ) : !printPrice ? (
              <p className="text-center text-sm py-8" style={{ color: 'var(--color-neutral-500)' }}>{t('print.notAvailable')}</p>
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
            <Button onClick={handlePay} disabled={totalCopies < 1} className="w-full">
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
    </div>
  );
}
