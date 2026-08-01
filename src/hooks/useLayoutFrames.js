import { useState, useEffect } from 'react';
import { getLayoutFrames } from '../api/mockApi';
import { readCache, writeCache, registerMemCache } from '../utils/assetCache';

const memCache = {};
// Cleared by the Settings sync — a localStorage wipe alone would leave this
// session still serving the old copy.
registerMemCache(() => { Object.keys(memCache).forEach((k) => delete memCache[k]); });

function normalize(frame) {
  return {
    id: frame.id,
    label: frame.label,
    type: frame.type ?? 'layout',
    src: frame.src,
    slotCount: frame.slot_count ?? frame.slotCount,
    aspectRatio: frame.aspect_ratio ?? frame.aspectRatio,
    slots: frame.slots ?? [],
    outlet_id: frame.outlet_id ?? null,
    is_active: frame.is_active ?? true,
  };
}

export function useLayoutFrames(outletId) {
  const cacheKey = outletId ?? '__global__';
  const lsKey = `frames_${cacheKey}`;
  // localStorage survives reloads; memCache avoids re-reads within a session.
  // Cached data is already normalized, so it can be used as-is.
  const persisted = memCache[cacheKey] ?? readCache(lsKey); // { data, etag } | array | null
  const persistedData = Array.isArray(persisted) ? persisted : persisted?.data;

  const [layoutFrames, setLayoutFrames] = useState(persistedData ?? []);
  const [loading, setLoading] = useState(!persistedData);

  useEffect(() => {
    let cancelled = false;
    // `loading` already initializes to true when no cached data exists.
    getLayoutFrames(outletId, persisted?.etag ?? null)
      .then((result) => {
        if (cancelled || result.unchanged) return; // 304 — cached copy still valid
        const resolved = result.data.map(normalize);
        memCache[cacheKey] = { data: resolved, etag: result.etag };
        writeCache(lsKey, { data: resolved, etag: result.etag });
        setLayoutFrames(resolved);
      })
      .catch(() => {
        if (!cancelled && !persistedData) setLayoutFrames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { layoutFrames, loading };
}
