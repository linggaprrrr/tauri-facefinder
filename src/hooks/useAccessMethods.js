import { useState, useEffect } from 'react';
import { getOutletAccessMethods } from '../api/mockApi';
import { readCache, writeCache } from '../utils/assetCache';
import { ACCESS_METHODS } from '../access/registry';
import { isTauri } from '../native/print';

const memCache = {};
const QRIS_ONLY = [{ method_key: 'qris', enabled: true, sort_order: 0, is_default: true }];

// A 'scanner' HID device can't be feature-detected the way a camera can (it
// just looks like keyboard input) — the only real, checkable signal we have
// is "is this the Tauri kiosk app" vs. "is this a customer's own phone on
// the mobile-web QR variant" (which definitionally has no scanner attached).
function supported(method) {
  return !method.supportedOn?.includes('scanner') || isTauri();
}

// Merges server config (enabled/order/badge/copy overrides) with the client
// registry (icon/runner) and drops anything the client doesn't recognize or
// this client can't actually run — a method configured server-side that a
// not-yet-updated kiosk build doesn't know about, or that needs hardware
// this client doesn't have, is silently skipped, not a crash.
function merge(configs) {
  return configs
    .filter((c) => c.enabled && ACCESS_METHODS[c.method_key])
    .map((c) => ({ ...ACCESS_METHODS[c.method_key], ...c }))
    .filter(supported)
    .sort((a, b) => a.sort_order - b.sort_order);
}

// Same 3-layer cache as useStickers/useLayoutFrames/usePrintTemplates:
// memCache (session) -> localStorage (ff_asset_*) -> ETag revalidation. On
// total failure (fresh install, backend unreachable, not-yet-migrated
// outlet) this resolves to QRIS-only rather than an empty list, so every
// existing outlet's checkout behaves exactly as it does today.
export function useAccessMethods(outletId) {
  const cacheKey = outletId ?? '__global__';
  const lsKey = `access_methods_${cacheKey}`;
  const persisted = memCache[cacheKey] ?? readCache(lsKey);
  const persistedData = Array.isArray(persisted) ? persisted : persisted?.data;

  const [methods, setMethods] = useState(merge(persistedData ?? QRIS_ONLY));
  const [loading, setLoading] = useState(!!outletId && !persistedData);

  useEffect(() => {
    // No outlet yet — initial state above (QRIS-only, not loading) is already correct.
    if (!outletId) return;
    let cancelled = false;
    getOutletAccessMethods(outletId, persisted?.etag ?? null)
      .then((result) => {
        if (cancelled || result.unchanged) return;
        memCache[cacheKey] = { data: result.data, etag: result.etag };
        writeCache(lsKey, { data: result.data, etag: result.etag });
        setMethods(merge(result.data));
      })
      .catch(() => {
        if (!cancelled && !persistedData) setMethods(merge(QRIS_ONLY));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { methods, loading };
}
