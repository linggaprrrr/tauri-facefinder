import { renderQrToDataUrl } from './renderQrToDataUrl';

// Renders a receipt as a single canvas image sized for a thermal (roll-paper)
// printer, then reuses the exact same native print_image path as photo prints
// — no ESC/POS, no new native code. 576px matches an 80mm roll at ~203dpi;
// for a 58mm printer change this to 384.
export const RECEIPT_WIDTH_PX = 576;

const PAD = 28;
const CONTENT_W = RECEIPT_WIDTH_PX - PAD * 2;

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
//            discount, promoCode, total, paymentLabel, downloadUrl }
export async function composeReceiptImage(receipt) {
  const qrDataUrl = await renderQrToDataUrl(receipt.downloadUrl, 260).catch(() => null);
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

  let y = 44;
  y = center(ctx, y, 'Ownize AI Studio', 'bold 30px sans-serif', 38);
  const sub = [receipt.unitName, receipt.outletName].filter(Boolean).join(' — ');
  if (sub) y = center(ctx, y, sub, '20px sans-serif', 28);
  y += 6;
  y = dashes(ctx, y);

  y = row(ctx, y, receipt.trxCode ?? '-', formatDate(receipt.date), '20px monospace', 30);
  y += 4;
  y = dashes(ctx, y);

  ctx.font = '20px sans-serif';
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
      y += 28;
    });
  }
  y += 4;
  y = dashes(ctx, y);

  if (receipt.discount > 0) y = row(ctx, y, 'Diskon', `- ${formatRp(receipt.discount)}`, '20px sans-serif', 28);
  if (receipt.promoCode) y = row(ctx, y, 'Kode Promo', receipt.promoCode, '20px monospace', 28);
  y = row(ctx, y, 'TOTAL', formatRp(receipt.total), 'bold 26px sans-serif', 40);
  y += 4;
  y = row(ctx, y, 'Pembayaran', receipt.paymentLabel ?? '-', '20px sans-serif', 36);
  y = dashes(ctx, y);

  if (qrImg) {
    const qrSize = 220;
    ctx.drawImage(qrImg, (RECEIPT_WIDTH_PX - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 16;
    y = center(ctx, y, 'Scan untuk unduh foto', '18px sans-serif', 26);
  }
  y += 10;
  y = center(ctx, y, 'Terima kasih!', 'bold 22px sans-serif', 40);
  y += 30; // paper feed

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = RECEIPT_WIDTH_PX;
  finalCanvas.height = Math.ceil(y);
  finalCanvas.getContext('2d').drawImage(scratch, 0, 0);

  return finalCanvas.toDataURL('image/jpeg', 0.95);
}
