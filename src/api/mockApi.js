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
export async function getOutletsByUnit(unitId) {
  const res = await fetch(`${API_BASE}/outlets/get-outlets-by-unit/${unitId}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.outlets ?? [];
}

// Create kiosk transaction — returns full transaction object from backend.
// photoEdits is the store's { [photoId]: { dataUrl, ... } } map; when a photo
// has an edited render we send it so the backend persists what the customer
// actually made (delivered later via the pickup link), not just the original.
export async function createTransaction({ outletId, photos, photoEdits = {} }) {
  const res = await fetch(`${API_BASE}/transactions/kiosk/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      device_id: outletId,
      photos: photos.map((p) => ({
        photo_id: p.photo_id,
        edited_image: photoEdits[p.id]?.dataUrl ?? null,
      })),
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
