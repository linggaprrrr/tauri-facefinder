import { Loader2, Smartphone, X } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

// The QR for a phone upload, shown as its own modal rather than as a box on
// the canvas. On the canvas the customer had to place the box first, and the
// QR competed with the photo they were editing; here the code is big, centred
// and unmistakable, and the canvas only ever holds the finished photo.
export default function PhoneUploadModal({ qrDataUrl, onCancel }) {
  const { t } = useLang();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl" style={{ background: '#fff' }}>
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          <span className="font-bold text-lg">{t('upload.title')}</span>
          <button
            onClick={onCancel}
            className="text-white opacity-70 hover:opacity-100 leading-none"
            aria-label={t('common.close')}
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <p className="text-sm text-center" style={{ color: 'var(--color-neutral-600)' }}>
            {t('upload.scanHint')}
          </p>

          {/* A failed render leaves qrDataUrl null — say so instead of showing
              an empty frame the customer would keep trying to scan. */}
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt=""
              width={240}
              height={240}
              style={{ borderRadius: 12, border: '1px solid var(--color-neutral-200)' }}
            />
          ) : (
            <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>
              {t('upload.qrFailed')}
            </p>
          )}

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
          >
            <Loader2 size={16} className="animate-spin shrink-0" />
            {t('upload.waitingPhone')}
          </div>

          <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-neutral-400)' }}>
            <Smartphone size={14} className="shrink-0 mt-0.5" /> {t('upload.formats')}
          </p>
        </div>
      </div>
    </div>
  );
}
