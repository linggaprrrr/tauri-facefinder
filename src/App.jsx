import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Settings, Info } from 'lucide-react';
import ownizeLogo from './assets/ownize_logo.png';
import { AppProvider } from './store/AppContext';
import { LanguageProvider, useLang } from './i18n/LanguageContext';
import LanguageSwitcher from './components/common/LanguageSwitcher';
import StepIndicator from './components/common/StepIndicator';
import Clock from './components/common/Clock';
import FaceScan from './components/FaceScan/FaceScan';
import Gallery from './components/Gallery/Gallery';
import Cart from './components/Cart/Cart';
import Checkout from './components/Cart/Checkout';
import Download from './components/Download/Download';
import Editor from './components/Editor/PhotoEditor';
import SettingsModal from './components/Settings/SettingsModal';
import AboutModal from './components/Settings/AboutModal';
import { useApp } from './store/AppContext';
import { ConnectivityProvider } from './store/ConnectivityContext';
import { useOutletFromURL } from './hooks/useOutletFromURL';
import { useBranding } from './hooks/useBranding';
import ScrollHint from './components/common/ScrollHint';
import OfflineBanner from './components/common/OfflineBanner';
import OrderRecovery from './components/common/OrderRecovery';
import ErrorBoundary from './components/common/ErrorBoundary';
import { readPendingOrder } from './utils/pendingOrder';
import { resumePrintQueue } from './utils/printQueue';
import { checkForUpdateAtBoot } from './utils/autoUpdate';
import { startHeartbeat, getPrintStock, subscribePrintStock } from './utils/heartbeat';
import { isTauri } from './native/print';
import { clearAssetCache } from './utils/assetCache';
import BannerSplash from './components/Home/BannerSplash';

const ROUTE_STEP = {
  '/': 0,
  '/gallery': 1,
  '/editor': 2,
  '/cart': 3,
  '/checkout': 3,
  '/download': 4,
};

