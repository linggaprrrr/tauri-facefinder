// Persists the in-flight transaction so a paid customer is never stranded if
// the kiosk crashes/reboots/loses the screen before they get their photos.
// Payment is webhook-authoritative on the backend, so on next launch we can
// re-check the transaction by id and surface the pickup QR for a paid order.

const KEY = 'pendingOrder';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // matches the 24h pickup window

export function savePendingOrder(order) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...order, createdAt: Date.now(), paid: false }));
  } catch { /* quota / unavailable — non-fatal */ }
}

export function readPendingOrder() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o?.createdAt || Date.now() - o.createdAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function updatePendingOrder(patch) {
  const o = readPendingOrder();
  if (!o) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...o, ...patch }));
  } catch { /* non-fatal */ }
}

export function clearPendingOrder() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* non-fatal */ }
}
