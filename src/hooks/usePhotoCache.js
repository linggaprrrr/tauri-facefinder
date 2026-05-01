import { useState, useEffect } from 'react';

// Module-level cache: original URL → blob object URL
const cache = new Map();

export function usePhotoCache(url) {
  const [resolvedUrl, setResolvedUrl] = useState(() => cache.get(url) ?? url);

  useEffect(() => {
    if (!url) return;

    if (cache.has(url)) {
      setResolvedUrl(cache.get(url));
      return;
    }

    let cancelled = false;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        cache.set(url, objectUrl);
        setResolvedUrl(objectUrl);
      })
      .catch(() => {
        // fall back to the original URL on error
        if (!cancelled) setResolvedUrl(url);
      });

    return () => { cancelled = true; };
  }, [url]);

  return resolvedUrl;
}
