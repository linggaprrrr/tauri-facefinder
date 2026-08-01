import { getKioskId } from '../utils/kioskId';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001';
const KIOSK_API_KEY = import.meta.env.VITE_KIOSK_API_KEY ?? '';

// Typed API error so callers can tell a dead link ('network'/'timeout') apart
// from a server fault ('server') or a real business result (e.g. no matches).
export class ApiError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // 'network' | 'timeout' | 'server'
    this.status = status;
  }
}

// Lightweight liveness probe for the connectivity layer. Returns a boolean and
// never throws — a network failure / timeout simply reads as "not reachable".
export async function checkHealth(timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function base64ToBlob(base64) {
  const [meta, data] = base64.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function similarityLabel(score) {
  if (score >= 0.72) return 'Paling Mirip';
  if (score >= 0.60) return 'Mirip';
  return 'Mungkin anda';
}

// Call the real face-search API, returns matched photos
export async function scanFace(base64Image, timeoutMs = 20000) {
  const blob = base64ToBlob(base64Image);
  const form = new FormData();
  form.append('file', blob, 'face.jpg');
  form.append('radius', '0.50');
  form.append('top_k', '50');
  form.append('collection_name', 'face_embeddings');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}/faces/search-by-face`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    // fetch only rejects on network failure / abort — distinguish them so the
    // UI can say "connection lost, retry" instead of "scan failed".
    throw new ApiError(e.name === 'AbortError' ? 'timeout' : 'network', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new ApiError('server', `API error ${res.status}`, res.status);
  const json = await res.json();

  const photos = (json.data ?? []).map((item) => ({
    id: item.photo_face_id,
    photo_id: item.photo_id,
    filename: item.filename,
    url: item.original_path,
    // proxy_url = backend-resized version for safe editor preview.
    // Falls back to original so the editor stays usable when no proxy is available.
    proxyUrl: item.proxy_url ?? item.original_path,
    thumbnail: item.thumbnail_path,
    similarity: item.similarity,
    label: similarityLabel(item.similarity),
    outlet_name: item.outlet_name ?? 'Unknown',
    bounding_box: item.bounding_box,
    uploaded_at: item.uploaded_at,
    price: item.photo_price ?? 0,
    face_count: item.face_count ?? 1,
  }));

  return { photos };
}

// Fetch all units
export async function getUnits() {
  const res = await fetch(`${API_BASE}/units/?page=1&limit=100`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

// Fetch outlets for a given unit
// isKiosk: the device-setup picker in Settings only lists kiosk-flagged
// outlets — a physical kiosk terminal has no business belonging to a
// staffed, non-kiosk outlet.
// Photos the customer uploaded from their phone into this editing session.
// Returns [{ id, slot_id, status, url }] — one row per filled placeholder.
export async function getSessionUploads(sessionId) {
  const res = await fetch(`${API_BASE}/session-uploads/${sessionId}`, {
    headers: { 'api-key': KIOSK_API_KEY },
  });
  if (!res.ok) throw new ApiError('server', `API error ${res.status}`, res.status);
  return (await res.json()).data ?? [];
}

// The URL encoded into the placeholder's QR. The customer's phone opens this,
// so it points at the public download/upload web app, not the kiosk.
export function sessionUploadUrl(sessionId, slotId) {
  const base = (import.meta.env.VITE_DOWNLOAD_LINK ?? 'https://myphoto.com').replace(/\/$/, '');
  return `${base}/upload/${sessionId}/${slotId}`;
}

// Kiosk branding for an outlet — fetched at boot and cached, so a kiosk that
// starts up offline still renders the operator's branding from last run.
export async function getOutletKioskConfig(outletId) {
  const res = await fetch(`${API_BASE}/outlets/${outletId}/kiosk-config`, {
    headers: { 'api-key': KIOSK_API_KEY },
    // Settings' sync re-fetches this to apply branding without a reboot; a
    // WebView-cached 200 would silently make that button do nothing.
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError('server', `API error ${res.status}`, res.status);
  return res.json();
}

// Authoritative Settings-PIN check. Throws ApiError with .status 401 (wrong)
// or 429 (server-side rate limit) — deviceAuth treats anything else as "could
// not reach the server" and falls back to its offline credential.
export async function verifyOutletPin(outletId, pin) {
  const res = await fetch(`${API_BASE}/outlets/${outletId}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new ApiError('server', `API error ${res.status}`, res.status);
  return res.json();
}

export async function getOutletsByUnit(unitId, { isKiosk } = {}) {
  const params = isKiosk === undefined ? '' : `?is_kiosk=${isKiosk}`;
  const res = await fetch(`${API_BASE}/outlets/get-outlets-by-unit/${unitId}${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.outlets ?? [];
}

// Create kiosk transaction — returns full transaction object from backend.
// promoCode is optional: a Promo Voucher that only partially covers the cart
// chains into this (see ScanRunner) so the remainder is still paid via QRIS,
// discount already applied server-side.
// Wire shape for a print order. No price/template id is ever sent — print_type
// is a *mode* ('primary' photo layout vs 'secondary' photo strip) and the server
// maps it to the outlet's own configured template, same source-of-truth pattern
// as photo pricing. photo_sources carries the customer's original-vs-edited
// choice, which used to live only in kiosk state and was lost on reload.
function printItemsPayload(printItems) {
  return (printItems ?? [])
    .filter((item) => item.canSubmit)
    .map((item) => ({
      photo_ids: item.photoIds,
      copies: item.copies,
      print_type: item.printType ?? 'primary',
      photo_sources: item.sources ?? {},
    }));
}

export async function createTransaction({ outletId, photos, promoCode, printItems }) {
  const res = await fetch(`${API_BASE}/transactions/kiosk/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      device_id: outletId,
      // edited_image (base64 render) is persisted so the customer receives what
      // they actually made — stickers/text/filter, or a framed collage on top.
      photos: photos.map((p) => ({ photo_id: p.photo_id, edited_image: p.edited_image ?? null })),
      promo_code: promoCode ?? null,
      print_items: printItemsPayload(printItems),
    }),
  });

  if (!res.ok) {
    let detail = `Server error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? body.error ?? JSON.stringify(body);
    } catch { /* non-JSON body, keep default */ }
    throw new Error(detail);
  }

  const json = await res.json();
  // Backend wraps the transaction: { transaction: {...}, payment_url, token_id, ... }
  // Flatten so callers get one consistent object
  return {
    ...(json.transaction ?? json),
    payment_url: json.payment_url ?? json.transaction?.payment_url,
    token_id: json.token_id,
    payment_due_minutes: json['doku response']?.payment?.payment_due_date ?? 5,
  };
}

// Per-outlet access-method config (which checkout methods are enabled, order,
// badges, copy overrides). No configured rows means "unconfigured" — the
// backend synthesizes a QRIS-only default, so an unmigrated/unreachable
// backend behaves exactly like today's QRIS-only checkout.
export async function getOutletAccessMethods(outletId, etag = null) {
  const res = await fetch(`${API_BASE}/outlets/${outletId}/access-methods`, {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return {
    data: (await res.json()).data ?? [],
    etag: res.headers.get('etag'),
  };
}

// Check a scanned/typed code without creating anything — lets the runner
// show "Voucher applied · Rp X off" or a rejection reason before the
// customer commits. Always resolves to { outcome, ... }, never throws for a
// rejected code (only for a genuine network/server failure).
export async function validateAccessMethod({ outletId, methodKey, code, orderAmount }) {
  const res = await fetch(`${API_BASE}/access/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({ outlet_id: outletId, method_key: methodKey, code, order_amount: orderAmount }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Zero-payment access grant (Event Ticket, or a Promo Voucher that fully
// covers the cart) — re-validated server-side regardless of the prior
// validateAccessMethod call. Returns the same flattened shape as
// createTransaction so callers (SET_ORDER, /download) don't need to branch.
export async function grantAccess({ outletId, methodKey, code, note, photos, printItems }) {
  const res = await fetch(`${API_BASE}/transactions/kiosk/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      device_id: outletId,
      method_key: methodKey,
      code,
      note: note ?? null,
      photos: photos.map((p) => ({ photo_id: p.photo_id, edited_image: p.edited_image ?? null })),
      // Same shape createTransaction sends. Omitting it silently dropped a
      // paid-for print from the order: nothing charged, nothing printed, no
      // receipt line — the customer just lost the print they selected.
      print_items: printItemsPayload(printItems),
    }),
  });
  if (!res.ok) {
    let detail = `Server error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? body.error ?? JSON.stringify(body);
    } catch { /* non-JSON body, keep default */ }
    throw new Error(detail);
  }
  const json = await res.json();
  return { ...(json.transaction ?? json) };
}

// Outlet-level printing config (enable/disable + default template), distinct
// from deviceConfig.printEnabled/printerName which is the kiosk's own
// hardware capability toggle. null default_template_id means printing is
// enabled but no template has been assigned yet.
export async function getOutletPrintSetting(outletId) {
  const res = await fetch(`${API_BASE}/outlets/${outletId}/printing`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function getPrintTemplates(outletId, etag = null) {
  const url = outletId
    ? `${API_BASE}/print-templates/?outlet_id=${outletId}`
    : `${API_BASE}/print-templates/`;
  const res = await fetch(url, {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return {
    data: (await res.json()).data ?? [],
    etag: res.headers.get('etag'),
  };
}

// Register a print attempt before the native print call — so a crash mid-print
// still leaves a job the Download screen can offer to reprint. photoIds is
// ordered by slot index (a single-slot print is just a 1-item array).
export async function createPrintJob({ transactionId, outletId, templateVersionId, photoIds, copies }) {
  const res = await fetch(`${API_BASE}/print-jobs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      transaction_id: transactionId,
      outlet_id: outletId,
      template_version_id: templateVersionId,
      photo_ids: photoIds,
      copies,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function updatePrintJobStatus(jobId, { status, message, printerName } = {}) {
  const res = await fetch(`${API_BASE}/print-jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    // kiosk_id is attached here rather than passed in by callers — it's how the
    // backend attributes consumed sheets to the right physical printer, and a
    // caller that forgot it would silently stop decrementing stock (see the
    // print_type that QrisRunner dropped). One place, can't be forgotten.
    body: JSON.stringify({ status, message, printer_name: printerName, kiosk_id: getKioskId() }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function retryPrintJob(jobId) {
  const res = await fetch(`${API_BASE}/print-jobs/${jobId}/retry`, {
    method: 'POST',
    headers: { 'api-key': KIOSK_API_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function reprintPrintJob(jobId) {
  const res = await fetch(`${API_BASE}/print-jobs/${jobId}/reprint`, {
    method: 'POST',
    headers: { 'api-key': KIOSK_API_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Get transaction status by ID
export async function getTransaction(transactionId) {
  const res = await fetch(`${API_BASE}/transactions/${transactionId}`, {
    headers: { 'api-key': KIOSK_API_KEY },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Cancel a pending transaction
export async function cancelTransaction(transactionId) {
  const res = await fetch(`${API_BASE}/transactions/${transactionId}/cancel`, {
    method: 'PATCH',
    headers: { 'api-key': KIOSK_API_KEY },
  });
  if (!res.ok) throw new Error(`Cancel error ${res.status}`);
  return res.json();
}

export async function getStickers(outletId, etag = null) {
  const url = outletId
    ? `${API_BASE}/stickers/?outlet_id=${outletId}`
    : `${API_BASE}/stickers/`;
  const res = await fetch(url, {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return {
    data: (await res.json()).data ?? [],
    etag: res.headers.get('etag'),
  };
}

export async function getLayoutFrames(outletId, etag = null) {
  const url = outletId
    ? `${API_BASE}/templates/?outlet_id=${outletId}`
    : `${API_BASE}/templates/`;
  const res = await fetch(url, {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return {
    data: (await res.json()).data ?? [],
    etag: res.headers.get('etag'),
  };
}

export async function getAiTemplates(outletId, etag = null) {
  const url = outletId
    ? `${API_BASE}/ai-templates/?outlet_id=${outletId}`
    : `${API_BASE}/ai-templates/`;
  const res = await fetch(url, {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return {
    data: (await res.json()).data ?? [],
    etag: res.headers.get('etag'),
  };
}

// Persist a client-rendered frame/collage as a free Photo. Returns { image_url, photo_id }.
export async function createCompositePhoto({ outletId, sourcePhotoId, imageBase64, templateId, stickerIds }) {
  const res = await fetch(`${API_BASE}/kiosk-render/composite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      device_id: outletId,
      source_photo_id: sourcePhotoId ?? null,
      image_base64: imageBase64,
      template_id: templateId ?? null,
      sticker_ids: stickerIds ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError('server', body.detail ?? `Server error ${res.status}`, res.status);
  }
  return res.json(); // { image_url, photo_id }
}

// Upserts this kiosk's row in kiosk_printers (by kiosk_id) — powers the admin
// fleet view's online/offline + printer pairing display.
export async function sendKioskHeartbeat({
  kioskId, outletId, printerName, printerStatus,
  secondaryPrinterName, secondaryPrinterStatus,
  receiptPrinterName, receiptPrinterStatus, appVersion,
}) {
  const res = await fetch(`${API_BASE}/kiosk-printers/heartbeat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      kiosk_id: kioskId,
      outlet_id: outletId,
      printer_name: printerName,
      printer_status: printerStatus,
      secondary_printer_name: secondaryPrinterName ?? null,
      secondary_printer_status: secondaryPrinterStatus ?? null,
      receipt_printer_name: receiptPrinterName ?? null,
      receipt_printer_status: receiptPrinterStatus ?? null,
      app_version: appVersion,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function aiTransform({ outletId, photoUrl, templateId, sourcePhotoId }, timeoutMs = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}/ai-templates/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({ device_id: outletId, photo_url: photoUrl, template_id: templateId, source_photo_id: sourcePhotoId ?? null }),
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'timeout' : 'network', 'AI transform request failed');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError('rate_limit', body.detail ?? 'Batas transform AI tercapai. Coba lagi nanti.', 429);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError('server', body.detail ?? `Server error ${res.status}`, res.status);
  }
  return res.json(); // { image_url }
}
