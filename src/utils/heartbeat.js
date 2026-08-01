// Periodic kiosk-printer heartbeat — lets the admin fleet view (kiosk-fleet
// page) see which kiosks are online, which printer they're paired with, and
// their app version. Best-effort: never throws, never blocks the kiosk UI.
import { getVersion } from '@tauri-apps/api/app';
import { listPrinters } from '../native/print';
import { sendKioskHeartbeat } from '../api/mockApi';
import { getOldestQueuedAgeMs, getQueuedCount } from './printQueue';
import { getKioskId } from './kioskId';

const INTERVAL_MS = 5 * 60 * 1000;

async function resolveAppVersion() {
  try {
    return await getVersion();
  } catch {
    // Not running inside Tauri (or the plugin call failed) — no version to report.
    return 'web';
  }
}

// Print stock as of the last successful beat: { initial, printed, remaining,
// threshold, low } or null when the backend says tracking isn't configured (or
// no beat has landed yet). Read by SettingsModal — deliberately staff-facing
// only, since "low on paper" is not something to put in front of a customer
// mid-purchase. The 5-minute beat is precise enough for a consumable that
// depletes one sheet at a time.
let lastStock = null;
export function getPrintStock() {
  return lastStock;
}

// Subscribers are notified when a beat brings new stock numbers, so the shell
// can badge the Settings button the moment media runs low instead of waiting
// for someone to open Settings and look.
const stockListeners = new Set();
export function subscribePrintStock(fn) {
  stockListeners.add(fn);
  return () => stockListeners.delete(fn);
}

// A queue that exists but is paused or offline is not "online" — reporting it
// as such is how a kiosk sits there looking healthy in the fleet view while
// every print silently fails. UNKNOWN is left as online on purpose: it is what
// the crate returns when it simply cannot tell, and a false alarm every 5
// minutes is how staff learn to ignore the indicator.
//
// Exported because the Cart's "can we sell a print" gate must mean exactly the
// same thing by "healthy" as the fleet view does. Two definitions of healthy is
// how a kiosk ends up taking money for a print it can see it cannot produce.
export function printerStatusIn(printers, name) {
  if (!name) return 'offline';
  // Match system_name first: that is what Settings stores and what the OS
  // actually calls the queue. The display-name fallback keeps configs written
  // by older builds reporting correctly instead of flipping to "offline".
  const p = printers.find((x) => x.system_name === name) ?? printers.find((x) => x.name === name);
  if (!p) return 'offline';
  return ['PAUSED', 'OFFLINE'].includes(String(p.state).toUpperCase()) ? 'error' : 'online';
}

async function sendHeartbeat(deviceConfig) {
  if (!deviceConfig?.outlet) return;
  // Beat even with no photo printer configured. Bailing here meant a kiosk
  // running receipts only never registered at all, so it was invisible in the
  // fleet view — exactly the install an admin most needs to see, and the
  // reason a freshly configured kiosk appeared to never show up.
  const { printerName } = deviceConfig;

  const printers = await listPrinters();
  const statusOf = (n) => printerStatusIn(printers, n);

  const printerStatus = statusOf(printerName);

  // The receipt printer is reported separately: it is a different physical
  // device, and a kiosk keeps selling with it down. Sent as null when none is
  // configured, which the fleet view shows as "not set" rather than a fault.
  const { receiptPrinterName, secondaryPrinterName } = deviceConfig;

  const res = await sendKioskHeartbeat({
    kioskId: getKioskId(),
    outletId: deviceConfig.outlet.id,
    printerName,
    printerStatus,
    secondaryPrinterName: secondaryPrinterName || null,
    secondaryPrinterStatus: secondaryPrinterName ? statusOf(secondaryPrinterName) : null,
    receiptPrinterName: receiptPrinterName || null,
    receiptPrinterStatus: receiptPrinterName ? statusOf(receiptPrinterName) : null,
    appVersion: await resolveAppVersion(),
    // A wedged spooler leaves printer_status reading "online" while nothing
    // prints; queue age is the only signal that separates stuck from idle.
    printQueueAgeMs: getOldestQueuedAgeMs(),
    printQueueCount: getQueuedCount(),
  }).catch(() => null);

  if (res?.stock) {
    lastStock = res.stock.initial === null ? null : res.stock;
    stockListeners.forEach((fn) => fn(lastStock));
  }
}

// Fires once immediately, then every 5 minutes. Returns a cleanup fn.
// Caller is responsible for the isTauri() gate (see App.jsx), matching
// resumePrintQueue()'s convention.
export function startHeartbeat(deviceConfig) {
  sendHeartbeat(deviceConfig);
  const id = setInterval(() => sendHeartbeat(deviceConfig), INTERVAL_MS);
  return () => clearInterval(id);
}
