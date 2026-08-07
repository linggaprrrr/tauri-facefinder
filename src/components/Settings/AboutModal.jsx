import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { getVersion, getName } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import ownizeLogo from '../../assets/ownize_logo.png';
import { useLang } from '../../i18n/LanguageContext';
import Modal from '../common/Modal';
import Button from '../common/Button';

const STATUS = { IDLE: 'idle', CHECKING: 'checking', UP_TO_DATE: 'up_to_date', AVAILABLE: 'available', INSTALLING: 'installing', ERROR: 'error' };

// A production build has no console and no log file (the Rust side only wires
// up tauri_plugin_log under cfg!(debug_assertions)), so this banner is the
// ONLY place a failed check or install is ever visible — and the updater
// plugin sometimes rejects with a bare string rather than an Error, which
// made e?.message silently empty and left staff staring at generic text with
// no way to tell "no internet" from "signature mismatch" from "server down".
function describeError(e, fallback) {
  if (typeof e === 'string' && e) return e;
  if (e?.message) return e.message;
  try {
    const s = JSON.stringify(e);
    if (s && s !== '{}') return s;
  } catch { /* circular or unserializable — fall through */ }
  return fallback;
}

export default function AboutModal({ onClose }) {
  const { t } = useLang();
  const [appVersion, setAppVersion] = useState('—');
  const [appName, setAppName] = useState('AI Studio');
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
      setErrorMsg(describeError(e, t('about.errCheck')));
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
      setErrorMsg(describeError(e, t('about.errInstall')));
      setStatus(STATUS.ERROR);
    }
  }

  const checking = status === STATUS.CHECKING;
  const installing = status === STATUS.INSTALLING;

  return (
    <Modal title={t('about.title')} onClose={onClose} size="sm">
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
              <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>by Ownize</p>
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
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
            >
              <Check size={16} strokeWidth={2.5} />
              {t('about.upToDate')}
            </div>
          )}

          {status === STATUS.AVAILABLE && updateInfo && (
            <div
              className="flex flex-col gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
            >
              <p className="font-semibold">{t('about.available', { version: updateInfo.version })}</p>
              {updateInfo.notes && (
                <p className="text-xs opacity-80 whitespace-pre-line">{updateInfo.notes}</p>
              )}
              <Button onClick={handleInstall} size="md" className="w-full">
                {t('about.installRestart')}
              </Button>
            </div>
          )}

          {status === STATUS.INSTALLING && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
            >
              <Spinner /> {t('about.installing')}
            </div>
          )}

          {status === STATUS.ERROR && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
            >
              {errorMsg}
            </div>
          )}

          {/* Check for updates button */}
          <Button
            variant="ghost"
            onClick={handleCheckUpdate}
            disabled={checking || installing}
            className="w-full"
          >
            {checking ? <><Spinner /> {t('about.checking')}</> : t('about.checkUpdate')}
          </Button>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span style={{ color: 'var(--color-neutral-600)' }}>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--color-neutral-800)' }}>{value}</span>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="animate-spin" size={14} strokeWidth={2.5} />;
}
