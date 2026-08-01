import { useState, useEffect } from 'react';
import { isTauri, listPrinters } from '../native/print';
import { printerStatusIn } from '../utils/heartbeat';

// Live health of the printers this kiosk is configured to use, for the Cart's
// "can we sell a print" gate.
//
// Queried directly rather than read off the last heartbeat: the beat is every 5
// minutes, and a printer that died four minutes ago would still be sold against
// for one more customer. This runs once when the customer reaches the cart,
// which is the moment the answer actually matters.
//
// 'online' | 'error' | 'offline' per printer, using the SAME rule the heartbeat
// reports to the fleet view — see printerStatusIn.
export function usePrinterHealth({ printerName, secondaryPrinterName }) {
  const [health, setHealth] = useState({ primary: null, secondary: null, loading: true });

  useEffect(() => {
    // Not a synchronous setState in the effect body — that would cascade a
    // render on every mount outside Tauri, which is every browser dev session.
    if (!isTauri()) {
      queueMicrotask(() => setHealth({ primary: null, secondary: null, loading: false }));
      return;
    }
    let cancelled = false;
    listPrinters()
      .then((printers) => {
        if (cancelled) return;
        setHealth({
          primary: printerStatusIn(printers, printerName),
          // Null, not 'offline', when none is configured: an outlet with one
          // printer prints strips on the primary, and calling that "offline"
          // would block a sale the kiosk can perfectly well fulfil.
          secondary: secondaryPrinterName ? printerStatusIn(printers, secondaryPrinterName) : null,
          loading: false,
        });
      })
      // Enumeration itself failing says nothing about the printer, so it must
      // not read as a fault — leaving health null means the gate stays open and
      // the existing per-job retry/reprint path handles a real failure.
      .catch(() => { if (!cancelled) setHealth({ primary: null, secondary: null, loading: false }); });
    return () => { cancelled = true; };
  }, [printerName, secondaryPrinterName]);

  return health;
}
