import { useState, useEffect } from 'react';
import { getPrintTemplates } from '../api/mockApi';
import { readCache, writeCache } from '../utils/assetCache';

const memCache = {};

function normalize(template) {
  return {
    id: template.id,
    label: template.label,
    paperSize: template.paper_size,
    isGlobal: template.is_global,
    isActive: template.is_active,
    // Rendering config for the currently-published version, or null if the
    // template has never been published — kiosk must treat that as unusable.
    currentVersion: template.current_version ?? null,
  };
}

// Same 3-layer cache pattern as useStickers/useLayoutFrames/useAiTemplates:
// memCache (session) -> localStorage (ff_asset_*) -> ETag revalidation. Any
// publish/rollback on any template assigned to this outlet changes the list
// ETag, so a stale local copy self-heals on the next natural sync.
export function usePrintTemplates(outletId) {
  const cacheKey = outletId ?? '__global__';
  const lsKey = `print_templates_${cacheKey}`;
  const persisted = memCache[cacheKey] ?? readCache(lsKey);
  const persistedData = Array.isArray(persisted) ? persisted : persisted?.data;

  const [printTemplates, setPrintTemplates] = useState(persistedData ?? []);
  const [loading, setLoading] = useState(!persistedData);

  useEffect(() => {
    let cancelled = false;
    getPrintTemplates(outletId, persisted?.etag ?? null)
      .then((result) => {
        if (cancelled || result.unchanged) return;
        const resolved = result.data.map(normalize);
        memCache[cacheKey] = { data: resolved, etag: result.etag };
        writeCache(lsKey, { data: resolved, etag: result.etag });
        setPrintTemplates(resolved);
      })
      .catch(() => {
        if (!cancelled && !persistedData) setPrintTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { printTemplates, loading };
}
