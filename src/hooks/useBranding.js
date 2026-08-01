import { useEffect, useState } from 'react';
import { getOutletKioskConfig } from '../api/mockApi';
import { readCache, writeCache, onAssetSync } from '../utils/assetCache';

// Per-outlet kiosk branding, set in the admin dashboard. Fetched once per boot
// and cached, so a kiosk that starts with the network down still comes up in
// the operator's colours instead of flashing back to stock Ownize blue.
//
// ponytail: boot-only refresh. Kiosks are power-cycled daily (see the backend's
// autostart.bat), so a rebrand lands next morning. If it ever needs to be
// immediate, fold this fetch into the 5-minute heartbeat rather than adding a
// second polling loop.
const cacheKey = (outletId) => `branding_${outletId}`;

export function readCachedBranding(outletId) {
  return outletId ? readCache(cacheKey(outletId)) : null;
}

// The palette is a 50..900 ramp but an operator only picks one colour, so the
// rest are derived. color-mix is native CSS — no colour library, and it stays
// correct if the base colour changes at runtime.
const SHADES = {
  '--color-primary-50': ['white', 8],
  '--color-primary-100': ['white', 16],
  '--color-primary-200': ['white', 32],
  '--color-primary-300': ['white', 52],
  '--color-primary-400': ['white', 76],
  '--color-primary-600': ['black', 85],
  '--color-primary-700': ['black', 70],
  '--color-primary-800': ['black', 55],
  '--color-primary-900': ['black', 38],
};

function applyTheme({ primary_color: primary, background_url: background }) {
  const root = document.documentElement;
  if (primary) {
    root.style.setProperty('--color-primary', primary);
    for (const [token, [towards, pct]] of Object.entries(SHADES)) {
      root.style.setProperty(token, `color-mix(in srgb, ${primary} ${pct}%, ${towards})`);
    }
  }
  // Read by .app-bg in index.css; `none` keeps the stock gradient.
  root.style.setProperty('--brand-bg-image', background ? `url("${background}")` : 'none');
}

export function useBranding(outletId) {
  const [branding, setBranding] = useState(() => readCachedBranding(outletId));

  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;

    // Paint the cached values immediately — waiting on the network would show
    // the customer a colour flip a second into the session.
    const cached = readCachedBranding(outletId);
    if (cached) applyTheme(cached);

    function fetchAndApply() {
      return getOutletKioskConfig(outletId)
        .then((config) => {
          if (cancelled) return;
          writeCache(cacheKey(outletId), config);
          setBranding(config);
          applyTheme(config);
        })
        .catch(() => {
          // Offline or the outlet has no branding — the cached (or stock) theme
          // already on screen is the right thing to keep showing.
        });
    }

    fetchAndApply();

    // Branding is applied to the document, not just cached, so a sync that
    // only cleared caches left the old colours and banner on screen until the
    // next reboot — which is exactly what the sync button exists to avoid.
    const offSync = onAssetSync(fetchAndApply);

    return () => { cancelled = true; offSync(); };
  }, [outletId]);

  return {
    bannerUrl: branding?.banner_url ?? null,
    // Where the splash's Start button sits. Defaulted here rather than at each
    // call site so one place decides the fleet default.
    bannerCtaPosition: branding?.banner_cta_position ?? 'bottom-center',
    // Null here on purpose — the component falls back to the translated
    // default so an outlet that set no label still follows the language toggle.
    bannerCtaLabel: branding?.banner_cta_label ?? null,
    backgroundUrl: branding?.background_url ?? null,
  };
}
