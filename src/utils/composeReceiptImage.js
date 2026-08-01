import { renderQrToDataUrl } from './renderQrToDataUrl';

// Renders a receipt as a single canvas image sized for a thermal (roll-paper)
// printer, then reuses the exact same native print_image path as photo prints
// — no ESC/POS, no new native code.
//
// This MUST match the printer's dot width or the driver resamples the whole
// receipt: at 576 (80mm) on a 58mm head every glyph was squeezed to 0.67x,
// which is what made the text both fuzzy and tiny. 384 = 48mm printable at
// ~203dpi, the standard 58mm roll, so it maps 1:1.
//
// ponytail: one width for the fleet. If outlets ever mix 58mm and 80mm this
// has to come from the printer/outlet config instead of a constant.
export const RECEIPT_WIDTH_PX = 384;

const PAD = 16;
const CONTENT_W = RECEIPT_WIDTH_PX - PAD * 2;

// Courier New throughout — the classic receipt face, and monospace keeps the
// label/amount columns aligned without measuring. Everything is bold on
// purpose: a thermal head is 1-bit, so a hairline stroke prints as a dotted,
// washed-out line, which is what read as "blurry". A system stack rather than
// a bundled webfont, because canvas silently falls back to a default if the
// webfont hasn't finished loading — an intermittent regression nobody enjoys
// diagnosing.
const MONO = "'Courier New', Courier, monospace";
const QR_SIZE = 200;

function formatRp(amount) {
  return `Rp ${Number(amount ?? 0).toLocaleString('id-ID')}`;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function center(ctx, y, text, font, lineHeight) {
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText(text, RECEIPT_WIDTH_PX / 2, y);
  return y + lineHeight;
}

function row(ctx, y, left, right, font, lineHeight) {
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.fillText(left, PAD, y);
  ctx.textAlign = 'right';
  ctx.fillText(right, PAD + CONTENT_W, y);
  return y + lineHeight;
}

function dashes(ctx, y) {
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + CONTENT_W, y);
  ctx.stroke();
  ctx.setLineDash([]);
  return y + 20;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// receipt: { outletName, unitName, trxCode, date, items:[{name,price}],
//            discount, promoCode, total, paymentLabel, downloadUrl, helpNumber }
export async function composeReceiptImage(receipt) {
  const qrDataUrl = await renderQrToDataUrl(receipt.downloadUrl, QR_SIZE).catch(() => null);
  const qrImg = qrDataUrl ? await loadImage(qrDataUrl) : null;

  // Draw once on a generously tall scratch canvas to find the real content
  // height, then copy that top region onto a canvas trimmed to it — simpler
  // than pre-measuring every wrapped line before drawing.
  const scratch = document.createElement('canvas');
  scratch.width = RECEIPT_WIDTH_PX;
  scratch.height = 2000;
  const ctx = scratch.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  let y = 38;
  y = center(ctx, y, 'Ownize AI Studio', `bold 27px ${MONO}`, 34);
  const sub = [receipt.unitName, receipt.outletName].filter(Boolean).join(' — ');
  if (sub) y = center(ctx, y, sub, `bold 16px ${MONO}`, 26);
  y += 4;
  y = dashes(ctx, y);

  // Code and date get their own lines: side by side they overflow the 352px
  // available on a 58mm roll.
  y = center(ctx, y, receipt.trxCode ?? '-', `bold 17px ${MONO}`, 24);
  y = center(ctx, y, formatDate(receipt.date), `bold 16px ${MONO}`, 26);
  y += 2;
  y = dashes(ctx, y);

  ctx.font = `bold 19px ${MONO}`;
  for (const item of receipt.items ?? []) {
    const priceStr = formatRp(item.price);
    const priceW = ctx.measureText(priceStr).width;
    const lines = wrapText(ctx, item.name, CONTENT_W - priceW - 16);
    lines.forEach((line, i) => {
      ctx.textAlign = 'left';
      ctx.fillText(line, PAD, y);
      if (i === lines.length - 1) {
        ctx.textAlign = 'right';
        ctx.fillText(priceStr, PAD + CONTENT_W, y);
      }
      y += 26;
    });
  }
  y += 4;
  y = dashes(ctx, y);

  if (receipt.discount > 0) y = row(ctx, y, 'Diskon', `- ${formatRp(receipt.discount)}`, `bold 19px ${MONO}`, 26);
  if (receipt.promoCode) y = row(ctx, y, 'Kode Promo', receipt.promoCode, `bold 18px ${MONO}`, 26);
  y = row(ctx, y, 'TOTAL', formatRp(receipt.total), `bold 26px ${MONO}`, 38);
  y += 2;
  y = row(ctx, y, 'Pembayaran', receipt.paymentLabel ?? '-', `bold 19px ${MONO}`, 32);
  y = dashes(ctx, y);

  if (qrImg) {
    // Drawn at exactly the size it was rasterized at — scaling a QR resamples
    // its modules into grey edges that a 1-bit head then dithers, which is
    // what makes an otherwise fine code slow to scan.
    ctx.drawImage(qrImg, (RECEIPT_WIDTH_PX - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
    y += QR_SIZE + 14;
    y = center(ctx, y, 'Scan untuk unduh foto Anda', `bold 16px ${MONO}`, 24);
    y = center(ctx, y, 'Berlaku 7 hari', `bold 16px ${MONO}`, 24);
  }
  y += 8;
  y = center(ctx, y, 'Terima kasih!', `bold 22px ${MONO}`, 36);

  // Support line last, so it survives a customer tearing the roll short and is
  // the thing still in hand when something goes wrong. Only printed when the
  // outlet actually configured a number in Settings — a receipt telling people
  // to contact a blank is worse than one that says nothing.
  if (receipt.helpNumber) {
    y = dashes(ctx, y);
    y = center(ctx, y, 'Butuh bantuan?', `bold 17px ${MONO}`, 24);
    y = center(ctx, y, `WhatsApp ${receipt.helpNumber}`, `bold 19px ${MONO}`, 26);
    y = center(ctx, y, 'Simpan struk ini sebagai bukti', `bold 15px ${MONO}`, 24);
  }

  y += 30; // paper feed

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = RECEIPT_WIDTH_PX;
  finalCanvas.height = Math.ceil(y);
  finalCanvas.getContext('2d').drawImage(scratch, 0, 0);

  // PNG, not JPEG: the receipt is pure black-on-white text, exactly the content
  // JPEG's DCT handles worst — the ringing it leaves around every glyph edge
  // becomes visible speckle once a 1-bit thermal head thresholds it. Lossless
  // costs nothing here; the image is small and monochrome.
  return finalCanvas.toDataURL('image/png');
}
