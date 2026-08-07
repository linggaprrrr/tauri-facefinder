import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, Download as DownloadIcon, Banknote, Smartphone, Check, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { clearPendingOrder } from '../../utils/pendingOrder';
import { isTauri, printImage } from '../../native/print';
import { usePrintTemplates } from '../../hooks/usePrintTemplates';
import { reprintPrintJob, createPrintJob } from '../../api/mockApi';
import { enqueuePrint } from '../../utils/printQueue';
import { composeReceiptImage } from '../../utils/composeReceiptImage';
import { composePrintImage } from '../../utils/composePrintImage';
import { resolvePrintSource } from '../../utils/resolvePrintSource';
import ownizeLogo from '../../assets/ownize_logo.png';
import Button from '../common/Button';

const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_LINK ?? 'https://myphoto.com';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRp(amount) {
  return `Rp ${Number(amount ?? 0).toLocaleString('id-ID')}`;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function Download() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { order, deviceConfig, selectedPhotos, photoEdits } = state;
  const editedPhotos = selectedPhotos.filter((p) => photoEdits[p.id]?.dataUrl);
  const [receiptStatus, setReceiptStatus] = useState('idle'); // idle | printing | fail
  const outletId = deviceConfig?.outlet?.id;

  // Auto-return to the welcome screen. This is a privacy control before it is
  // a convenience one: the QR on this screen is a live download link valid for
  // days, so leaving it up lets the next person at the kiosk scan it and take
  // the previous customer's photos.
  //
  // The short window applies once the receipt is printed, because the receipt
  // carries the same QR — the customer still has their link on paper. It
  // deliberately does NOT trigger on a photo print: that gives them a photo,
  // not the link, so cutting to a minute could strand someone still scanning.
  //
  // A paid photo print outranks both: dye-sub paper takes minutes to come out,
  // and resetting to the welcome screen while the customer is still waiting on
  // it reads as "the kiosk lost my order". While a print is in flight the
  // screen holds for a full 7 minutes and says so in a banner instead.
  const AUTO_RESET_IDLE_MS = 5 * 60 * 1000;
  const AUTO_RESET_PRINTED_MS = 60 * 1000;
  const AUTO_RESET_PRINTING_MS = 7 * 60 * 1000;
  const resetWindowRef = useRef(AUTO_RESET_IDLE_MS);
  // Sticky: once a receipt is out, the customer keeps the QR on paper for the
  // rest of the session, so the shorter window still applies after a print
  // finishes and releases its own hold.
  const receiptPrintedRef = useRef(false);
  const [resetAt, setResetAt] = useState(() => Date.now() + AUTO_RESET_IDLE_MS);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(AUTO_RESET_IDLE_MS / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      const ms = resetAt - Date.now();
      setSecondsLeft(Math.max(0, Math.round(ms / 1000)));
      if (ms <= 0) {
        clearPendingOrder();
        dispatch({ type: 'RESET' });
        navigate('/');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [resetAt, dispatch, navigate]);

  // Any touch or keypress means somebody is still standing there, so the clock
  // restarts — otherwise a customer reading the screen gets reset mid-scan.
  useEffect(() => {
    const bump = () => setResetAt(Date.now() + resetWindowRef.current);
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, []);

  // Auto-print the receipt once the transaction lands, when the outlet opted
  // in. Guarded by a ref, not state: this screen re-renders on every countdown
  // tick, and printing is a physical side effect that must happen exactly once
  // — handing a customer two receipts, or burning a roll through a render
  // loop, is worse than no automation. handlePrintReceipt is a hoisted
  // function declaration, so calling it from up here is safe; the effect only
  // runs after the first render completes.
  const autoReceiptPrintedRef = useRef(false);
  useEffect(() => {
    if (!order || autoReceiptPrintedRef.current) return;
    if (!deviceConfig?.autoPrintReceipt) return;
    if (!isTauri() || !deviceConfig?.receiptPrinterName) return;
    autoReceiptPrintedRef.current = true;
    // The declaration sits below the `if (!order) return null` guard, and every
    // hook has to stay above that guard — so this forward reference can't be
    // untangled by reordering. It is safe: an effect body runs after render.
    // eslint-disable-next-line react-hooks/immutability
    handlePrintReceipt();
  }, [order, deviceConfig?.autoPrintReceipt, deviceConfig?.receiptPrinterName]);

  // Printing is decided once, upfront at checkout (the Cart print-addon
  // checkbox) — no post-payment "pay to print" upsell here. Otherwise a
  // customer who paid Rp 0 for photos via a 100%-off voucher would suddenly
  // face a fresh charge just to print, which makes no sense. This lookup
  // stays only to resolve the template the auto-print effect below composes
  // against (order.print_addon already tells us copies/photos/pricing —
  // resolved and charged server-side at checkout).
  const { printTemplates, loading: templatesLoading } = usePrintTemplates(outletId);
  // A print order is a list of lines; older backends (and older orders) carry a
  // single print_addon, which is exactly one line.
  const paidItems = order?.print_items?.length
    ? order.print_items
    : (order?.print_addon ? [order.print_addon] : []);

  // Compose each line against the exact version it was charged for, not
  // whatever the outlet's settings point at now — those diverge the moment a
  // customer buys a strip, and re-resolving from settings would print a 4R
  // against a paid-for 2x6. The backend pins template_version_id per line
  // precisely so this is knowable.
  //
  // Printer routing is per line, not per order: a 4R and a strip bought
  // together are two sheets on two different devices. Falling back to the
  // primary keeps every single-printer outlet working exactly as before — an
  // unset secondary printer must never mean "don't print", since the customer
  // has already paid for the strip.
  const resolvedItems = paidItems.map((item) => {
    const template = printTemplates.find((tpl) => tpl.currentVersion?.id === item.template_version_id) ?? null;
    return {
      item,
      template,
      templateVersion: template?.currentVersion ?? null,
      printerName: template?.printType === 'secondary'
        ? (deviceConfig?.secondaryPrinterName || deviceConfig?.printerName)
        : deviceConfig?.printerName,
    };
  });
  // Paid for, but the exact version isn't among the outlet's current ones — an
  // admin republishing the template between checkout and pickup repoints
  // current_version and the paid id stops matching. Derived rather than set
  // from the effect, and surfaced through the same banner as a print failure
  // so the retry stays reachable. Printing the *new* layout instead would put
  // a wrong-sized render on media the customer already paid for.
  const paidVersionMissing = paidItems.length > 0 && !templatesLoading
    && resolvedItems.some((r) => !r.templateVersion);

  // Print jobs queued this session — printing never blocks the flow above, so
  // outcomes land here asynchronously via the local queue's 'printjob:done'
  // event, and a failed job gets a one-tap reprint (same composed bitmap,
  // no need to redo the whole print flow).
  const [printJobs, setPrintJobs] = useState([]);
  useEffect(() => {
    function onJobDone(e) {
      const { jobId, status } = e.detail;
      setPrintJobs((jobs) => jobs.map((j) => (j.jobId === jobId ? { ...j, status } : j)));
    }
    window.addEventListener('printjob:done', onJobDone);
    return () => window.removeEventListener('printjob:done', onJobDone);
  }, []);

  function handleQueuedJobs(jobs) {
    setPrintJobs((cur) => [...cur, ...jobs.map((j) => ({ ...j, status: 'queued' }))]);
  }

  // Print add-on paid for upfront at checkout — auto-compose and queue it,
  // no second payment/button. Safe to re-run (remount, reload, manual retry
  // below): createPrintJob is idempotent on (transaction_id,
  // template_version_id, first photo), and enqueuePrint dedupes on jobId, so
  // this can never double-print or double-charge.
  const [addonPrintError, setAddonPrintError] = useState('');
  const [addonPrintAttempt, setAddonPrintAttempt] = useState(0);
  useEffect(() => {
    const printable = resolvedItems.filter((r) => r.templateVersion);
    if (printable.length === 0) return;
    let cancelled = false;

    (async () => {
      setAddonPrintError('');
      try {
        const tokens = {
          outlet_name: deviceConfig?.outlet?.name ?? '',
          download_url: `${DOWNLOAD_BASE}/myphotos/${order.download_token ?? order.trx_code}`,
        };
        // Sequential, not Promise.all: these are physical print jobs on
        // (possibly) one device, and the local queue is what serialises them.
        // Firing every compose at once just spikes memory on a kiosk PC.
        for (const { item, templateVersion: version, printerName } of printable) {
          const itemPhotos = item.photo_ids
            .map((pid) => selectedPhotos.find((p) => p.photo_id === pid))
            .filter(Boolean);
          if (itemPhotos.length === 0) continue;

          const rawSrcs = await Promise.all(itemPhotos.map((p) => {
            // The customer's per-photo choice, recorded at checkout. Absent
            // (older orders, older kiosk builds) falls back to the implicit
            // rule those prints were made under: edited when one exists.
            const chosen = item.photo_sources?.[p.photo_id]
              ?? (photoEdits[p.id]?.dataUrl ? 'edited' : 'original');
            return resolvePrintSource(p, chosen, photoEdits);
          }));
          const finalDataUrl = await composePrintImage(version, rawSrcs, tokens);
          const job = await createPrintJob({
            transactionId: order.id,
            outletId,
            templateVersionId: version.id,
            photoIds: itemPhotos.map((p) => p.photo_id),
            copies: item.copies,
          });
          if (cancelled) return;
          enqueuePrint({ jobId: job.id, printerName, dataUrl: finalDataUrl, copies: item.copies });
          handleQueuedJobs([{ jobId: job.id, printerName, dataUrl: finalDataUrl, copies: item.copies }]);
        }
      } catch (err) {
        if (!cancelled) setAddonPrintError(err.message);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.print_items, order?.print_addon, templatesLoading, addonPrintAttempt]);

  // True from the moment a paid print exists until its paper is actually out.
  // Starts true before the job is even created (printJobs is still empty then)
  // — the compose+create round trip is exactly when an early reset would be
  // most damaging, since nothing has printed yet. A failed/unresolvable print
  // clears it: the error banner has its own retry, and holding the kiosk for
  // seven minutes over paper that is never coming just blocks the queue.
  const printPending = paidItems.length > 0
    && !paidVersionMissing
    && !addonPrintError
    && !printJobs.some((j) => j.status === 'printed');

  // Printing outranks the post-receipt shortening, so this lives in its own
  // effect rather than inside handlePrintReceipt: the receipt normally prints
  // first, and whichever of the two finishes last should own the remaining time.
  useEffect(() => {
    resetWindowRef.current = printPending
      ? AUTO_RESET_PRINTING_MS
      : (receiptPrintedRef.current ? AUTO_RESET_PRINTED_MS : AUTO_RESET_IDLE_MS);
    setResetAt(Date.now() + resetWindowRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printPending]);

  async function handleReprint(job) {
    setPrintJobs((jobs) => jobs.map((j) => (j.jobId === job.jobId ? { ...j, status: 'queued' } : j)));
    try {
      const newJob = await reprintPrintJob(job.jobId);
      enqueuePrint({ jobId: newJob.id, printerName: job.printerName, dataUrl: job.dataUrl, copies: job.copies });
      setPrintJobs((jobs) => jobs.map((j) => (j.jobId === job.jobId ? { ...j, jobId: newJob.id, status: 'queued' } : j)));
    } catch {
      setPrintJobs((jobs) => jobs.map((j) => (j.jobId === job.jobId ? { ...j, status: 'failed' } : j)));
    }
  }

  const failedJobs = printJobs.filter((j) => j.status === 'failed');

  if (!order) {
    navigate('/');
    return null;
  }

  function handleRestart() {
    clearPendingOrder(); // order delivered — no longer needs recovery
    dispatch({ type: 'RESET' });
    navigate('/');
  }

  const isCash = order.cash === true;
  const trxCode = order.trx_code ?? order.orderId ?? '-';
  // Prefer the secure, unguessable download_token; fall back to trx_code so QRs
  // still work if the backend hasn't issued a token (older transactions).
  const downloadToken = order.download_token ?? trxCode;
  const downloadUrl = `${DOWNLOAD_BASE}/myphotos/${downloadToken}`;
  const photos = order.photos ?? selectedPhotos ?? [];
  const finalPrice = order.final_price ?? order.total ?? selectedPhotos?.reduce((s, p) => s + p.price, 0) ?? 0;
  const discount = order.discount_amount ?? 0;

  // The paid print is charged server-side as TransactionPrintAddon.total_price
  // and folded straight into final_price, so a receipt that lists only photos
  // shows a total the customer cannot add up. One list, used by both the
  // on-screen receipt and the thermal one, so they can't drift apart again.
  const addonTotal = paidItems.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  // Per-photo price is missing on some orders; the fallback splits the bill
  // evenly, and must split what was paid for *photos* — not the print too.
  const photoSubtotal = Math.max(0, finalPrice - addonTotal);
  const lineItems = [
    ...photos.map((p, i) => ({
      key: p.id ?? `photo-${i}`,
      name: p.filename ?? p.name ?? t('common.photoN', { n: i + 1 }),
      // Never the stored filename on the thermal roll: names like
      // AhaConvert_IMG_7280.png mean nothing to the customer, and at 58mm they
      // were the one line long enough to force a wrap.
      shortName: t('common.photoN', { n: i + 1 }),
      price: p.price ?? (photos.length ? photoSubtotal / photos.length : 0),
    })),
    // One row per print line, named by product: a 4R and a strip on one bill
    // must not collapse into a single unexplained amount, and two rows reading
    // "Cetak foto - 1 lembar" at different prices reads as a billing error.
    // Falls back to the generic label when the template can't be resolved
    // (republished between checkout and pickup) — a vaguer line is far better
    // than a missing one on something the customer paid for.
    ...resolvedItems.map(({ item, template }, i) => {
      const type = t(template?.printType === 'secondary' ? 'print.typeSecondary' : 'print.typePrimary');
      return {
        key: `print-${i}`,
        name: template
          ? t('download.printLine', { type, n: item.copies })
          : t('download.printItem', { n: item.copies }),
        // Kept narrow deliberately: at 58mm the roll is 48mm printable, and a
        // long item name is the one line that forces a wrap.
        shortName: template
          ? t('download.printLineShort', { type, n: item.copies })
          : t('download.printItem', { n: item.copies }),
        price: item.total_price ?? 0,
      };
    }),
  ];
  const unitName = deviceConfig?.unit?.name ?? order.photos?.[0]?.unit?.name ?? '';
  const outletName = deviceConfig?.outlet?.name ?? '';

  // Receipt printing — a separate, unqueued native print (no backend job to
  // track/retry, unlike paid photo prints): the button itself is the retry.
  const canPrintReceipt = isTauri() && !!deviceConfig?.receiptPrinterName;
  async function handlePrintReceipt() {
    setReceiptStatus('printing');
    try {
      const dataUrl = await composeReceiptImage({
        outletName,
        unitName,
        trxCode,
        date: order.created_at ?? order.paid_at,
        items: lineItems.map((it) => ({ name: it.shortName, price: it.price })),
        discount,
        promoCode: order.promo_code_used,
        total: finalPrice,
        paymentLabel: `${isCash ? t('download.cash') : t('download.qris')}${order.paid ? ` · ${t('download.paid')}` : ''}`,
        downloadUrl,
        // Same number as the on-screen help FAB (Settings → Nomor Bantuan), so
        // staff configure it once and the paper agrees with the screen.
        helpNumber: deviceConfig?.helpNumber,
      });
      await printImage(deviceConfig.receiptPrinterName, dataUrl, 1);
      setReceiptStatus('idle');
      // The printed receipt carries the same download QR, so the customer is
      // no longer dependent on this screen — shorten the wait to free the
      // kiosk for the next person. Unless a photo print is still in flight:
      // they have to stand there for the paper regardless, and the printPending
      // effect above restores the shorter window once it lands.
      receiptPrintedRef.current = true;
      if (!printPending) {
        resetWindowRef.current = AUTO_RESET_PRINTED_MS;
        // Not render-time: this line only runs after `await printImage`, inside
        // a click handler or effect. The compiler reads the whole function as
        // render-phase because of the forward reference flagged above.
        // eslint-disable-next-line react-hooks/purity
        setResetAt(Date.now() + AUTO_RESET_PRINTED_MS);
      }
    } catch {
      setReceiptStatus('fail');
    }
  }

  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;


  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch sm:items-start justify-center w-full max-w-4xl mx-auto py-4 sm:py-8">

      {/* Floating, not inline: this screen scrolls on shorter kiosk panels, and
          a countdown that scrolls out of view is the same as resetting without
          warning. Fixed to the viewport it is unmissable at any scroll offset.
          pointer-events-none so it can never swallow a tap meant for the
          receipt underneath — every tap here restarts the clock. */}
      <div
        className="fixed z-50 pointer-events-none flex flex-col items-center px-8 py-4 rounded-3xl"
        style={{
          top: 24,
          right: 24,
          background: '#fff',
          boxShadow: 'var(--shadow-xl)',
          border: `2px solid ${secondsLeft <= 30 ? 'var(--color-error)' : 'var(--color-neutral-200)'}`,
        }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-neutral-600)' }}>
          {t('download.autoResetLabel')}
        </span>
        <span
          className="text-5xl font-black tabular-nums leading-none mt-1"
          style={{ color: secondsLeft <= 30 ? 'var(--color-error)' : 'var(--color-neutral-900)' }}
        >
          {countdown}
        </span>
      </div>

      {/* ── Left: QR download ── */}
      <div className="flex flex-col items-center gap-5 shrink-0 w-full sm:w-auto">
        <div className="text-center">
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('download.success')}
          </h1>
          <p className="mt-1 text-base" style={{ color: 'var(--color-neutral-600)' }}>
            {t('download.scanInstr')}
          </p>
        </div>

        <div
          className="flex flex-col items-center gap-4 p-6 rounded-3xl"
          style={{
            background: '#fff',
            boxShadow: 'var(--shadow-xl)',
            border: '2px solid var(--color-primary-100)',
            minWidth: 280,
          }}
        >
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary-100)' }}
          >
            <QRCodeSVG value={downloadUrl} size={200} level="H" fgColor="#013F65" />
          </div>

          <p className="font-mono text-xs text-center break-all" style={{ color: 'var(--color-neutral-600)' }}>
            {trxCode}
          </p>

          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            <Clock size={16} /> {t('download.valid24')}
          </div>
        </div>

        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--color-neutral-600)' }}>
          {t('download.cameraInstr')}
        </p>

        {/* Locally-edited photos download */}
        {editedPhotos.length > 0 && (
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: '#fff',
              border: '1.5px solid var(--color-neutral-200)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p className="text-xs font-bold" style={{ color: 'var(--color-neutral-600)' }}>
              {t('download.editedPhotos')}
            </p>
            <div className="flex flex-col gap-2">
              {editedPhotos.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <img
                    src={photoEdits[p.id].dataUrl}
                    alt=""
                    className="rounded-lg object-cover shrink-0"
                    style={{ width: 56, height: 40 }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-neutral-700)' }}>
                    {t('common.photoN', { n: i + 1 })}
                  </span>
                  <button
                    onClick={() => downloadDataUrl(photoEdits[p.id].dataUrl, `edited_photo_${i + 1}.jpg`)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1"
                    style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                  >
                    <DownloadIcon size={14} /> {t('download.save')}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                editedPhotos.forEach((p, i) => {
                  setTimeout(() => downloadDataUrl(photoEdits[p.id].dataUrl, `edited_photo_${i + 1}.jpg`), i * 300);
                });
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              <DownloadIcon size={16} /> {t('download.downloadAll', { count: editedPhotos.length })}
            </button>
          </div>
        )}

        {/* Held above the error/receipt blocks: while this is up the kiosk is
            deliberately not resetting, and the customer needs to know the wait
            is the printer, not a stuck screen. */}
        {printPending && (
          <div
            className="w-full rounded-2xl p-5 flex items-center gap-4"
            style={{ background: 'var(--color-primary-50)', border: '2px solid var(--color-primary)' }}
          >
            <Printer size={32} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="text-lg font-black leading-tight" style={{ color: 'var(--color-primary)' }}>
                {t('print.inProgressTitle')}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-neutral-600)' }}>
                {t('print.inProgressHint')}
              </p>
            </div>
          </div>
        )}

        {paidItems.length > 0 && (addonPrintError || paidVersionMissing) && (
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'var(--color-error-bg)', border: '1.5px solid var(--color-error)' }}
          >
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={16} /> {t('print.addonErr')}
            </p>
            <button
              onClick={() => setAddonPrintAttempt((n) => n + 1)}
              className="w-full py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: '#fff', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}
            >
              <RefreshCw size={14} /> {t('common.retry')}
            </button>
          </div>
        )}

        {canPrintReceipt && (
          <Button
            variant="secondary"
            size="lg"
            onClick={handlePrintReceipt}
            disabled={receiptStatus === 'printing'}
            className="w-full"
          >
            <Printer size={20} /> {receiptStatus === 'printing' ? t('download.printingReceipt') : t('download.printReceipt')}
          </Button>
        )}
        {receiptStatus === 'fail' && (
          <p className="text-xs text-center" style={{ color: 'var(--color-error)' }}>{t('download.receiptFail')}</p>
        )}

        {/* Print jobs that failed after payment already succeeded — reprint
            reuses the already-composed bitmap, no new charge. */}
        {failedJobs.length > 0 && (
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'var(--color-error-bg)', border: '1.5px solid var(--color-error)' }}
          >
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={16} /> {t('print.someFailed', { count: failedJobs.length })}
            </p>
            {failedJobs.map((job) => (
              <button
                key={job.jobId}
                onClick={() => handleReprint(job)}
                className="w-full py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: '#fff', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}
              >
                <RefreshCw size={14} /> {t('print.reprint')}
              </button>
            ))}
          </div>
        )}

        <Button size="xl" onClick={handleRestart} className="w-full">
          {t('download.newTransaction')}
        </Button>
      </div>

      {/* ── Right: Receipt ── */}
      <div
        className="w-full sm:flex-1 rounded-3xl overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: 'var(--shadow-xl)',
          border: '2px solid var(--color-neutral-100)',
          minWidth: 0,
        }}
      >
        {/* Receipt header */}
        <div
          className="px-6 py-5"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <img src={ownizeLogo} alt="Ownize" className="w-10 h-10 object-contain brightness-0 invert" />
            <div>
              <p className="font-black text-xl leading-tight">Ownize AI Studio</p>
              {unitName && (
                <p className="text-sm opacity-80">{unitName}{outletName ? ` — ${outletName}` : ''}</p>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm opacity-80">
            <span>{t('download.code')} <strong className="font-mono text-white opacity-100">{trxCode}</strong></span>
            <span>{formatDate(order.created_at ?? order.paid_at)}</span>
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-neutral-600)' }}>
            {t('download.itemsBought')}
          </p>

          <div className="flex flex-col gap-2">
            {lineItems.length > 0 ? lineItems.map((item, i) => {
              const isPrint = item.key.startsWith('print-');
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                    >
                      {isPrint ? <Printer size={14} /> : i + 1}
                    </div>
                    <span
                      className="text-sm truncate"
                      style={{ color: 'var(--color-neutral-700)' }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-4" style={{ color: 'var(--color-neutral-800)' }}>
                    {formatRp(item.price)}
                  </span>
                </div>
              );
            }) : (
              <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>{t('download.noItems')}</p>
            )}
          </div>

          {/* Totals */}
          <div className="mt-4 flex flex-col gap-1.5">
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-neutral-600)' }}>{t('download.discount')}</span>
                <span style={{ color: 'var(--color-success)' }}>- {formatRp(discount)}</span>
              </div>
            )}
            {order.promo_code_used && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-neutral-600)' }}>{t('download.promoCode')}</span>
                <span className="font-mono" style={{ color: 'var(--color-neutral-700)' }}>{order.promo_code_used}</span>
              </div>
            )}
            <div
              className="flex justify-between items-center pt-3 mt-1"
              style={{ borderTop: '2px dashed var(--color-neutral-200)' }}
            >
              <span className="font-bold text-base" style={{ color: 'var(--color-neutral-900)' }}>{t('common.total')}</span>
              <span className="font-black text-xl" style={{ color: 'var(--color-primary)' }}>
                {formatRp(finalPrice)}
              </span>
            </div>
          </div>

          {/* Payment method badge */}
          <div className="mt-4 flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              style={{
                background: isCash ? 'var(--color-warning-bg)' : 'var(--color-primary-50)',
                color: isCash ? 'var(--color-warning)' : 'var(--color-primary)',
              }}
            >
              {isCash ? <Banknote size={14} /> : <Smartphone size={14} />}
              {isCash ? t('download.cash') : t('download.qris')}
            </span>
            {order.paid && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              >
                <Check size={14} strokeWidth={3} /> {t('download.paid')}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 text-center text-xs"
          style={{ background: 'var(--color-neutral-50)', color: 'var(--color-neutral-600)', borderTop: '1px solid var(--color-neutral-100)' }}
        >
          {t('download.thanks')}
        </div>
      </div>

    </div>
  );
}
