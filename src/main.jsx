import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { isTauri } from './native/print';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { installSounds } from './utils/sounds';

// A 22" 1080x1920 kiosk is ~100ppi viewed standing, so laptop-sized UI reads
// tiny. Page zoom scales every px/rem/icon at once and Konva follows it.
// screen.width already counts Windows display scaling, so a kiosk set to 125%
// there (864 wide) is left alone instead of zoomed twice.
// ponytail: one fixed factor; add a per-device setting if screen sizes vary.
if (isTauri() && screen.height > screen.width && screen.width >= 1000) {
  getCurrentWebview().setZoom(1.25).catch(() => {});
}

// Kiosk only: on a customer's own phone (mobile web) a page that clicks at
// them is unwelcome, and the phone already gives its own touch feedback.
if (isTauri()) installSounds();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
