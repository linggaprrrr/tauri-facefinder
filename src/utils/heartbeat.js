// Periodic kiosk-printer heartbeat — lets the admin fleet view (kiosk-fleet
// page) see which kiosks are online, which printer they're paired with, and
// their app version. Best-effort: never throws, never blocks the kiosk UI.
import { getVersion } from '@tauri-apps/api/app';
import { listPrinters } from '../native/print';
import { sendKioskHeartbeat } from '../api/mockApi';
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

async function sendHeartbeat(deviceConfig) {
  if (!deviceConfig?.outlet) return;
  const { printerName } = deviceConfig;
  if (!printerName) return; // no printer configured yet — nothing meaningful to report

  const printers = await listPrinters();
  const printerStatus = printers.some((p) => p.name === printerName) ? 'online' : 'offline';

  const res = await sendKioskHeartbeat({
    kioskId: getKioskId(),
    outletId: deviceConfig.outlet.id,
    printerName,
    printerStatus,
    appVersion: await resolveAppVersion(),
  }).catch(() => null);

  if (res?.stock) lastStock = res.stock.initial === null ? null : res.stock;
}

// Fires once immediately, then every 5 minutes. Returns a cleanup fn.
// Caller is responsible for the isTauri() gate (see App.jsx), matching
// resumePrintQueue()'s convention.
export function startHeartbeat(deviceConfig) {
  sendHeartbeat(deviceConfig);
  const id = setInterval(() => sendHeartbeat(deviceConfig), INTERVAL_MS);
  return () => clearInterval(id);
}
