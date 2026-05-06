import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ownizeLogo from './assets/ownize_logo.png';
import { AppProvider } from './store/AppContext';
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
  const isConfigured = !!(state.deviceConfig.unit && state.deviceConfig.outlet);

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Force settings open on first run when config is missing
  useEffect(() => {
    if (!isConfigured) setShowSettings(true);
  }, [isConfigured]);

  const forced = !isConfigured;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-neutral-50)' }}>
      {/* Header — white with bottom border, brand mark left, stepper center */}
      <header
        className="flex items-center justify-between px-8 py-3 shrink-0"
        style={{
          background: '#fff',
          borderBottom: '2px solid var(--color-primary-50)',
          boxShadow: '0 2px 8px rgba(1,125,197,0.08)',
        }}
      >
        {/* Brand mark */}
        <div className="flex items-center min-w-36">
          <div
            className="w-20 h-20 flex items-center justify-center text-xl font-black text-white"
          >
            <img src={ownizeLogo} alt="Ownize" className="w-full h-full object-contain" />
          </div>
          <div>
            <span
              className="font-black text-3xl leading-tight block"
              style={{ color: 'var(--color-primary)' }}
            >
              Ownize
            </span>
            <span className="text-lg" style={{ color: 'var(--color-neutral-500)' }}>
              Face Finder
            </span>
          </div>
        </div>

        {/* Step indicator — centered */}
        <StepIndicator current={step} />

        {/* Settings + About buttons — only on home page */}
        <div className="min-w-36 flex items-center justify-end gap-2">
          {isHome && (
            <>
              <button
                onClick={() => setShowAbout(true)}
                title="Tentang Aplikasi"
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                style={{ color: 'var(--color-neutral-500)', background: 'var(--color-neutral-100)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                title="Pengaturan"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--color-neutral-500)', background: 'var(--color-neutral-100)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Pengaturan
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

      {/* Page content */}
      <main className="flex-1 p-6 overflow-auto no-scrollbar">
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
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
