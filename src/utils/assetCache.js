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

// Most asset hooks also keep a module-level memCache that outlives a
// localStorage wipe, so clearing only localStorage would let a sync report
// success while the screen kept showing the old stickers/frames. Each hook
// registers its own clearer here rather than exporting five differently-named
// functions for one caller to import and keep in step.
const memCacheClearers = [];
export function registerMemCache(clear) {
  memCacheClearers.push(clear);
}

// Some state is not a cache that can simply be dropped and re-read on the next
// mount — branding is *applied* to the document at boot, so clearing its cache
// changes nothing that is already on screen. Those consumers subscribe here
// and re-fetch themselves when a sync happens.
const syncListeners = new Set();
export function onAssetSync(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

// Drop every cached server asset (branding, stickers, frames, AI templates,
// access methods, print templates) so the next load refetches. Scoped to the
// PREFIX on purpose: deviceConfig, ff_kiosk_id, lang and the offline PIN all
// live outside it and must survive a sync — wiping the device's own identity
// would turn "refresh content" into "re-do first-run setup".
export function clearAssetCache() {
  memCacheClearers.forEach((clear) => clear());
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
    // After the caches are gone, not before: a listener that re-fetches must
    // not find a stale entry still sitting in localStorage.
    syncListeners.forEach((fn) => fn());
    return keys.length;
  } catch {
    return 0;
  }
}
