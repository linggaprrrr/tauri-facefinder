import { invoke } from '@tauri-apps/api/core';

// True only inside the Tauri desktop (.exe) shell — printing is a native feature,
// so in a normal browser (dev preview / mobile web) these all no-op gracefully.
export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// [{ name, is_default, state }] — used to populate the Settings printer picker.
export async function listPrinters() {
  if (!isTauri()) return [];
  try {
    return await invoke('list_printers');
  } catch {
    return [];
  }
}

// Silently print a JPEG dataURL to the named printer, `copies` sheets.
// Resolves with the spooler's job id (0 on CUPS, which has none to give) —
// the Rust side only returns Ok once the spooler has actually accepted the
// document, so resolving here means it really is queued at the printer.
export async function printImage(printerName, dataUrl, copies = 1) {
  if (!isTauri()) throw new Error('Printing is only available in the kiosk app');
  if (!printerName) throw new Error('No printer selected');
  return invoke('print_image', {
    printer: printerName,
    bytes: dataUrlToBytes(dataUrl),
    copies,
  });
}

// A throwaway image so staff can validate silent printing without a real photo.
export function makeTestImageDataUrl() {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#013F65';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('TEST PRINT', c.width / 2, 180);
  ctx.font = '24px sans-serif';
  ctx.fillText('Ownize AI Studio', c.width / 2, 230);
  ctx.font = '18px sans-serif';
  ctx.fillText(new Date().toLocaleString(), c.width / 2, 270);
  return c.toDataURL('image/jpeg', 0.92);
}

// Tauri's invoke serializes a number[] into Rust's Vec<u8>.
function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(b64);
  const arr = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
