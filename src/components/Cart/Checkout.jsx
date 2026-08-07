import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { useAccessMethods } from '../../hooks/useAccessMethods';
import LoadingSpinner from '../common/LoadingSpinner';
import AccessMethodChooser from './access/AccessMethodChooser';
import QrisRunner from './access/runners/QrisRunner';
import ScanRunner from './access/runners/ScanRunner';
import StaffGrantModal from './access/StaffGrantModal';

// method.runner -> component. Keyed by runner TYPE, not method_key, since
// one runner backs more than one registry entry (Event Ticket and Promo
// Voucher both use 'scan' — same scan/validate/outcome shape, different copy).
const RUNNERS = { qris: QrisRunner, scan: ScanRunner };

// Orchestrator for the Access Method redesign: loads this outlet's enabled
// methods, skips straight to the single method's runner when there's only
// one (every outlet that hasn't configured Event Ticket/Promo Voucher — see
// access-methods-redesign spec, Phase A), otherwise shows the chooser.
//
// chainedDiscount (Phase B): a Promo Voucher that only partially covers the
// cart doesn't complete the journey itself — ScanRunner hands back here and
// this re-renders as QrisRunner for the remainder, discount already applied.
//
// Phase E: the staff-grant trigger is deliberately rendered alongside every
// state below (loading/empty/chooser/any runner), not folded into the
// chooser — it must never appear as a customer-facing card (see the spec's
// "staff methods never on the customer grid" rule), and staff need to be
// able to intervene regardless of which sub-view happens to be showing.
export default function Checkout() {
  const { state } = useApp();
  const { t } = useLang();
  const outletId = state.deviceConfig?.outlet?.id;
  const { methods, loading } = useAccessMethods(outletId);
  const [selectedKey, setSelectedKey] = useState(null);
  const [chainedDiscount, setChainedDiscount] = useState(null); // { promoCode, discountAmount } | null
  const [showStaffGrant, setShowStaffGrant] = useState(false);

  const total = state.selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  let content;
  if (loading) {
    content = (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  } else if (chainedDiscount) {
    content = <QrisRunner promoCode={chainedDiscount.promoCode} discountAmount={chainedDiscount.discountAmount} />;
  } else if (methods.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 max-w-sm mx-auto py-16 text-center">
        <p className="text-lg font-black" style={{ color: 'var(--color-neutral-900)' }}>{t('access.emptyTitle')}</p>
        {state.deviceConfig.helpNumber && (
          <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
            {t('access.emptyHelp', { phone: state.deviceConfig.helpNumber })}
          </p>
        )}
      </div>
    );
  } else {
    const activeKey = methods.length === 1 ? methods[0].key : selectedKey;
    const activeMethod = methods.find((m) => m.key === activeKey);
    const Runner = activeMethod ? RUNNERS[activeMethod.runner] : null;

    if (Runner === QrisRunner) {
      content = <QrisRunner />;
    } else if (Runner === ScanRunner) {
      content = (
        <ScanRunner
          method={activeMethod}
          onChainToQris={setChainedDiscount}
          onBack={() => setSelectedKey(null)}
        />
      );
    } else {
      content = (
        <AccessMethodChooser
          methods={methods}
          price={total}
          photoCount={state.selectedPhotos.length}
          onSelect={(method) => setSelectedKey(method.key)}
        />
      );
    }
  }

  return (
    <>
      {content}

      <button
        onClick={() => setShowStaffGrant(true)}
        aria-label={t('staff.title')}
        className="fixed bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-30 hover:opacity-70 transition-opacity"
        style={{ background: 'var(--color-neutral-800)', color: '#fff' }}
      >
        <ShieldCheck size={14} />
      </button>

      {showStaffGrant && <StaffGrantModal onClose={() => setShowStaffGrant(false)} />}
    </>
  );
}
