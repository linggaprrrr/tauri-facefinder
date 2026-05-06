const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001';
const KIOSK_API_KEY = import.meta.env.VITE_KIOSK_API_KEY ?? '';

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
export async function scanFace(base64Image) {
  const blob = base64ToBlob(base64Image);
  const form = new FormData();
  form.append('file', blob, 'face.jpg');
  form.append('radius', '0.50');
  form.append('top_k', '50');
  form.append('collection_name', 'face_embeddings');

  const res = await fetch(`${API_BASE}/faces/search-by-face`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();

  const photos = (json.data ?? []).map((item) => ({
    id: item.photo_face_id,
    photo_id: item.photo_id,
    filename: item.filename,
    url: item.original_path,
    thumbnail: item.thumbnail_path,
    similarity: item.similarity,
    label: similarityLabel(item.similarity),
    outlet_name: item.outlet_name ?? 'Unknown',
    bounding_box: item.bounding_box,
    uploaded_at: item.uploaded_at,
    price: 15000,
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

// Create kiosk transaction — returns full transaction object from backend
export async function createTransaction({ outletId, photos }) {
  const res = await fetch(`${API_BASE}/transactions/kiosk/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': KIOSK_API_KEY },
    body: JSON.stringify({
      device_id: outletId,
      photos: photos.map((p) => ({ photo_id: p.photo_id })),
    }),
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
