import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, SearchX, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import PhotoCard from './PhotoCard';
import PhotoPreview from './PhotoPreview';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';

// Default is `match` because the backend already ranks the search by
// similarity — anything else would silently discard that ranking.
const SORTS = {
  match:  (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0),
  newest: (a, b) => String(b.uploaded_at ?? '').localeCompare(String(a.uploaded_at ?? '')),
  price:  (a, b) => (a.price ?? 0) - (b.price ?? 0),
};

const SORT_OPTIONS = [
  { key: 'match',  labelKey: 'gallery.sortMatch' },
  { key: 'newest', labelKey: 'gallery.sortNewest' },
  { key: 'price',  labelKey: 'gallery.sortPrice' },
];

// One chip style for both rows below. They filter on different axes, so each
// group gets its own label rather than being merged into one undifferentiated
// strip of pills.
function Chip({ active, onClick, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer active:scale-95"
      style={{
        minHeight: 44,   // kiosk touch target
        background: active ? 'var(--color-primary)' : '#fff',
        color:      active ? '#fff' : 'var(--color-neutral-700)',
        border:     active ? '2px solid var(--color-primary)' : '2px solid var(--color-neutral-200)',
        boxShadow:  active ? '0 2px 10px rgba(1,125,197,0.25)' : 'var(--shadow-sm)',
      }}
    >
      {children}
    </button>
  );
}

