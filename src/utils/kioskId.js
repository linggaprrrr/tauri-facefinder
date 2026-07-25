// Stable per-install identifier for this kiosk, used to upsert its row in the
// backend's kiosk_printers table. Generated once, then persisted — a fresh
// install (or a cleared profile) just gets a new id, which is fine since it's
// not tied to any user account.
const STORAGE_KEY = 'ff_kiosk_id';

export function getKioskId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
