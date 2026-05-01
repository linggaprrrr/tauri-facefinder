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

        {/* Right spacer — mirrors brand width */}
        <div className="min-w-36" />
      </header>

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
