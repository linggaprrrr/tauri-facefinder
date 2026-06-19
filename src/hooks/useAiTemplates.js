import { useState, useEffect } from 'react';
import { getAiTemplates } from '../api/mockApi';
import { readCache, writeCache } from '../utils/assetCache';

const memCache = {};

export function useAiTemplates(outletId) {
  const cacheKey = outletId ?? '__global__';
  const lsKey = `ai_templates_${cacheKey}`;
  const persisted = memCache[cacheKey] ?? readCache(lsKey);
  const persistedData = Array.isArray(persisted) ? persisted : persisted?.data;

  const [templates, setTemplates] = useState(persistedData ?? []);
  const [loading, setLoading] = useState(!persistedData);

  useEffect(() => {
    let cancelled = false;
    getAiTemplates(outletId, persisted?.etag ?? null)
      .then((result) => {
        if (cancelled || result.unchanged) return;
        memCache[cacheKey] = { data: result.data, etag: result.etag };
        writeCache(lsKey, { data: result.data, etag: result.etag });
        setTemplates(result.data);
      })
      .catch(() => { /* keep whatever was cached */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { templates, loading };
}
