import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Settings, Info } from 'lucide-react';
import ownizeLogo from './assets/ownize_logo.png';
import { AppProvider } from './store/AppContext';
import { LanguageProvider, useLang } from './i18n/LanguageContext';
import LanguageSwitcher from './components/common/LanguageSwitcher';
import StepIndicator from './components/common/StepIndicator';
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
import { useIsMobile } from './hooks/useIsMobile';
import ScrollHint from './components/common/ScrollHint';
import OfflineBanner from './components/common/OfflineBanner';

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

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpNumber = state.deviceConfig.helpNumber;
  const isMobile = useIsMobile();
  // On mobile the bottom action bars (gallery/cart/checkout) would collide with
  // the fixed help FAB, so only surface it on the home screen there.
  const showHelpFab = !!helpNumber && (!isMobile || isHome);

  // Force settings open on first run when config is missing
  useEffect(() => {
    if (!isConfigured) setShowSettings(true);
  }, [isConfigured]);

  const forced = !isConfigured;

  return (
    <div className="app-bg min-h-screen flex flex-col">
      {/* Connectivity banner — sits above the header when the server is unreachable */}
      <OfflineBanner />

      {/* Header — frosted festive bar, brand mark left, stepper center */}
      <header
        className="flex items-center justify-between px-3 sm:px-8 py-2 sm:py-3 shrink-0 sticky top-0 z-30"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '2px solid var(--color-primary-100)',
          boxShadow: '0 4px 20px rgba(1,125,197,0.10)',
        }}
      >
        {/* Brand mark */}
        <div className="flex items-center min-w-0 sm:min-w-36">
          <div
            className="w-12 h-12 sm:w-20 sm:h-20 flex items-center justify-center text-xl font-black text-white shrink-0"
          >
            <img src={ownizeLogo} alt="Ownize" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="font-black text-xl sm:text-3xl leading-tight block text-gradient-brand">
              Ownize
            </span>
            <span className="hidden sm:block text-lg" style={{ color: 'var(--color-neutral-500)' }}>
              {t('app.subtitle')}
            </span>
          </div>
        </div>

        {/* Step indicator — centered (hidden on phones to save header width) */}
        <div className="hidden sm:flex">
          <StepIndicator current={step} />
        </div>

        {/* Language switcher (always visible) + Settings/About (home only) */}
        <div className="min-w-0 sm:min-w-36 flex items-center justify-end gap-2">
          <LanguageSwitcher />
          {isHome && (
            <>
              <button
                onClick={() => setShowAbout(true)}
                title={t('app.about')}
                aria-label={t('app.about')}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                style={{ color: 'var(--color-neutral-500)', background: 'var(--color-neutral-100)' }}
              >
                <Info size={18} />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                title={t('app.settings')}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--color-neutral-500)', background: 'var(--color-neutral-100)' }}
              >
                <Settings size={18} />
                <span className="hidden sm:inline">{t('app.settings')}</span>
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

      {/* Floating help button — bottom left (all pages on desktop; home only on mobile) */}
      {showHelpFab && (
        <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
          {showHelp && (
            <div
              className="rounded-2xl shadow-xl overflow-hidden"
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
                <p className="text-xs" style={{ color: '#6b7280' }}>{t('help.contactPrompt')}</p>
                <a
                  href='#'                  
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-base"
                  style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                  {helpNumber}
                </a>
              </div>
            </div>
          )}
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm shadow-lg transition-all"
            style={{
              background: showHelp ? '#25D366' : '#fff',
              color: showHelp ? '#fff' : '#25D366',
              border: '1.5px solid #25D366',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            {t('help.button')}
          </button>
        </div>
      )}

      {/* Page content */}
      <main key={location.pathname} className="flex-1 p-3 sm:p-6 overflow-auto no-scrollbar pop-in">
        <Routes>
          <Route path="/" element={<FaceScan />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/download" element={<Download />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile-only scroll-down hint — window-based, covers every screen
          (the page grows past the viewport and the window scrolls). */}
      <ScrollHint bottom={24} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <LanguageProvider>
        <ConnectivityProvider>
          <Layout />
        </ConnectivityProvider>
      </LanguageProvider>
    </AppProvider>
  );
}
