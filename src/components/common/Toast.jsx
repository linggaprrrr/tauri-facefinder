import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import IconButton from './IconButton';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Transient feedback banner.
 *
 * Replaces window.alert(), which is a poor fit here for a reason beyond
 * styling: it draws a native OS dialog, and this app runs fullscreen under
 * Tauri, where an OS-level modal is at best off-brand and at worst not
 * reliably surfaced at all. It also blocks the JS thread, which for a canvas
 * editor means the stage freezes behind it.
 *
 * Presentational only — the owning component holds the message in state.
 * Promote to a context provider once a second component needs to raise one.
 */
const TONES = {
  error: {
    Icon: AlertTriangle,
    bg: 'var(--color-error-bg)',
    fg: 'var(--color-error)',
    // Errors interrupt; status updates wait for a gap in speech.
    role: 'alert',
  },
  success: { Icon: CheckCircle2, bg: 'var(--color-success-bg)', fg: 'var(--color-success)', role: 'status' },
  info:    { Icon: Info,         bg: 'var(--color-primary-50)',  fg: 'var(--color-primary)', role: 'status' },
};

export default function Toast({ message, tone = 'error', onDismiss, duration = 4000 }) {
  const { t } = useLang();
  const dismiss = useRef(onDismiss);
  // Kept current in an effect rather than assigned during render — a ref write
  // in the render body is not safe under concurrent rendering, which React's
  // lint rules enforce.
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!duration) return;
    // Keyed to the message, not to onDismiss: an inline arrow at the call site
    // is a new function every render, which would restart the timer on each
    // one and leave the toast up forever. A new message does restart it, which
    // is what you want.
    const id = setTimeout(() => dismiss.current?.(), duration);
    return () => clearTimeout(id);
  }, [message, duration]);

  if (!message) return null;
  const { Icon, bg, fg, role } = TONES[tone] ?? TONES.error;

  return (
    <div
      role={role}
      className="pop-in fixed top-6 left-1/2 -translate-x-1/2 z-[100]
        flex items-center gap-3 pl-4 pr-2 py-3 rounded-xl shadow-lg max-w-[90vw]"
      style={{ background: bg, color: fg, border: `1.5px solid ${fg}` }}
    >
      <Icon size={20} className="shrink-0" />
      <span className="text-sm font-semibold">{message}</span>
      <IconButton icon={X} label={t('common.close')} size="sm" onClick={onDismiss} className="!text-inherit" />
    </div>
  );
}
