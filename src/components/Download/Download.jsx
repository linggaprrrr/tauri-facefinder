import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, Download as DownloadIcon, Banknote, Smartphone, Check } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import ownizeLogo from '../../assets/ownize_logo.png';
import Button from '../common/Button';

const DOWNLOAD_BASE = import.meta.env.VITE_DOWNLOAD_LINK ?? 'https://myphoto.com';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRp(amount) {
  return `Rp ${Number(amount ?? 0).toLocaleString('id-ID')}`;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function Download() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { order, deviceConfig, selectedPhotos, photoEdits } = state;
  const editedPhotos = selectedPhotos.filter((p) => photoEdits[p.id]?.dataUrl);

  if (!order) {
    navigate('/');
    return null;
  }

  function handleRestart() {
    dispatch({ type: 'RESET' });
    navigate('/');
  }

  const isCash = order.cash === true;
  const trxCode = order.trx_code ?? order.orderId ?? '-';
  const downloadUrl = `${DOWNLOAD_BASE}/myqr/${trxCode}`;
  const photos = order.photos ?? selectedPhotos ?? [];
  const finalPrice = order.final_price ?? order.total ?? selectedPhotos?.reduce((s, p) => s + p.price, 0) ?? 0;
  const discount = order.discount_amount ?? 0;
  const unitName = deviceConfig?.unit?.name ?? order.photos?.[0]?.unit?.name ?? '';
  const outletName = deviceConfig?.outlet?.name ?? '';

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch sm:items-start justify-center w-full max-w-4xl mx-auto py-4 sm:py-8">

      {/* ── Left: QR download ── */}
      <div className="flex flex-col items-center gap-5 shrink-0 w-full sm:w-auto">
        <div className="text-center">
          <h1 className="text-3xl font-black" style={{ color: 'var(--color-neutral-900)' }}>
            {t('download.success')}
          </h1>
          <p className="mt-1 text-base" style={{ color: 'var(--color-neutral-500)' }}>
            {t('download.scanInstr')}
          </p>
        </div>

        <div
          className="flex flex-col items-center gap-4 p-6 rounded-3xl"
          style={{
            background: '#fff',
            boxShadow: 'var(--shadow-xl)',
            border: '2px solid var(--color-primary-100)',
            minWidth: 280,
          }}
        >
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'var(--color-primary-50)', border: '1.5px solid var(--color-primary-100)' }}
          >
            <QRCodeSVG value={downloadUrl} size={200} level="H" fgColor="#013F65" />
          </div>

          <p className="font-mono text-xs text-center break-all" style={{ color: 'var(--color-neutral-400)' }}>
            {trxCode}
          </p>

          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            <Clock size={16} /> {t('download.valid24')}
          </div>
        </div>

        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--color-neutral-400)' }}>
          {t('download.cameraInstr')}
        </p>

        {/* Locally-edited photos download */}
        {editedPhotos.length > 0 && (
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: '#fff',
              border: '1.5px solid var(--color-neutral-200)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p className="text-xs font-bold" style={{ color: 'var(--color-neutral-500)' }}>
              {t('download.editedPhotos')}
            </p>
            <div className="flex flex-col gap-2">
              {editedPhotos.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <img
                    src={photoEdits[p.id].dataUrl}
                    alt=""
                    className="rounded-lg object-cover shrink-0"
                    style={{ width: 56, height: 40 }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-neutral-700)' }}>
                    {t('common.photoN', { n: i + 1 })}
                  </span>
                  <button
                    onClick={() => downloadDataUrl(photoEdits[p.id].dataUrl, `edited_photo_${i + 1}.jpg`)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1"
                    style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                  >
                    <DownloadIcon size={14} /> {t('download.save')}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                editedPhotos.forEach((p, i) => {
                  setTimeout(() => downloadDataUrl(photoEdits[p.id].dataUrl, `edited_photo_${i + 1}.jpg`), i * 300);
                });
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              <DownloadIcon size={16} /> {t('download.downloadAll', { count: editedPhotos.length })}
            </button>
          </div>
        )}

        <Button size="xl" onClick={handleRestart} className="w-full">
          {t('download.newTransaction')}
        </Button>
      </div>

      {/* ── Right: Receipt ── */}
      <div
        className="w-full sm:flex-1 rounded-3xl overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: 'var(--shadow-xl)',
          border: '2px solid var(--color-neutral-100)',
          minWidth: 0,
        }}
      >
        {/* Receipt header */}
        <div
          className="px-6 py-5"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <img src={ownizeLogo} alt="Ownize" className="w-10 h-10 object-contain brightness-0 invert" />
            <div>
              <p className="font-black text-xl leading-tight">Ownize Face Finder</p>
              {unitName && (
                <p className="text-sm opacity-80">{unitName}{outletName ? ` — ${outletName}` : ''}</p>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm opacity-80">
            <span>{t('download.code')} <strong className="font-mono text-white opacity-100">{trxCode}</strong></span>
            <span>{formatDate(order.created_at ?? order.paid_at)}</span>
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-neutral-400)' }}>
            {t('download.itemsBought')}
          </p>

          <div className="flex flex-col gap-2">
            {photos.length > 0 ? photos.map((photo, i) => {
              const name = photo.filename ?? photo.name ?? t('common.photoN', { n: i + 1 });
              const price = photo.price ?? (finalPrice / photos.length);
              return (
                <div
                  key={photo.id ?? i}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
                    >
                      {i + 1}
                    </div>
                    <span
                      className="text-sm truncate"
                      style={{ color: 'var(--color-neutral-700)' }}
                      title={name}
                    >
                      {name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-4" style={{ color: 'var(--color-neutral-800)' }}>
                    {formatRp(price)}
                  </span>
                </div>
              );
            }) : (
              <p className="text-sm" style={{ color: 'var(--color-neutral-400)' }}>{t('download.noItems')}</p>
            )}
          </div>

          {/* Totals */}
          <div className="mt-4 flex flex-col gap-1.5">
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-neutral-500)' }}>{t('download.discount')}</span>
                <span style={{ color: 'var(--color-success)' }}>- {formatRp(discount)}</span>
              </div>
            )}
            {order.promo_code_used && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-neutral-500)' }}>{t('download.promoCode')}</span>
                <span className="font-mono" style={{ color: 'var(--color-neutral-700)' }}>{order.promo_code_used}</span>
              </div>
            )}
            <div
              className="flex justify-between items-center pt-3 mt-1"
              style={{ borderTop: '2px dashed var(--color-neutral-200)' }}
            >
              <span className="font-bold text-base" style={{ color: 'var(--color-neutral-900)' }}>{t('common.total')}</span>
              <span className="font-black text-xl" style={{ color: 'var(--color-primary)' }}>
                {formatRp(finalPrice)}
              </span>
            </div>
          </div>

          {/* Payment method badge */}
          <div className="mt-4 flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              style={{
                background: isCash ? 'var(--color-warning-bg)' : 'var(--color-primary-50)',
                color: isCash ? 'var(--color-warning)' : 'var(--color-primary)',
              }}
            >
              {isCash ? <Banknote size={14} /> : <Smartphone size={14} />}
              {isCash ? t('download.cash') : t('download.qris')}
            </span>
            {order.paid && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              >
                <Check size={14} strokeWidth={3} /> {t('download.paid')}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 text-center text-xs"
          style={{ background: 'var(--color-neutral-50)', color: 'var(--color-neutral-400)', borderTop: '1px solid var(--color-neutral-100)' }}
        >
          {t('download.thanks')}
        </div>
      </div>
    </div>
  );
}
