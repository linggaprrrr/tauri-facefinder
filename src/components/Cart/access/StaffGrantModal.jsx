import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../../store/AppContext';
import { useLang } from '../../../i18n/LanguageContext';
import { verifyDeviceKey } from '../../../utils/deviceAuth';
import { grantAccess } from '../../../api/mockApi';
import LoadingSpinner from '../../common/LoadingSpinner';
import Button from '../../common/Button';

const REASONS = ['complimentary', 'manual_approval', 'staff_access', 'other'];

// Never shown on the customer-facing chooser — a small trigger elsewhere on
// Checkout opens this. One mechanism for all three staff scenarios from the
// spec (Complimentary / Manual Approval / Staff Access), distinguished by
// `reason` for the audit trail rather than three separate access methods.
// Gated by the same device-code check as Settings (see utils/deviceAuth.js
// for why that's an accepted, not ignored, risk).
export default function StaffGrantModal({ onClose }) {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();

  const [step, setStep] = useState('auth'); // auth | form | granting | error
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [reason, setReason] = useState('complimentary');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { deviceConfig, selectedPhotos, photoEdits } = state;

  function handleAuth(e) {
    e.preventDefault();
    if (verifyDeviceKey(password)) {
      setStep('form');
    } else {
      setAuthError(t('settings.wrongCode'));
    }
  }

  async function handleGrant() {
    setStep('granting');
    setErrorMsg('');
    try {
      const photosWithEdits = selectedPhotos.map((p) => ({
        ...p,
        edited_image: photoEdits[p.id]?.dataUrl ?? null,
      }));
      const order = await grantAccess({
        outletId: deviceConfig.outlet.id,
        methodKey: 'staff_override',
        code: reason,
        note: note.trim() || undefined,
        photos: photosWithEdits,
      });
      dispatch({ type: 'SET_ORDER', payload: order });
      navigate('/download');
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: '#fff', boxShadow: 'var(--shadow-xl)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'var(--color-neutral-800)', color: '#fff' }}>
          <span className="font-bold text-base flex items-center gap-2"><ShieldCheck size={18} /> {t('staff.title')}</span>
          <button onClick={onClose} aria-label={t('common.close')} className="opacity-80 hover:opacity-100"><X size={20} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {step === 'auth' && (
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>{t('staff.authHint')}</p>
              <input
                type="password"
                placeholder={t('settings.codePlaceholder')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                autoFocus
                autoComplete="off"
                className="border rounded-lg px-4 py-3 text-base w-full outline-none focus:ring-2"
                style={{ borderColor: authError ? 'var(--color-error)' : 'var(--color-neutral-300)', '--tw-ring-color': 'var(--color-primary)' }}
              />
              {authError && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{authError}</p>}
              <Button type="submit" className="w-full">{t('staff.unlock')}</Button>
            </form>
          )}

          {step === 'form' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-semibold text-sm block mb-1.5" style={{ color: 'var(--color-neutral-700)' }}>{t('staff.reason')}</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="border rounded-lg px-4 py-3 text-base w-full outline-none"
                  style={{ borderColor: 'var(--color-neutral-300)' }}
                >
                  {REASONS.map((r) => <option key={r} value={r}>{t(`staff.reason.${r}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-sm block mb-1.5" style={{ color: 'var(--color-neutral-700)' }}>{t('staff.note')}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="border rounded-lg px-4 py-3 text-sm w-full outline-none resize-none"
                  style={{ borderColor: 'var(--color-neutral-300)' }}
                  placeholder={t('staff.notePlaceholder')}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>
                {t('staff.photoCount', { count: selectedPhotos.length })}
              </p>
              <Button onClick={handleGrant} disabled={selectedPhotos.length === 0} className="w-full">{t('staff.grant')}</Button>
            </div>
          )}

          {step === 'granting' && (
            <div className="py-6"><LoadingSpinner message={t('staff.granting')} /></div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full px-5 py-4 rounded-2xl text-center" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1.5px solid var(--color-error)' }}>
                <AlertTriangle size={24} className="mx-auto mb-2" />
                <p className="font-semibold">{errorMsg || t('checkout.genericError')}</p>
              </div>
              <Button onClick={() => setStep('form')} className="w-full">{t('common.retry')}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
