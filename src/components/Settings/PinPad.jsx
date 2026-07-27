import { useState, useEffect, useCallback } from 'react';
import { Delete, LoaderCircle } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import { verifyDevicePin, lockoutRemainingMs, PIN_LENGTH } from '../../utils/deviceAuth';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

// Touch-first numeric PIN entry. Submits on its own once PIN_LENGTH digits are
// in — a kiosk keypad has no natural "enter", and asking for one is a tap the
// customer-facing hardware doesn't need.
export default function PinPad({ outletId, onSuccess }) {
  const { t } = useLang();
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | wrong | locked
  const [retryS, setRetryS] = useState(0);

  const locked = status === 'locked' && retryS > 0;

  // Tick down the lockout so the message stays honest instead of freezing on
  // whatever it said when the lockout started.
  useEffect(() => {
    if (status !== 'locked') return;
    const id = setInterval(() => {
      const remaining = Math.ceil(lockoutRemainingMs() / 1000);
      setRetryS(remaining);
      if (remaining <= 0) setStatus('idle');
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  const submit = useCallback(async (value) => {
    setStatus('checking');
    const result = await verifyDevicePin(value, { outletId });
    if (result.ok) {
      onSuccess();
      return;
    }
    setPin('');
    if (result.reason === 'locked') {
      setRetryS(Math.ceil((result.retryMs ?? 0) / 1000));
      setStatus('locked');
    } else {
      setStatus('wrong');
    }
  }, [outletId, onSuccess]);

  const press = useCallback((key) => {
    if (locked || status === 'checking') return;
    if (key === 'del') {
      setStatus('idle');
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      if (p.length >= PIN_LENGTH) return p;
      const next = p + key;
      if (next.length === PIN_LENGTH) submit(next);
      return next;
    });
    setStatus((s) => (s === 'wrong' ? 'idle' : s));
  }, [locked, status, submit]);

  // Physical numeric keypads are common on serviced kiosks — accept them too
  // rather than forcing staff onto the touchscreen.
  useEffect(() => {
    function onKey(e) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    // Sized to fit the modal's 65vh body without scrolling, down to a phone
    // viewport — a keypad you have to scroll to reach is a broken keypad.
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-center" style={{ color: 'var(--color-neutral-600)' }}>
        {t('settings.pinHint')}
      </p>

      {/* Filled/empty dots — the PIN itself is never rendered. */}
      <div
        className={`flex gap-3 ${status === 'wrong' ? 'pin-shake' : ''}`}
        role="status"
        aria-label={t('settings.pinEntered', { n: pin.length, total: PIN_LENGTH })}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: 16,
              height: 16,
              background: status === 'wrong'
                ? 'var(--color-error)'
                : i < pin.length ? 'var(--color-primary)' : 'var(--color-neutral-200)',
              transform: i < pin.length ? 'scale(1)' : 'scale(0.8)',
            }}
          />
        ))}
      </div>

      <div className="h-5 flex items-center">
        {status === 'checking' && (
          <LoaderCircle size={18} className="animate-spin" style={{ color: 'var(--color-neutral-400)' }} />
        )}
        {status === 'wrong' && (
          <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>{t('settings.pinWrong')}</p>
        )}
        {locked && (
          <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
            {t('settings.pinLocked', { s: retryS })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5" style={{ opacity: locked ? 0.4 : 1 }}>
        {KEYS.map((key) => key === null ? <span key="gap" /> : (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={locked || status === 'checking'}
            aria-label={key === 'del' ? t('settings.pinDelete') : key}
            className="rounded-2xl font-semibold flex items-center justify-center transition-transform active:scale-90 disabled:cursor-not-allowed"
            style={{
              width: 72,
              height: 60,
              fontSize: 24,
              background: key === 'del' ? 'transparent' : 'var(--color-neutral-100)',
              color: key === 'del' ? 'var(--color-neutral-500)' : 'var(--color-neutral-800)',
            }}
          >
            {key === 'del' ? <Delete size={24} /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
