import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';

// Rasterizes a QR code to a PNG dataURL by off-screen-mounting the already-
// installed qrcode.react's canvas component — reuses its (tested) encoder
// instead of adding a second QR dependency just to get a canvas-drawable bitmap.
export function renderQrToDataUrl(value, size = 300) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = createRef();

    function cleanup() {
      root.unmount();
      container.remove();
    }

    root.render(createElement(QRCodeCanvas, { ref, value, size, level: 'H', marginSize: 2 }));

    // Two rAFs: one for React's commit, one for the browser paint that follows it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        if (!ref.current) throw new Error('QR canvas did not mount');
        const dataUrl = ref.current.toDataURL('image/png');
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        cleanup();
        reject(e);
      }
    }));
  });
}
