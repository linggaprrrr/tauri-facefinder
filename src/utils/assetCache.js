const PREFIX = 'ff_asset_';

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* quota exceeded — skip silently */ }
}

// Drop every cached server asset (branding, stickers, frames, AI templates,
// access methods, print templates) so the next load refetches. Scoped to the
// PREFIX on purpose: deviceConfig, ff_kiosk_id, lang and the offline PIN all
// live outside it and must survive a sync — wiping the device's own identity
// would turn "refresh content" into "re-do first-run setup".
export function clearAssetCache() {
  try {
    // length/key(i) rather than Object.keys: it's the actual Storage API and
    // doesn't rely on localStorage exposing its entries as enumerable own
    // properties. Collect first — removing while iterating shifts the indices.
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}
