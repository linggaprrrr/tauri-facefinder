import { useEffect, useRef, useState } from 'react';
import { getSessionUploads } from '../api/mockApi';

const POLL_MS = 2000;

// Watches for photos the customer uploads from their phone into this editing
// session, and hands back a { [slotId]: url } map.
//
// Polling, not a socket: the kiosk already polls /health and payment status,
// exactly one customer uploads at a time, and the poll stops the moment every
// open placeholder is filled — so a socket would be new infrastructure to
// carry a handful of requests per session.
export function useSessionUploads(sessionId, pendingSlotIds) {
  const [uploads, setUploads] = useState({});
  // Kept in a ref so a changing pending list doesn't restart the interval and
  // reset its phase every time the customer adds another placeholder. Synced
  // in an effect rather than assigned during render — a ref write in render
  // is exactly what React 19 flags, and the poll only reads it on a timer.
  const pendingRef = useRef(pendingSlotIds);
  useEffect(() => { pendingRef.current = pendingSlotIds; });

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer = null;

    async function tick() {
      // Nothing outstanding — idle without hitting the network. The next
      // placeholder the customer adds restarts the polling on the next tick.
      if (pendingRef.current.length > 0) {
        try {
          const rows = await getSessionUploads(sessionId);
          if (cancelled) return;
          setUploads(Object.fromEntries(rows.map((r) => [r.slot_id, r.url])));
        } catch {
          // Offline or a blip — keep polling; the customer's upload may still
          // be in flight and there is nothing useful to say yet.
        }
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  return uploads;
}
