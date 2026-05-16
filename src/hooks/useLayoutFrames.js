import { useState, useEffect } from 'react';
import { getLayoutFrames } from '../api/mockApi';

const cache = {};

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
  const [layoutFrames, setLayoutFrames] = useState(cache[cacheKey] ?? []);
  const [loading, setLoading] = useState(!cache[cacheKey]);

  useEffect(() => {
    if (cache[cacheKey]) {
      setLayoutFrames(cache[cacheKey]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLayoutFrames(outletId)
      .then((data) => {
        if (cancelled) return;
        const result = data.map(normalize);
        cache[cacheKey] = result;
        setLayoutFrames(result);
      })
      .catch(() => {
        if (!cancelled) setLayoutFrames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { layoutFrames, loading };
}
