// Why the kiosk is (or isn't) offering paid prints.
//
// The Cart gate used to be one collapsed boolean over six conditions, so a
// misconfigured outlet looked identical to an outlet that simply doesn't sell
// prints: the checkbox just wasn't there. Same conditions, same order, one
// place — Cart takes the templates, Settings shows the reason to staff.
//
// A template is only offerable once it has BOTH a published version and a
// price. Unpriced would 400 at checkout; unpublished has no layout to render.
// The public template list already excludes unpublished ones server-side, so
// an id the outlet points at that isn't in the list means "unpublished, or not
// assigned to this outlet" — indistinguishable from here, and the copy says so.
export function printAddonStatus({ deviceConfig, printSetting, printSettingLoading, printTemplates }) {
  const blocked = (reason, label) => ({ ok: false, reason, label, primary: null, secondary: null });

  if (!deviceConfig?.printEnabled) return blocked('devicePrintOff');
  if (!deviceConfig?.printerName) return blocked('noPrinter');
  if (printSettingLoading) return blocked('loading');
  if (!printSetting?.printing_enabled) return blocked('outletPrintOff');

  const pick = (id) => (id ? printTemplates.find((t) => t.id === id) ?? null : null);
  const primaryRaw = pick(printSetting.default_template_id);
  const secondaryRaw = pick(printSetting.secondary_template_id);

  if (!printSetting.default_template_id && !printSetting.secondary_template_id) return blocked('noTemplateChosen');
  if (!primaryRaw && !secondaryRaw) return blocked('templateUnavailable');

  const offerable = (t) => (t?.currentVersion && t.price ? t : null);
  const primary = offerable(primaryRaw);
  const secondary = offerable(secondaryRaw);
  if (!primary && !secondary) {
    const t = primaryRaw ?? secondaryRaw;
    return blocked(t.price ? 'templateUnpublished' : 'templateNoPrice', t.label);
  }

  return { ok: true, reason: null, label: null, primary, secondary };
}
