import { useState, useEffect } from 'react';

const cache = {};

// Loads slot config from /public/frames/<frameId>.json at runtime.
// Result is cached per frameId so it's only fetched once.
export function useLayoutFrameConfig(frame) {
  const frameId = frame?.id ?? null;
  const [config, setConfig] = useState(cache[frameId] ?? null);
  const [loading, setLoading] = useState(!cache[frameId] && !!frameId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!frameId || frame?.type !== 'layout') {
      setConfig(null);
      setLoading(false);
      return;
    }
    if (cache[frameId]) {
      setConfig(cache[frameId]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const jsonPath = frame.src.replace(/\.[^.]+$/, '.json');
    fetch(jsonPath)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        cache[frameId] = data;
        setConfig(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [frameId, frame?.type, frame?.src]);

  // slots: loaded from JSON; fall back to inline slots on frame object if present
  const slots = config?.slots ?? frame?.slots ?? [];
  const aspectRatio = config?.aspectRatio ?? frame?.aspectRatio ?? 1;

  return { slots, aspectRatio, loading, error };
}