function Layout() {
  const location = useLocation();
  const step = ROUTE_STEP[location.pathname] ?? 0;
  const isHome = location.pathname === '/';
  const { state } = useApp();
  const { t } = useLang();
  // Mobile customers arrive via QR with ?outlet_id=... — auto-configure from URL.
  useOutletFromURL();
  const isConfigured = !!(state.deviceConfig.unit && state.deviceConfig.outlet);
  // Applies the outlet's primary colour + background globally; the banner is
  // the welcome screen's to render.
  const { bannerUrl, bannerCtaPosition, bannerCtaLabel } = useBranding(state.deviceConfig.outlet?.id);

  // Attract screen. Re-armed every time the kiosk returns to home so each new
  // customer meets it, and dismissed for the rest of the visit once someone
  // starts — it is a greeting, not something to walk back into mid-session.
  const [splashDismissed, setSplashDismissed] = useState(false);
  useEffect(() => {
    if (isHome) setSplashDismissed(false);
  }, [isHome]);

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpNumber = state.deviceConfig.helpNumber;

  // Recovery for a paid-but-stranded order: if a recent pendingOrder survives
  // from a prior session (kiosk crash/reboot), offer to retrieve it on home.
  const [pendingOrder, setPendingOrder] = useState(() => readPendingOrder());

  // Force settings open on first run when config is missing
  useEffect(() => {
    if (!isConfigured) setShowSettings(true);
  }, [isConfigured]);

  // Backspace outside a text field is the browser's "go back" shortcut, and
  // the kiosk runs in a WebView that still honours it — a stray press on an
  // attached keyboard walked the customer back out of the page they were on,
  // losing the step they were in. Only the navigation is suppressed: the event
  // still reaches other listeners, so the Settings PIN pad's own Backspace
  // (delete a digit) keeps working.
  useEffect(() => {
    function blockBackspaceNav(e) {
      if (e.key !== 'Backspace') return;
      const el = e.target;
      const editable = el?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName);
      if (!editable) e.preventDefault();
    }
    window.addEventListener('keydown', blockBackspaceNav);
    return () => window.removeEventListener('keydown', blockBackspaceNav);
  }, []);

  // Resume any print job left queued from a crash/restart, once on boot.
  useEffect(() => {
    if (isTauri()) resumePrintQueue();
  }, []);

  // Self-update at boot only — see autoUpdate.js. Deliberately after the queue
  // resume above: an update relaunches the app, and a job left over from a
  // crash should be back on disk and owned by the queue before that happens.
  useEffect(() => {
    if (isTauri()) checkForUpdateAtBoot();
  }, []);

  // Report this kiosk's printer pairing/status to the admin fleet view, once on
  // boot and every 5 minutes. Restarts when deviceConfig changes (e.g. printer
  // reassigned in Settings) so the next beat reflects the new config right away.
  useEffect(() => {
    if (isTauri()) return startHeartbeat(state.deviceConfig);
  }, [state.deviceConfig]);

  // Hourly content refresh, so an outlet that updates stickers or branding in
  // the morning does not wait for a power cycle. Deliberately skipped unless
  // the kiosk is idle on the welcome screen: a sync mid-session would refetch
  // assets under a customer who is part-way through editing, and the whole
  // point of this is to be invisible. Skipping just defers to the next tick.
  useEffect(() => {
    const id = setInterval(() => {
      const busy = state.photos.length > 0 || state.selectedPhotos.length > 0;
      if (isHome && !busy) clearAssetCache();
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isHome, state.photos.length, state.selectedPhotos.length]);

  // Media running out is the one fault staff can actually fix on the spot, so
  // surface it without them having to unlock Settings to find out.
  const [lowStock, setLowStock] = useState(() => !!getPrintStock()?.low);
  useEffect(() => subscribePrintStock((stock) => setLowStock(!!stock?.low)), []);

  const forced = !isConfigured;

  return (
    /* Kiosk sizes lock to the screen so <main> is the scroll box and pages can
       fill it (h-full) — on a tall portrait screen the gallery/editor action
       bars otherwise float mid-screen. Phones keep window scrolling (ScrollHint). */
    <div className="app-bg min-h-screen sm:h-screen flex flex-col">
      {/* Connectivity banner — sits above the header when the server is unreachable */}
      <OfflineBanner />

      {/* Header — two cream pills floating over the top of the background art
          (brand left, language/clock right). The header itself is transparent
          and tall on kiosk sizes so the scene in the art shows between and
          below the pills before the panel starts. */}
      <header className="flex items-start justify-between gap-3 px-3 sm:px-6 pt-3 sm:pt-5 pb-3 shrink-0 sm:min-h-[10vh]">
        {/* Brand mark */}
        <div className="header-pill flex items-center gap-2 sm:gap-3 min-w-0 pl-2 pr-4 sm:pl-3 sm:pr-6 py-1.5 sm:py-2">
          <img src={ownizeLogo} alt="Ownize" className="w-11 h-11 sm:w-16 sm:h-16 object-contain shrink-0" />
          <div className="min-w-0">
            <span className="font-black text-xl sm:text-3xl leading-none block text-gradient-brand">
              Ownize
            </span>
            <span className="hidden sm:block text-xs font-bold uppercase tracking-[0.25em] mt-1" style={{ color: 'var(--color-neutral-800)' }}>
              {t('app.subtitle')}
            </span>
          </div>
        </div>

        {/* Language switcher (always visible) + clock + Settings/About (home only) */}
        <div className="header-pill flex items-center justify-end gap-2 sm:gap-3 px-2 sm:px-4 py-2">
          <LanguageSwitcher />
          <span aria-hidden className="hidden sm:block w-px self-stretch" style={{ background: 'var(--color-neutral-300)' }} />
          <div className="hidden sm:block"><Clock /></div>
          {/* Help — in the header pill rather than a floating corner button:
              the corner FAB sat on top of every page's Back button and content.
              Opens a WhatsApp contact card underneath. */}
          {helpNumber && (
            <div className="relative">
              <button
                onClick={() => setShowHelp((v) => !v)}
                aria-expanded={showHelp}
                className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: showHelp ? '#25D366' : 'var(--color-success-bg)',
                  color: showHelp ? '#fff' : 'var(--color-success)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                <span className="hidden sm:inline">{t('help.button')}</span>
              </button>
              {showHelp && (
                <div
                  className="absolute right-0 top-full mt-3 z-50 rounded-2xl shadow-xl overflow-hidden"
                  style={{ width: 260, border: '1px solid #d1fae5' }}
                >
                  {/* WhatsApp header */}
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#25D366' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm leading-tight">{t('help.title')}</p>
                      <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.8)' }}>WhatsApp</p>
                    </div>
                  </div>
                  {/* Number */}
                  <div className="px-4 py-3 flex flex-col gap-2" style={{ background: '#fff' }}>
                    <p className="text-xs" style={{ color: 'var(--color-neutral-600)' }}>{t('help.contactPrompt')}</p>
                    <a
                      href='#'                  
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-base"
                      style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#16a34a">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                      {helpNumber}
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          {isHome && (
            <>
              <button
                onClick={() => setShowAbout(true)}
                title={t('app.about')}
                aria-label={t('app.about')}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)' }}
              >
                <Info size={18} />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                title={lowStock ? t('settings.stockLow') : t('app.settings')}
                className="relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)' }}
              >
                <Settings size={18} />
                <span className="hidden sm:inline">{t('app.settings')}</span>
                {/* Low media is staff business, not the customer's: a dot on
                    the gear reads as "needs attention" to whoever maintains
                    the kiosk and as nothing at all to a customer, so it never
                    announces "we're nearly out of paper" mid-queue. */}
                {lowStock && (
                  <span
                    aria-hidden
                    className="absolute rounded-full"
                    style={{
                      top: 6, right: 6, width: 8, height: 8,
                      background: 'var(--color-warning)',
                      boxShadow: '0 0 0 2px var(--color-neutral-100)',
                    }}
                  />
                )}
              </button>
            </>
          )}
        </div>
      </header>

      {showSettings && (
        <SettingsModal
          forced={forced}
          onClose={() => { if (!forced) setShowSettings(false); }}
        />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {isHome && bannerUrl && !splashDismissed && !forced && !showSettings && (
        <BannerSplash
          bannerUrl={bannerUrl}
          ctaPosition={bannerCtaPosition}
          ctaLabel={bannerCtaLabel}
          primaryColor={getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()}
          onStart={() => setSplashDismissed(true)}
          onClose={() => setSplashDismissed(true)}
        />
      )}

      {/* Page content — one cream panel holding the step bar and the page, so
          every page's text sits on a light surface whatever the art behind is.
          The inner div is the scroll box (pages size themselves with h-full /
          min-h-full against it); the step bar stays put above it. */}
      <main className="flex-1 min-h-0 flex flex-col px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="kiosk-panel flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Hidden on phones, where five tiles cannot fit a 375px row. */}
          {/* Also hidden on windows under 820px tall (desktop/test windows —
              kiosks are 1080+): there it leaves pages, the editor above all,
              too little height to work in. */}
          <div className="hidden sm:block [@media(max-height:820px)]:hidden shrink-0 px-6 pt-5">
            <div className="card px-4 py-4" style={{ borderRadius: '1.75rem' }}>
              <StepIndicator current={step} />
            </div>
          </div>
          <div key={location.pathname} className="flex-1 min-h-0 p-3 sm:p-6 overflow-auto no-scrollbar pop-in">
        <Routes>
          <Route path="/" element={<FaceScan />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/download" element={<Download />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </div>
        </div>
      </main>

      {/* Mobile-only scroll-down hint — window-based, covers every screen
          (the page grows past the viewport and the window scrolls). */}
      <ScrollHint bottom={24} />

      {/* Paid-but-stranded recovery — only on home, for an order from a prior session */}
      {isHome && pendingOrder && (
        <OrderRecovery order={pendingOrder} onClose={() => setPendingOrder(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <LanguageProvider>
          <ConnectivityProvider>
            <Layout />
          </ConnectivityProvider>
        </LanguageProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
