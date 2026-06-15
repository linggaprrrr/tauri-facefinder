import { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { getVersion, getName } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import ownizeLogo from '../../assets/ownize_logo.png';
import { useLang } from '../../i18n/LanguageContext';

const STATUS = { IDLE: 'idle', CHECKING: 'checking', UP_TO_DATE: 'up_to_date', AVAILABLE: 'available', INSTALLING: 'installing', ERROR: 'error' };

export default function AboutModal({ onClose }) {
  const { t } = useLang();
  const [appVersion, setAppVersion] = useState('—');
  const [appName, setAppName] = useState('Face Finder');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    Promise.all([getVersion(), getName()])
      .then(([v, n]) => { setAppVersion(v); setAppName(n); })
      .catch(() => {});
  }, []);

  async function handleCheckUpdate() {
    setStatus(STATUS.CHECKING);
    setErrorMsg('');
    setUpdateInfo(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateInfo({ version: update.version, notes: update.body, update });
        setStatus(STATUS.AVAILABLE);
      } else {
        setStatus(STATUS.UP_TO_DATE);
      }
    } catch (e) {
      setErrorMsg(e?.message ?? t('about.errCheck'));
      setStatus(STATUS.ERROR);
    }
  }

  async function handleInstall() {
    if (!updateInfo?.update) return;
    setStatus(STATUS.INSTALLING);
    try {
      await updateInfo.update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setErrorMsg(e?.message ?? t('about.errInstall'));
      setStatus(STATUS.ERROR);
    }
  }

  const checking = status === STATUS.CHECKING;
  const installing = status === STATUS.INSTALLING;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl" style={{ background: '#fff' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          <span className="font-bold text-xl">{t('about.title')}</span>
          <button
            onClick={onClose}
            className="text-white opacity-70 hover:opacity-100 leading-none"
            aria-label={t('common.close')}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* App identity */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center shrink-0">
              <img src={ownizeLogo} alt="Ownize" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-black text-2xl leading-tight" style={{ color: 'var(--color-primary)' }}>
                {appName}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-neutral-500)' }}>by Ownize</p>
            </div>
          </div>

          {/* Info rows */}
          <div
            className="rounded-xl divide-y text-sm"
            style={{ background: 'var(--color-neutral-50)', borderColor: 'var(--color-neutral-100)' }}
          >
            <InfoRow label={t('about.version')} value={`v${appVersion}`} />
            <InfoRow label={t('about.platform')} value="Desktop (Tauri)" />
          </div>

          {/* Update status feedback */}
          {status === STATUS.UP_TO_DATE && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-success-50, #f0fdf4)', color: '#16a34a' }}
            >
              <Check size={16} strokeWidth={2.5} />
              {t('about.upToDate')}
            </div>
          )}

          {status === STATUS.AVAILABLE && updateInfo && (
            <div
              className="flex flex-col gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-primary-50, #eff6ff)', color: 'var(--color-primary)' }}
            >
              <p className="font-semibold">{t('about.available', { version: updateInfo.version })}</p>
              {updateInfo.notes && (
                <p className="text-xs opacity-80 whitespace-pre-line">{updateInfo.notes}</p>
              )}
              <button
                onClick={handleInstall}
                className="btn-primary py-2 rounded-lg font-semibold text-sm"
              >
                {t('about.installRestart')}
              </button>
            </div>
          )}

          {status === STATUS.INSTALLING && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-primary-50, #eff6ff)', color: 'var(--color-primary)' }}
            >
              <Spinner /> {t('about.installing')}
            </div>
          )}

          {status === STATUS.ERROR && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-error-50, #fef2f2)', color: 'var(--color-error, #dc2626)' }}
            >
              {errorMsg}
            </div>
          )}

          {/* Check for updates button */}
          <button
            onClick={handleCheckUpdate}
            disabled={checking || installing}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{
              background: 'var(--color-neutral-100)',
              color: 'var(--color-neutral-700)',
            }}
          >
            {checking ? <><Spinner /> {t('about.checking')}</> : t('about.checkUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span style={{ color: 'var(--color-neutral-500)' }}>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--color-neutral-800)' }}>{value}</span>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="animate-spin" size={14} strokeWidth={2.5} />;
}