export default function Gallery() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const { photos, selectedPhotos } = state;

  const outlets = useMemo(() => {
    const names = photos.map((p) => p.outlet_name).filter(Boolean);
    return ['All', ...Array.from(new Set(names))];
  }, [photos]);

  // Count photos per outlet for chip badges
  const outletCounts = useMemo(() => {
    const counts = { All: photos.length };
    photos.forEach((p) => {
      if (p.outlet_name) counts[p.outlet_name] = (counts[p.outlet_name] || 0) + 1;
    });
    return counts;
  }, [photos]);

  const [activeOutlet, setActiveOutlet] = useState('All');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [sort, setSort] = useState('match');

  // No text search: this kiosk has no keyboard, so a search field is a control
  // a customer physically cannot use. Filtering is chips only.
  const visiblePhotos = useMemo(() => (
    photos
      .filter((p) => activeOutlet === 'All' || p.outlet_name === activeOutlet)
      .sort(SORTS[sort] ?? SORTS.match)
  ), [photos, activeOutlet, sort]);

  function handleToggle(photo) {
    dispatch({ type: 'TOGGLE_PHOTO', payload: photo });
  }

  const totalPrice = selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  // Max 4 thumbnails shown in footer strip
  const STRIP_MAX = 4;
  const stripPhotos = selectedPhotos.slice(0, STRIP_MAX);
  const extraCount  = selectedPhotos.length - STRIP_MAX;

  return (
    <div className="flex flex-col h-full gap-4 max-w-8xl mx-auto w-full">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-black on-bg-text" style={{ color: 'var(--color-neutral-900)' }}>
            {t('gallery.title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-neutral-600)' }}>
            {t('gallery.subtitle', { count: photos.length })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort — chips, not a <select>. A native dropdown on a kiosk means
              an OS picker the outlet's touch driver renders however it likes,
              and it cannot be styled to match anything here. */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-neutral-600)' }}>
              {t('gallery.sortLabel')}
            </span>
            <div className="flex gap-1.5" role="group" aria-label={t('gallery.sortLabel')}>
              {SORT_OPTIONS.map(({ key, labelKey }) => (
                <Chip key={key} active={sort === key} onClick={() => setSort(key)}>
                  {t(labelKey)}
                </Chip>
              ))}
            </div>
          </div>

          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> {t('gallery.rescan')}
          </Button>
        </div>
      </div>

      {/* Outlet filter chips with photo count */}
      {outlets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0">
          {outlets.map((name) => {
            const isActive = activeOutlet === name;
            const count = outletCounts[name] ?? 0;
            const label = name === 'All' ? t('gallery.all') : name;
            return (
              <Chip key={name} active={isActive} onClick={() => setActiveOutlet(name)}>
                {label}
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    minWidth: 20, height: 20, padding: '0 5px',
                    background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--color-neutral-200)',
                    color:      isActive ? '#fff'                    : 'var(--color-neutral-600)',
                  }}
                >
                  {count}
                </span>
              </Chip>
            );
          })}
        </div>
      )}

      {visiblePhotos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          {activeOutlet !== 'All' ? (
            <EmptyState
              icon={SearchX}
              title={t('gallery.noMatchTitle')}
              description={t('gallery.noMatchDesc')}
              action={
                <Button size="lg" onClick={() => setActiveOutlet('All')} className="mt-2">
                  <X size={20} /> {t('gallery.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title={t('gallery.emptyTitle')}
              description={t('gallery.emptyDesc')}
              action={
                <Button size="lg" onClick={() => navigate('/')} className="mt-2">
                  <ArrowLeft size={20} /> {t('gallery.rescan')}
                </Button>
              }
            />
          )}
        </div>
      ) : (
        /* Uniform grid, capped at 5 columns. It used to widen to 8 on a large
           kiosk screen, which pushed each photo below the size where a face is
           recognisable — the one thing the customer is scanning for. */
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 flex-1 overflow-y-auto pb-4 no-scrollbar content-start">
          {visiblePhotos.map((photo) => {
            const orderIdx = selectedPhotos.findIndex((p) => p.id === photo.id);
            const isSelected = orderIdx !== -1;
            return (
              <PhotoCard
                key={photo.id}
                photo={photo}
                selected={isSelected}
                selectionOrder={isSelected ? orderIdx + 1 : null}
                onPreview={setPreviewPhoto}
                onToggle={handleToggle}
              />
            );
          })}
        </div>
      )}

      {/* Sticky footer — always visible. `relative` so the hint can float over it. */}
      <div className="relative shrink-0">

        {/* Floating hint. Sits above the bar rather than inside it so it reads
            as a prompt about the photos, not as a label for the footer, and
            pointer-events-none keeps it from stealing a tap meant for a card. */}
        {selectedPhotos.length === 0 && (
          <div
            className="pop-in pointer-events-none absolute left-1/2 -translate-x-1/2 -top-6 z-10
              px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap"
            style={{
              background: 'var(--color-neutral-900)',
              color: '#fff',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {t('gallery.footerEmpty')}
          </div>
        )}

        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: '#fff',
            border: '1.5px solid var(--color-primary-100)',
            boxShadow: 'var(--shadow-lg)',
            minHeight: 68,
          }}
        >
          {selectedPhotos.length === 0 ? (
            /* pl reserve clears the fixed WhatsApp button on desktop; none on
               mobile where the help FAB sits below the footer flow. */
            <div className="flex-1 pl-0 sm:pl-[148px]" />
          ) : (
            /* Thumbnail strip */
            <div className="flex items-center gap-2 flex-1 min-w-0 pl-0 sm:pl-[120px]">
              {stripPhotos.map((p) => (
                <div key={p.id} className="relative shrink-0 group">
                  <img
                    src={p.thumbnail}
                    alt=""
                    className="rounded-lg object-cover"
                    style={{
                      width: 44, height: 33,
                      border: '2px solid var(--color-primary)',
                    }}
                  />
                  {/* × deselect button */}
                  <button
                    onClick={() => handleToggle(p)}
                    aria-label={t('gallery.removeAria')}
                    className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full transition-all"
                    style={{
                      width: 16, height: 16,
                      background: 'var(--color-error)',
                      color: '#fff',
                      border: '1.5px solid #fff',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={8} strokeWidth={3} />
                  </button>
                </div>
              ))}
              {extraCount > 0 && (
                <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-neutral-600)' }}>
                  +{extraCount}
                </span>
              )}
            </div>
          )}

          {/* Price + CTA */}
          <div className="flex items-center gap-3 shrink-0">
            {selectedPhotos.length > 0 && (
              <div className="text-right">
                <p className="text-xs font-semibold" style={{ color: 'var(--color-neutral-600)' }}>
                  {t('gallery.selected', { count: selectedPhotos.length })}
                </p>
                <p className="text-lg font-black" style={{ color: 'var(--color-primary)' }}>
                  Rp {totalPrice.toLocaleString('id-ID')}
                </p>
              </div>
            )}
            <Button
              size="lg"
              onClick={() => navigate('/editor')}
              disabled={selectedPhotos.length === 0}
            >
              {t('gallery.continue')} <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Preview. Every prop here is required by PhotoPreview — it derives its
          counter and prev/next from `photos`, and carries the Select button
          that makes tapping a card the start of choosing it. */}
      {previewPhoto && (
        <PhotoPreview
          photo={previewPhoto}
          photos={visiblePhotos}
          onNavigate={setPreviewPhoto}
          onClose={() => setPreviewPhoto(null)}
          selected={selectedPhotos.some((p) => p.id === previewPhoto.id)}
          onToggleSelect={() => handleToggle(previewPhoto)}
        />
      )}
    </div>
  );
}
