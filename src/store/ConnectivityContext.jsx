import { createContext, useContext, useEffect, useState } from 'react';
import { checkHealth } from '../api/mockApi';

// 'online'       — last heartbeat to the server succeeded
// 'reconnecting' — browser is back online, re-checking the server
// 'offline'      — NIC is down or the server is unreachable
const ConnectivityContext = createContext({ status: 'online', online: true });

const OK_INTERVAL = 15000;    // healthy → poll every 15s
const RETRY_INTERVAL = 5000;  // down → retry every 5s

export function ConnectivityProvider({ children }) {
  const [status, setStatus] = useState('online');

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      // navigator.onLine only knows the local NIC; the heartbeat confirms the
      // server is actually reachable (tunnel up, origin alive).
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('offline');
        timer = setTimeout(tick, RETRY_INTERVAL);
        return;
      }
      const ok = await checkHealth();
      if (cancelled) return;
      setStatus(ok ? 'online' : 'offline');
      timer = setTimeout(tick, ok ? OK_INTERVAL : RETRY_INTERVAL);
    };

    const onOnline = () => { clearTimeout(timer); setStatus('reconnecting'); tick(); };
    const onOffline = () => { clearTimeout(timer); setStatus('offline'); timer = setTimeout(tick, RETRY_INTERVAL); };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Defer the first probe out of the effect body (avoids a sync setState).
    timer = setTimeout(tick, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ status, online: status === 'online' }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
