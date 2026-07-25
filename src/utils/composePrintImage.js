import { renderQrToDataUrl } from './renderQrToDataUrl';

// Compose photo(s) onto a print template at its exact print DPI dimensions —
// plain Canvas 2D, not Konva. Supports both Phase 1 single-slot templates
// (empty/no `slots`, one photo, margin-based) and Phase 2 multi-slot collages
// (`slots` from PrintTemplateVersion, same fractional {id,x,y,w,h,rx} shape
// as the editor's layout frames), plus logo/watermark/QR/date-text overlays.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// Draw `img` into the rect (x,y,w,h) using cover-fit (fills the rect, crops overflow).
function drawCover(ctx, img, x, y, w, h, rx = 0) {
  ctx.save();
  if (rx > 0) roundRectPath(ctx, x, y, w, h, rx);
  else ctx.rect(x, y, w, h);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function substituteTokens(text, tokens) {
  return text.replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match);
}

async function drawTextOverlays(ctx, textOverlays, width, height, tokens) {
  for (const overlay of textOverlays ?? []) {
    const text = substituteTokens(overlay.content ?? '', tokens);
    ctx.font = `${overlay.size ?? 24}px ${overlay.font ?? 'sans-serif'}`;
    ctx.fillStyle = overlay.color ?? '#000000';
    ctx.textBaseline = 'top';
    ctx.fillText(text, (overlay.x ?? 0) * width, (overlay.y ?? 0) * height);
  }
}

async function drawWatermark(ctx, watermark, width, height) {
  if (!watermark?.url) return;
  const img = await loadImage(watermark.url);
  const w = watermark.width_px ?? img.width;
  const h = watermark.height_px ?? img.height;
  ctx.save();
  ctx.globalAlpha = watermark.opacity ?? 1;
  ctx.drawImage(img, (watermark.x ?? 0) * width, (watermark.y ?? 0) * height, w, h);
  ctx.restore();
}

async function drawQr(ctx, qrConfig, width, height, tokens) {
  if (!qrConfig?.enabled) return;
  const value = qrConfig.content === 'custom' ? (qrConfig.customValue ?? '') : (tokens.download_url ?? '');
  if (!value) return;
  const size = qrConfig.size ?? Math.round(Math.min(width, height) * 0.18);
  const dataUrl = await renderQrToDataUrl(value, size);
  const img = await loadImage(dataUrl);
  ctx.drawImage(img, (qrConfig.x ?? 0) * width, (qrConfig.y ?? 0) * height, size, size);
}

// templateVersion: the currentVersion object from usePrintTemplates.
// photos: array of photo dataURLs/URLs, one per slot in slot order (or a
// single-element array for a Phase-1-style single-slot template).
// tokens: { date, outlet_name, download_url } for text_overlays/QR substitution.
export async function composePrintImage(templateVersion, photos, tokens = {}) {
  const { width_px: width, height_px: height, margins, slots, background_url, frame_url, logo_url, watermark, qr_config, text_overlays } = templateVersion;
  const m = { top: 0, right: 0, bottom: 0, left: 0, ...margins };
  const allTokens = { date: new Date().toLocaleDateString('id-ID'), ...tokens };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const [backgroundImg, frameImg, logoImg, photoImgs] = await Promise.all([
    background_url ? loadImage(background_url) : null,
    frame_url ? loadImage(frame_url) : null,
    logo_url ? loadImage(logo_url) : null,
    Promise.all(photos.map(loadImage)),
  ]);

  if (backgroundImg) ctx.drawImage(backgroundImg, 0, 0, width, height);

  if (slots?.length) {
    // Multi-slot collage — same fractional {x,y,w,h,rx} shape as the editor's layout frames.
    slots.forEach((slot, i) => {
      const photoImg = photoImgs[i];
      if (!photoImg) return;
      drawCover(ctx, photoImg, slot.x * width, slot.y * height, slot.w * width, slot.h * height, (slot.rx ?? 0) * Math.min(width, height));
    });
  } else if (photoImgs[0]) {
    // Phase 1 single-slot: one photo, full-bleed minus margins.
    drawCover(ctx, photoImgs[0], m.left, m.top, width - m.left - m.right, height - m.top - m.bottom);
  }

  // frame/logo are full-canvas PNGs authored with transparency, same convention
  // as the editor's existing layout-frame overlays — no separate x/y/size fields.
  if (frameImg) ctx.drawImage(frameImg, 0, 0, width, height);
  if (logoImg) ctx.drawImage(logoImg, 0, 0, width, height);

  await drawWatermark(ctx, watermark, width, height);
  await drawTextOverlays(ctx, text_overlays, width, height, allTokens);
  await drawQr(ctx, qr_config, width, height, allTokens);

  return canvas.toDataURL('image/jpeg', 0.92);
}
