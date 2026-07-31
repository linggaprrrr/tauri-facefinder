import { QrCode, Smartphone, Loader2, Check } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

// Sidebar panel for phone uploads. The QR opens in its own modal (see
// PhoneUploadModal) rather than being placed on the canvas — this panel is the
// entry point plus the instructions and the done state.
export default function UploadPanel({ onAdd, awaitingCount, uploadedCount }) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-neutral-800)' }}>
          {t('upload.title')}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-neutral-500)' }}>
          {t('upload.hint')}
        </p>
      </div>

      <button
        onClick={onAdd}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
        style={{ background: 'var(--color-primary)', color: '#fff' }}
      >
        <QrCode size={18} /> {t('upload.add')}
      </button>

      {/* Live status — the whole point of the feature is that the canvas
          updates without the customer touching the kiosk again, so say so. */}
      {awaitingCount > 0 && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
        >
          <Loader2 size={16} className="animate-spin shrink-0" />
          {t('upload.waiting', { count: awaitingCount })}
        </div>
      )}
      {uploadedCount > 0 && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
          style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
        >
          <Check size={16} strokeWidth={3} className="shrink-0" />
          {t('upload.received', { count: uploadedCount })}
        </div>
      )}

      <ol className="flex flex-col gap-2 text-xs" style={{ color: 'var(--color-neutral-600)' }}>
        {['upload.step1', 'upload.step2', 'upload.step3'].map((key, i) => (
          <li key={key} className="flex gap-2">
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{t(key)}</span>
          </li>
        ))}
      </ol>

      <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-neutral-400)' }}>
        <Smartphone size={14} className="shrink-0 mt-0.5" /> {t('upload.formats')}
      </p>
    </div>
  );
}
