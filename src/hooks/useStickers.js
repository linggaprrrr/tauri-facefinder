import { useState, useEffect } from 'react';
import { getStickers } from '../api/mockApi';
import { readCache, writeCache, registerMemCache } from '../utils/assetCache';

const FALLBACK = [
  { id: 's1',  type: 'emoji', value: '😂', label: 'LOL' },
  { id: 's2',  type: 'emoji', value: '❤️', label: 'Love' },
  { id: 's3',  type: 'emoji', value: '🌟', label: 'Star' },
  { id: 's4',  type: 'emoji', value: '🎉', label: 'Party' },
  { id: 's5',  type: 'emoji', value: '🔥', label: 'Fire' },
  { id: 's6',  type: 'emoji', value: '🌈', label: 'Rainbow' },
  { id: 's7',  type: 'emoji', value: '🦋', label: 'Butterfly' },
  { id: 's8',  type: 'emoji', value: '🌸', label: 'Flower' },
  { id: 's9',  type: 'emoji', value: '🐶', label: 'Dog' },
  { id: 's10', type: 'emoji', value: '🎈', label: 'Balloon' },
  { id: 's11', type: 'emoji', value: '🍕', label: 'Pizza' },
  { id: 's12', type: 'emoji', value: '☀️', label: 'Sun' },
];

const memCache = {};
// Cleared by the Settings sync — a localStorage wipe alone would leave this
// session still serving the old copy.
registerMemCache(() => { Object.keys(memCache).forEach((k) => delete memCache[k]); });

export function useStickers(outletId) {
  const cacheKey = outletId ?? '__global__';
  const lsKey = `stickers_${cacheKey}`;
  // localStorage survives reloads; memCache avoids re-reads within a session.
  const persisted = memCache[cacheKey] ?? readCache(lsKey); // { data, etag } | array | null
  const persistedData = Array.isArray(persisted) ? persisted : persisted?.data;

  const [stickers, setStickers] = useState(persistedData ?? FALLBACK);
  const [loading, setLoading] = useState(!persistedData);

  useEffect(() => {
    let cancelled = false;
    // `loading` already initializes to true when no cached data exists.
    getStickers(outletId, persisted?.etag ?? null)
      .then((result) => {
        if (cancelled || result.unchanged) return; // 304 — cached copy still valid
        const resolved = result.data.length > 0 ? result.data : FALLBACK;
        memCache[cacheKey] = { data: resolved, etag: result.etag };
        writeCache(lsKey, { data: resolved, etag: result.etag });
        setStickers(resolved);
      })
      .catch(() => {
        if (!cancelled && !persistedData) setStickers(FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { stickers, loading };
}
