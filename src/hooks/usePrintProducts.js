import { useApp } from '../store/AppContext';
import { isTauri } from '../native/print';
import { usePrintSetting } from './usePrintSetting';
import { usePrintTemplates } from './usePrintTemplates';
import { usePrinterHealth } from './usePrinterHealth';
import { printAddonStatus } from '../utils/printAddonStatus';
import { getPrintStock } from '../utils/heartbeat';

// The print products this kiosk can sell right now — shared by the Pay page
// and the editor's print stepper so both apply the same rules.
//
// Two products: Primary (normal photo layout) and Secondary (photo strip).
// Offerability lives in printAddonStatus, so the Settings screen can explain a
// missing print option to staff using the very logic that hid it. Checked
// live, not at the last heartbeat: this is the moment the kiosk decides
// whether to take money for a print.
export function usePrintProducts() {
  const { state } = useApp();
  const { deviceConfig } = state;
  const outletId = deviceConfig?.outlet?.id;
  const { setting: printSetting, loading: printSettingLoading } = usePrintSetting(outletId);
  const { printTemplates } = usePrintTemplates(outletId);
  const printerHealth = usePrinterHealth(deviceConfig ?? {});
  const addonStatus = printAddonStatus({
    deviceConfig, printSetting, printSettingLoading, printTemplates,
    printerHealth, printStock: getPrintStock(),
  });

  const products = [
    { printType: 'primary', template: addonStatus.primary, labelKey: 'print.typePrimary' },
    { printType: 'secondary', template: addonStatus.secondary, labelKey: 'print.typeSecondary' },
  ]
    .filter((p) => p.template?.currentVersion && p.template?.price)
    .map((p) => ({ ...p, price: p.template.price, slotCount: p.template.currentVersion.slots?.length || 1 }));

  return { products, canOffer: isTauri() && addonStatus.ok && products.length > 0 };
}
