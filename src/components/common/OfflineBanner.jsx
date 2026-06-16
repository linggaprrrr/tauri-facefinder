import { WifiOff } from 'lucide-react';
import { useConnectivity } from '../../store/ConnectivityContext';
import { useLang } from '../../i18n/LanguageContext';

// Full-width bar shown whenever the server isn't reachable, so customers get a
// clear "reconnecting" message instead of cryptic scan/payment errors. Auto-
// hides the moment the heartbeat recovers.
export default function OfflineBanner() {
  const { status } = useConnectivity();
  const { t } = useLang();
  if (status === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
      style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
    >
      <WifiOff size={16} />
      <span>{t('offline.banner')}</span>
      <span
        className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
        style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
