import { useState, useEffect } from 'react';
import { getOutletPrintSetting } from '../api/mockApi';

// Deliberately NOT cached like stickers/frames/templates — this gates a real
// purchase decision (pay for printing or not), so it must reflect the
// current server state on every visit, not a stale local copy. outletId is
// fixed for the lifetime of a Download screen (set once via Settings), so
// unlike useLayoutFrames this doesn't need to handle it changing mid-session.
export function usePrintSetting(outletId) {
  const [setting, setSetting] = useState(null);
  const [loading, setLoading] = useState(!!outletId);

  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    getOutletPrintSetting(outletId)
      .then((data) => { if (!cancelled) setSetting(data); })
      .catch(() => { if (!cancelled) setSetting(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [outletId]);

  return { setting, loading };
}
