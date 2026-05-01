const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

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

// Simulate payment confirmation
export async function confirmPayment({ method, photos }) {
  await delay(1500);
  return {
    success: true,
    orderId: `ORDER-${Date.now()}`,
    downloadUrl: `https://example.com/download/${Date.now()}`,
  };
}

// Simulate getting a download QR
export async function getDownloadQr(orderId) {
  await delay(500);
  return { qrValue: `https://example.com/download/${orderId}` };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
