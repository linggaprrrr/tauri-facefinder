import { Loader2, Sparkles, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Floating status pill for the non-blocking AI job.
 * Lets the customer keep editing while the AI works in the background.
 *   pending → spinner + "creating…"
 *   ready   → "view your AI photo" (shown only if the reveal modal was dismissed)
 *   error   → friendly failure + retry / dismiss (free transform NOT consumed)
 */
export default function AiJobPill({ job, onView, onRetry, onDismiss }) {
  const { t } = useLang();
  if (!job) return null;

  const wrap = {
    position: 'fixed',
    left: '50%',
    bottom: 18,
    transform: 'translateX(-50%)',
    zIndex: 40,
    maxWidth: 'calc(100vw - 24px)',
  };

  if (job.status === 'pending') {
    return (
      <div style={wrap}>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full" style={{ background: '#111', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{t('ai.generating')}</div>
            <div className="text-xs" style={{ opacity: 0.7 }}>{t('ai.generatingNote')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === 'ready') {
    return (
      <div style={wrap}>
        <button
          onClick={onView}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all active:scale-95"
          style={{ background: 'var(--color-primary)', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
        >
          <Sparkles size={18} />
          <span className="text-sm font-semibold">{t('ai.viewResult')}</span>
        </button>
      </div>
    );
  }

  // error
  return (
    <div style={wrap}>
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl" style={{ background: '#fff', border: '1px solid #fca5a5', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
        <AlertTriangle size={18} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
        <span className="text-xs leading-snug" style={{ color: 'var(--color-error)', maxWidth: 240 }}>
          {job.errorMsg || t('ai.failed')}
        </span>
        {job.canRetry ? (
          <>
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              <RefreshCw size={13} /> {t('ai.retryBtn')}
            </button>
            <button
              onClick={onDismiss}
              aria-label={t('ai.dismiss')}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          // Same template+photo would fail again — steer back to the panel to choose another.
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            {t('ai.pickAnotherBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
