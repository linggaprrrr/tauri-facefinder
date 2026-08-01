// Resolves a cart photo to the raw dataURL composePrintImage needs — the
// customer's edited render if requested and available, else the original
// fetched and converted to a dataURL. There is deliberately no raw-bytes
// shortcut for originals: everything funnels through a dataURL so it can be
// composed onto the template and mirrored into the local print queue for
// retry-after-restart.
export async function resolvePrintSource(photo, source, photoEdits) {
  if (source === 'edited' && photoEdits[photo.id]?.dataUrl) return photoEdits[photo.id].dataUrl;
  // proxyUrl is a resized editor-preview render — fine for the canvas, wrong
  // for a physical print. Prefer the true original; only fall back to proxy
  // if the original genuinely isn't available.
  const resp = await fetch(photo.url ?? photo.proxyUrl);
  if (!resp.ok) throw new Error(`Could not load image (${resp.status})`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}
