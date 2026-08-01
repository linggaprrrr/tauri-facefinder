import { useLang } from '../../i18n/LanguageContext';

// Coloured dot + label for a printer's state, the way the OS printer list
// shows it. Staff were finding out a printer was paused or offline only by
// running a test print and reading "Gagal mencetak", which says a print failed
// but not why.
//
// States come from the Rust side as the printers crate's PrinterState
// formatted with {:?} — READY | OFFLINE | PAUSED | PRINTING | UNKNOWN.
const STATES = {
  READY:    { key: 'printerState.ready',    color: 'var(--color-success)' },
  PRINTING: { key: 'printerState.printing', color: 'var(--color-success)' },
  PAUSED:   { key: 'printerState.paused',   color: 'var(--color-warning)' },
  OFFLINE:  { key: 'printerState.offline',  color: 'var(--color-error)' },
  UNKNOWN:  { key: 'printerState.unknown',  color: 'var(--color-neutral-400)' },
};

export default function PrinterStatus({ state }) {
  const { t } = useLang();
  if (!state) return null;

  const known = STATES[String(state).toUpperCase()];
  const color = known?.color ?? 'var(--color-neutral-400)';
  // An unmapped state is shown verbatim rather than guessed at — a new crate
  // variant should read as itself, not silently as "Unknown".
  const label = known ? t(known.key) : state;

  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-neutral-600)' }}>
      <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: color }} />
      {label}
    </span>
  );
}
