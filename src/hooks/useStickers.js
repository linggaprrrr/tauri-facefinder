import { useState, useEffect } from 'react';
import { getStickers } from '../api/mockApi';

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

const cache = {};

export function useStickers(outletId) {
  const cacheKey = outletId ?? '__global__';
  const [stickers, setStickers] = useState(cache[cacheKey] ?? FALLBACK);
  const [loading, setLoading] = useState(!cache[cacheKey]);

  useEffect(() => {
    if (cache[cacheKey]) {
      setStickers(cache[cacheKey]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getStickers(outletId)
      .then((data) => {
        if (cancelled) return;
        const result = data.length > 0 ? data : FALLBACK;
        cache[cacheKey] = result;
        setStickers(result);
      })
      .catch(() => {
        if (!cancelled) setStickers(FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);

  return { stickers, loading };
}
