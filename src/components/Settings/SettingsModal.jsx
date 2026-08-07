import { useState, useEffect } from 'react';
import { Check, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { getPrintStock } from '../../utils/heartbeat';
import { getUnits, getOutletsByUnit } from '../../api/mockApi';
import { clearAssetCache } from '../../utils/assetCache';
import PrinterStatus from './PrinterStatus';
import Modal from '../common/Modal';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { isTauri, listPrinters, printImage, makeTestImageDataUrl } from '../../native/print';
import { usePrintSetting } from '../../hooks/usePrintSetting';
import { usePrintTemplates } from '../../hooks/usePrintTemplates';
import { printAddonStatus } from '../../utils/printAddonStatus';
import { usePrinterHealth } from '../../hooks/usePrinterHealth';
import { getOldestQueuedAgeMs, getQueuedCount } from '../../utils/printQueue';
import PinPad from './PinPad';

// forced=true: no close button, no backdrop dismiss, skip auth step (first-run setup)
export default function SettingsModal({ onClose, forced = false }) {
  const { state, dispatch } = useApp();
  const { t } = useLang();

  // Skip auth on first-run forced setup; require it when admin manually opens settings
  const [step, setStep] = useState(forced ? 'config' : 'auth');
  // Snapshot from the last heartbeat, read once on open — no fetch of its own.
  const printStock = getPrintStock();

  const [units, setUnits] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(state.deviceConfig.unit);
  const [selectedOutlet, setSelectedOutlet] = useState(state.deviceConfig.outlet);
  const [helpNumber, setHelpNumber] = useState(state.deviceConfig.helpNumber ?? '');

  // Diagnostic only — keyed off the SAVED outlet, so it reports what customers
  // are actually seeing rather than what an unsaved edit on this screen would
  // produce. Same hooks the Cart uses, so it can't disagree with the real gate.
  const savedOutletId = state.deviceConfig.outlet?.id;
  const { setting: livePrintSetting, loading: livePrintSettingLoading } = usePrintSetting(savedOutletId);
  const { printTemplates: liveTemplates } = usePrintTemplates(savedOutletId);
  const livePrinterHealth = usePrinterHealth(state.deviceConfig ?? {});
  // Read once on open — same rationale as printStock above. A job older than
  // this has stopped being "printing" and started being "stuck"; on Windows the
  // usual cause is a wedged spooler, which leaves the printer looking online.
  const STALL_MS = 10 * 60 * 1000;
  const queueAgeMs = getOldestQueuedAgeMs();
  const queueStalled = queueAgeMs != null && queueAgeMs >= STALL_MS;
  const addonStatus = printAddonStatus({
    deviceConfig: state.deviceConfig,
    printSetting: livePrintSetting,
    printSettingLoading: livePrintSettingLoading,
    printTemplates: liveTemplates,
    printerHealth: livePrinterHealth,
    printStock,
  });

  // Printing (kiosk/.exe only — native silent print)
  const [printEnabled, setPrintEnabled] = useState(!!state.deviceConfig.printEnabled);
  const [printerName, setPrinterName] = useState(state.deviceConfig.printerName ?? '');
  const [printers, setPrinters] = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [testMsg, setTestMsg] = useState(null); // null | 'sent' | 'fail'
  const [testing, setTesting] = useState(false);
  // Optional second photo printer, used for the outlet's strip template.
  const [secondaryPrinterName, setSecondaryPrinterName] = useState(state.deviceConfig.secondaryPrinterName ?? '');
  const [secondaryTestMsg, setSecondaryTestMsg] = useState(null);
  const [secondaryTesting, setSecondaryTesting] = useState(false);

  // Receipt printing — a separate physical printer (thermal) from the photo
  // printer above, so its own picker/test controls, independent of printEnabled
  // (that toggle is the outlet's paid-photo-print business setting, not this).
  const [receiptPrinterName, setReceiptPrinterName] = useState(state.deviceConfig.receiptPrinterName ?? '');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(!!state.deviceConfig.autoPrintReceipt);
  const [receiptTestMsg, setReceiptTestMsg] = useState(null);
  const [receiptTesting, setReceiptTesting] = useState(false);

  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load units when config step first mounts
  useState(() => {
    if (forced) fetchUnits();
  });

  function handleAuthSuccess() {
    setStep('config');
    fetchUnits();
  }

  async function fetchUnits() {
    setLoadingUnits(true);
    setError('');
    try {
      const data = await getUnits();
      setUnits(data);
      if (selectedUnit) fetchOutlets(selectedUnit.id);
    } catch {
      setError(t('settings.errUnits'));
    } finally {
      setLoadingUnits(false);
    }
  }

  async function fetchOutlets(unitId) {
    setLoadingOutlets(true);
    setOutlets([]);
    setError('');
    try {
      const data = await getOutletsByUnit(unitId, { isKiosk: true });
      setOutlets(data);
    } catch {
      setError(t('settings.errOutlets'));
    } finally {
      setLoadingOutlets(false);
    }
  }

  function handleUnitChange(e) {
    const unit = units.find((u) => u.id === e.target.value) ?? null;
    setSelectedUnit(unit);
    setSelectedOutlet(null);
    if (unit) fetchOutlets(unit.id);
  }

  function handleOutletChange(e) {
    const outlet = outlets.find((o) => o.id === e.target.value) ?? null;
    setSelectedOutlet(outlet);
  }

  // Load printers when the config step is open in the kiosk app.
  useEffect(() => {
    if (step !== 'config' || !isTauri()) return;
    let cancelled = false;
    const run = async () => {
      setPrintersLoading(true);
      const list = await listPrinters();
      if (cancelled) return;
      setPrinters(list);
      setPrintersLoading(false);
    };
    const id = setTimeout(run, 0); // defer out of effect body (sync setState)
    return () => { cancelled = true; clearTimeout(id); };
  }, [step]);

  async function testPrinter(name, setBusy, setMsg) {
    setBusy(true);
    setMsg(null);
    try {
      await printImage(name, makeTestImageDataUrl(), 1);
      setMsg('sent');
    } catch {
      setMsg('fail');
    } finally {
      setBusy(false);
    }
  }
  const handleTestPrint = () => testPrinter(printerName, setTesting, setTestMsg);
  const handleTestReceiptPrint = () => testPrinter(receiptPrinterName, setReceiptTesting, setReceiptTestMsg);
  const handleSecondaryTestPrint = () => testPrinter(secondaryPrinterName, setSecondaryTesting, setSecondaryTestMsg);

  // Settings saved the display name until the system_name fix, so a config
  // written by an older build still holds one. Match either way rather than
  // showing no status for a printer that is in fact selected.
  const findPrinter = (n) => (
    n ? printers.find((p) => p.system_name === n) ?? printers.find((p) => p.name === n) : undefined
  );

  // No reload: staff are usually mid-task in here, and restarting the app
  // under them (dropping any in-progress customer session) is a heavy price
  // for refreshing content. clearAssetCache() drops both the localStorage
  // copies and the hooks' in-memory ones, so each screen refetches the next
  // time it mounts — the editor picks up new stickers/frames when it is next
  // opened. Branding is the exception: it is applied once at boot, so a
  // colour or banner change still lands on the next restart.
  function handleSync() {
    setSyncing(true);
    const cleared = clearAssetCache();
    setSyncing(false);
    setSyncedCount(cleared);
    setTimeout(() => setSyncedCount(null), 4000);
  }

  async function handleSave() {
    if (!selectedUnit || !selectedOutlet) return;
    setSaving(true);
    dispatch({ type: 'SET_DEVICE_CONFIG', payload: { unit: selectedUnit, outlet: selectedOutlet, helpNumber, printEnabled, printerName, secondaryPrinterName, receiptPrinterName, autoPrintReceipt } });
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }

  const canSave = selectedUnit && selectedOutlet && !saving;

  return (
    /* dismissable={!forced} is the whole first-run guarantee in one prop: it
       drops the close button, and — because Modal swallows the native dialog
       `cancel` event — also blocks Escape and the backdrop. The old overlay
       only guarded the backdrop click, so Escape walked straight out of
       first-run setup into an unconfigured kiosk. */
    <Modal
      onClose={onClose}
      size="md"
      dismissable={!forced}
      title={
        <>
          {forced ? t('settings.firstSetup') : t('settings.title')}
          {state.deviceConfig.outlet?.name && (
            <span className="block text-xs font-medium opacity-80">
              {state.deviceConfig.outlet.name}
            </span>
          )}
        </>
      }
    >
        {forced && (
          <div
            className="px-6 pt-4 text-sm"
            style={{ color: 'var(--color-neutral-600)' }}
          >
            {t('settings.firstHint')}
          </div>
        )}

        <div className="px-6 py-6">
          {/* ── Step 1: Auth ── */}
          {step === 'auth' && (
            <PinPad
              outletId={state.deviceConfig.outlet?.id}
              onSuccess={handleAuthSuccess}
            />
          )}

          {/* ── Step 2: Config ── */}
          {step === 'config' && (
            <div className="flex flex-col gap-5">
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--color-error-50)', color: 'var(--color-error)' }}>
                  {error}
                </p>
              )}

              {/* Unit selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  {t('settings.unit')}
                </label>
                {loadingUnits ? (
                  <div className="text-sm py-2" style={{ color: 'var(--color-neutral-600)' }}>{t('settings.loadingUnits')}</div>
                ) : (
                  <select
                    value={selectedUnit?.id ?? ''}
                    onChange={handleUnitChange}
                    className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                    style={{
                      borderColor: 'var(--color-neutral-300)',
                      '--tw-ring-color': 'var(--color-primary)',
                    }}
                  >
                    <option value="">{t('settings.selectUnit')}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {selectedUnit && (
                  <p className="text-xs" style={{ color: 'var(--color-neutral-600)' }}>{selectedUnit.location}</p>
                )}
              </div>

              {/* Outlet selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  {t('settings.outlet')}
                </label>
                {loadingOutlets ? (
                  <div className="text-sm py-2" style={{ color: 'var(--color-neutral-600)' }}>{t('settings.loadingOutlets')}</div>
                ) : (
                  <select
                    value={selectedOutlet?.id ?? ''}
                    onChange={handleOutletChange}
                    disabled={!selectedUnit || outlets.length === 0}
                    className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2 disabled:opacity-50"
                    style={{
                      borderColor: 'var(--color-neutral-300)',
                      '--tw-ring-color': 'var(--color-primary)',
                    }}
                  >
                    <option value="">
                      {!selectedUnit ? t('settings.selectUnitFirst') : outlets.length === 0 ? t('settings.noOutlet') : t('settings.selectOutlet')}
                    </option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Help number */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                  {t('settings.helpNumber')}
                </label>
                <input
                  type="text"
                  placeholder={t('settings.helpPlaceholder')}
                  value={helpNumber}
                  onChange={(e) => setHelpNumber(e.target.value)}
                  className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--color-neutral-300)',
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                />
              </div>

              {/* ── Printing (kiosk app only) ── */}
              {isTauri() && (
                <div className="flex flex-col gap-2 pt-1" style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                  <div className="flex items-center justify-between pt-3">
                    <label className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--color-neutral-700)' }}>
                      <Printer size={16} /> {t('settings.printSection')}
                    </label>
                    {/* toggle */}
                    <button
                      type="button"
                      onClick={() => setPrintEnabled((v) => !v)}
                      role="switch"
                      aria-checked={printEnabled}
                      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                      style={{ background: printEnabled ? 'var(--color-primary)' : 'var(--color-neutral-300)' }}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                        style={{ left: printEnabled ? 22 : 2 }}
                      />
                    </button>
                  </div>

                  {printEnabled && (
                    <>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="text-xs font-medium" style={{ color: 'var(--color-neutral-600)' }}>
                            {t('settings.printer')}
                          </label>
                          <select
                            value={printerName}
                            onChange={(e) => { setPrinterName(e.target.value); setTestMsg(null); }}
                            className="border rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:ring-2"
                            style={{ borderColor: 'var(--color-neutral-300)', '--tw-ring-color': 'var(--color-primary)' }}
                          >
                            <option value="">
                              {printersLoading ? '…' : printers.length === 0 ? t('settings.noPrinters') : t('settings.selectPrinter')}
                            </option>
                            {printers.map((p) => (
                              <option key={p.system_name} value={p.system_name}>
                                {p.name}{p.is_default ? ' (default)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setPrintersLoading(true); listPrinters().then(setPrinters).finally(() => setPrintersLoading(false)); }}
                          title={t('settings.refreshPrinters')}
                          aria-label={t('settings.refreshPrinters')}
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
                        >
                          <RefreshCw size={16} className={printersLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      {printerName && (
                        <PrinterStatus state={findPrinter(printerName)?.state} />
                      )}

                      {queueStalled && (
                        <div
                          className="rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs font-medium"
                          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                        >
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>
                            {t('settings.printStalled', {
                              n: getQueuedCount(),
                              mins: Math.floor(queueAgeMs / 60000),
                            })}
                          </span>
                        </div>
                      )}

                      {/* Why customers are (or aren't) being offered prints.
                          Reads the saved config and live outlet settings, not
                          this form's pending state — it answers "what is the
                          kiosk doing right now", which is the question staff
                          have when the checkout checkbox is missing and every
                          field on this screen looks correct. */}
                      <div
                        className="rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs font-medium"
                        style={{
                          background: addonStatus.ok ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                          color: addonStatus.ok ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      >
                        {addonStatus.ok
                          ? <Check size={14} className="shrink-0 mt-0.5" />
                          : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                        <span>
                          {addonStatus.ok
                            ? t('settings.printReady')
                            : t(`settings.printBlocked.${addonStatus.reason}`, { label: addonStatus.label ?? '' })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestPrint}
                        disabled={!printerName || testing}
                        className="text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                      >
                        {testing ? '…' : t('settings.testPrint')}
                      </button>
                      {testMsg && (
                        <p className="text-xs text-center" style={{ color: testMsg === 'sent' ? 'var(--color-success)' : 'var(--color-error)' }}>
                          {t(testMsg === 'sent' ? 'settings.testPrintSent' : 'settings.testPrintFail')}
                        </p>
                      )}

                      {/* Secondary printer — for the outlet's strip template.
                          Optional: left unset, strips print on the primary,
                          which is how every existing single-printer outlet
                          already works. */}
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--color-neutral-600)' }}>
                          {t('settings.secondaryPrinter')}
                        </label>
                        <select
                          value={secondaryPrinterName}
                          onChange={(e) => { setSecondaryPrinterName(e.target.value); setSecondaryTestMsg(null); }}
                          className="border rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:ring-2"
                          style={{ borderColor: 'var(--color-neutral-300)', '--tw-ring-color': 'var(--color-primary)' }}
                        >
                          <option value="">{t('settings.secondaryPrinterNone')}</option>
                          {printers.map((p) => (
                            <option key={p.system_name} value={p.system_name}>
                              {p.name}{p.is_default ? ' (default)' : ''}
                            </option>
                          ))}
                        </select>
                        {secondaryPrinterName && (
                          <PrinterStatus state={findPrinter(secondaryPrinterName)?.state} />
                        )}
                        {secondaryPrinterName && (
                          <button
                            type="button"
                            onClick={handleSecondaryTestPrint}
                            disabled={secondaryTesting}
                            className="text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
                            style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                          >
                            {secondaryTesting ? '…' : t('settings.testPrint')}
                          </button>
                        )}
                        {secondaryTestMsg && (
                          <p className="text-xs text-center" style={{ color: secondaryTestMsg === 'sent' ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {t(secondaryTestMsg === 'sent' ? 'settings.testPrintSent' : 'settings.testPrintFail')}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Print stock — staff-facing only, behind the PIN. A
                      customer mid-purchase must never see "low on paper". */}
                  {printStock && (
                    <div
                      className="flex flex-col gap-1.5 p-3 rounded-lg mt-1"
                      style={{
                        background: printStock.low ? 'var(--color-warning-bg)' : 'var(--color-neutral-50)',
                        border: `1.5px solid ${printStock.low ? 'var(--color-warning)' : 'var(--color-neutral-200)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: printStock.low ? 'var(--color-warning)' : 'var(--color-neutral-600)' }}>
                          {printStock.low && <AlertTriangle size={14} />} {t('settings.printStock')}
                        </span>
                        <span className="text-sm font-black" style={{ color: printStock.low ? 'var(--color-warning)' : 'var(--color-neutral-800)' }}>
                          {printStock.remaining}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-neutral-600)' }}>
                        <span>{t('settings.stockInitial')}: {printStock.initial}</span>
                        <span>{t('settings.stockPrinted')}: {printStock.printed}</span>
                      </div>
                      {printStock.low && (
                        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>{t('settings.stockLowHint')}</p>
                      )}
                    </div>
                  )}

                  {/* ── Receipt printer (thermal, separate device) ── */}
                  <div className="flex flex-col gap-2 pt-3 mt-1" style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                    <label className="font-semibold text-sm flex items-center gap-1.5" style={{ color: 'var(--color-neutral-700)' }}>
                      <Printer size={16} /> {t('settings.receiptPrinter')}
                    </label>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <select
                          value={receiptPrinterName}
                          onChange={(e) => { setReceiptPrinterName(e.target.value); setReceiptTestMsg(null); }}
                          className="border rounded-lg px-3 py-2.5 text-sm w-full outline-none focus:ring-2"
                          style={{ borderColor: 'var(--color-neutral-300)', '--tw-ring-color': 'var(--color-primary)' }}
                        >
                          <option value="">
                            {printersLoading ? '…' : printers.length === 0 ? t('settings.noPrinters') : t('settings.selectPrinter')}
                          </option>
                          {printers.map((p) => (
                            <option key={p.system_name} value={p.system_name}>
                              {p.name}{p.is_default ? ' (default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPrintersLoading(true); listPrinters().then(setPrinters).finally(() => setPrintersLoading(false)); }}
                        title={t('settings.refreshPrinters')}
                        aria-label={t('settings.refreshPrinters')}
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
                      >
                        <RefreshCw size={16} className={printersLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    {receiptPrinterName && (
                      <PrinterStatus state={findPrinter(receiptPrinterName)?.state} />
                    )}

                    <button
                      type="button"
                      onClick={handleTestReceiptPrint}
                      disabled={!receiptPrinterName || receiptTesting}
                      className="text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
                      style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                    >
                      {receiptTesting ? '…' : t('settings.testPrint')}
                    </button>
                    {receiptTestMsg && (
                      <p className="text-xs text-center" style={{ color: receiptTestMsg === 'sent' ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {t(receiptTestMsg === 'sent' ? 'settings.testPrintSent' : 'settings.testPrintFail')}
                      </p>
                    )}

                    {/* Only meaningful once a receipt printer is paired. */}
                    {receiptPrinterName && (
                      <label className="flex items-start gap-2.5 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={autoPrintReceipt}
                          onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                          className="mt-0.5 w-4 h-4 shrink-0"
                        />
                        <span className="flex flex-col">
                          <span className="text-sm font-medium" style={{ color: 'var(--color-neutral-700)' }}>
                            {t('settings.autoPrintReceipt')}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-neutral-600)' }}>
                            {t('settings.autoPrintReceiptHint')}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Current saved info (only when editing, not forced) */}
              {!forced && state.deviceConfig.unit && state.deviceConfig.outlet && (
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                >
                  {t('settings.saved')} <strong>{state.deviceConfig.unit.name}</strong> / <strong>{state.deviceConfig.outlet.name}</strong>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn-primary w-full py-3 rounded-lg font-semibold text-base disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saved ? <>{t('settings.savedBtn')} <Check size={18} strokeWidth={3} /></> : saving ? t('settings.saving') : t('settings.saveBtn')}
              </button>

              {/* Sync — content is cached at boot, so without this an admin
                  change only lands on the next power cycle. */}
              {!forced && (
                <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm" style={{ color: 'var(--color-neutral-700)' }}>
                      {t('settings.syncTitle')}
                    </span>
                    <span className="text-xs leading-relaxed" style={{ color: 'var(--color-neutral-600)' }}>
                      {t('settings.syncHint')}
                    </span>
                  </div>

                  {syncedCount !== null && (
                    <p
                      className="text-xs font-semibold flex items-center gap-1.5"
                      style={{ color: 'var(--color-success)' }}
                    >
                      <Check size={14} strokeWidth={3} /> {t('settings.syncDone')}
                    </p>
                  )}

                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
                  >
                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? t('settings.syncing') : t('settings.syncBtn')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
    </Modal>
  );
}
