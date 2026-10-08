import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SearchX, X, Images, Filter, ShoppingCart, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import PhotoCard from './PhotoCard';
import PhotoPreview from './PhotoPreview';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import PageHeader from '../common/PageHeader';
import NavBar from '../common/NavBar';
import Modal from '../common/Modal';
import { scanFace, WIDE_SEARCH } from '../../api/mockApi';
import { playSound } from '../../utils/sounds';

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
        background: active ? 'var(--color-primary)' : 'var(--color-card)',
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

  const [showFilters, setShowFilters] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [widen, setWiden] = useState({ status: 'idle', added: 0 }); // idle | searching | done | error

  async function handleWiden() {
    setWiden({ status: 'searching', added: 0 });
    try {
      const { photos: found } = await scanFace(state.capturedFace, WIDE_SEARCH);
      const known = new Set(photos.map((p) => p.id));
      const added = found.filter((p) => !known.has(p.id)).length;
      dispatch({ type: 'MERGE_PHOTOS', payload: found });
      playSound(added ? 'found' : 'notFound');
      setWiden({ status: 'done', added });
    } catch (err) {
      console.error('wide scan failed:', err);
      playSound('error');
      setWiden({ status: 'error', added: 0 });
    }
  }

  const totalPrice = selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  const filtersActive = sort !== 'match' || activeOutlet !== 'All';
  const thumbOf = (p) => p.thumbnail ?? p.url;

  return (
    <div className="flex flex-col h-full gap-4 max-w-8xl mx-auto w-full">

      <PageHeader
        icon={Images}
        title={t('gallery.title')}
        subtitle={t('gallery.subtitle', { count: photos.length })}
        // Sort + outlet chips live behind one button, as in the design: they
        // are used rarely, and two rows of chips cost the grid ~110px.
        action={
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="raised-tile relative flex items-center gap-2 px-5 py-3 rounded-full font-bold"
            style={{ color: showFilters ? 'var(--color-primary)' : 'var(--color-neutral-900)' }}
          >
            <Filter size={20} /> {t('gallery.filter')}
            {filtersActive && (
              <span aria-hidden className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
            )}
          </button>
        }
      />

      {showFilters && (
        <div className="flex flex-col gap-3 shrink-0">
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
        </div>
      )}

      <div className="flex-1 min-h-0 flex gap-4">
        {visiblePhotos.length === 0 ? (
          <div className="flex-1 min-w-0 flex items-center justify-center">
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
             recognisable — the one thing the customer is scanning for. A portrait
             kiosk gets 2 for the same reason: 3 left half the screen empty and
             every face small. */
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 sm:portrait:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 flex-1 min-w-0 overflow-y-auto pb-4 no-scrollbar content-start">
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

        {/* Selected rail — what is in the order, removable in place. Kiosk
            sizes only; on a phone the Next button's count does this job. */}
        <aside className="card hidden sm:flex flex-col gap-3 w-52 shrink-0 p-3 min-h-0" style={{ borderRadius: '1.5rem' }}>
          <div className="flex items-center gap-3">
            <span
              className="relative flex shrink-0 items-center justify-center w-12 h-12 rounded-2xl text-white"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
            >
              <ShoppingCart size={24} />
              {selectedPhotos.length > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-xs font-black flex items-center justify-center"
                  style={{ background: 'var(--color-card)', color: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)' }}
                >
                  {selectedPhotos.length}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="font-black text-lg leading-tight" style={{ color: 'var(--color-neutral-900)' }}>{t('gallery.selectedTitle')}</p>
              <p className="text-sm" style={{ color: 'var(--color-neutral-700)' }}>{t('gallery.photosCount', { count: selectedPhotos.length })}</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-2.5">
            {selectedPhotos.length === 0 ? (
              <p className="text-sm text-center py-6 px-2" style={{ color: 'var(--color-neutral-600)' }}>{t('gallery.footerEmpty')}</p>
            ) : selectedPhotos.map((p) => (
              <div key={p.id} className="relative shrink-0">
                <img src={thumbOf(p)} alt="" className="block w-full aspect-[4/3] object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => handleToggle(p)}
                  aria-label={t('gallery.removeAria')}
                  className="absolute top-1.5 right-1.5 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'var(--color-card)', color: 'var(--color-neutral-900)', boxShadow: 'var(--shadow-md)' }}
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={selectedPhotos.length === 0}
            className="raised-tile flex items-center justify-center gap-2 py-3 rounded-full font-bold disabled:opacity-40"
            style={{ color: 'var(--color-neutral-900)' }}
          >
            <Trash2 size={18} /> {t('gallery.clearAll')}
          </button>
        </aside>
      </div>

      {/* "More photos?" — one wider face search over the face already
          captured, merged into this list. Offered once per visit; needs the
          captured face, so a customer who arrived another way just rescans. */}
      {state.capturedFace && (
        <button
          type="button"
          onClick={handleWiden}
          disabled={widen.status === 'searching' || widen.status === 'done'}
          className="card shrink-0 flex items-center gap-4 p-3 pr-4 text-left disabled:cursor-default"
          style={{ borderRadius: '1.75rem' }}
        >
          <span className="relative hidden sm:block w-28 h-16 shrink-0" aria-hidden>
            {photos.slice(0, 3).map((p, i) => (
              <img
                key={p.id}
                src={thumbOf(p)}
                alt=""
                className="absolute top-1 w-16 h-12 object-cover rounded-md"
                style={{ left: i * 22, transform: `rotate(${(i - 1) * 8}deg)`, border: '3px solid #fff', boxShadow: 'var(--shadow-md)' }}
              />
            ))}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-black text-lg leading-tight" style={{ color: 'var(--color-neutral-900)' }}>{t('gallery.moreTitle')}</span>
            <span className="block text-sm" style={{ color: widen.status === 'error' ? 'var(--color-error)' : 'var(--color-neutral-700)' }}>
              {widen.status === 'searching' ? t('gallery.moreSearching')
                : widen.status === 'done' ? (widen.added ? t('gallery.moreFound', { count: widen.added }) : t('gallery.moreNone'))
                : widen.status === 'error' ? t('gallery.moreError')
                : t('gallery.moreDesc')}
            </span>
          </span>
          {widen.status !== 'done' && (
            <span className="raised-tile flex shrink-0 items-center justify-center w-12 h-12 rounded-full" style={{ color: 'var(--color-neutral-900)' }}>
              {widen.status === 'searching' ? <Loader2 size={22} className="animate-spin" /> : <ChevronRight size={24} strokeWidth={2.5} />}
            </span>
          )}
        </button>
      )}

      {/* Back to rescan / on to the editor. With nothing picked yet, Next's
          second line is the instruction itself instead of a floating hint. */}
      <NavBar
        back={{ label: t('nav.back'), sub: t('gallery.rescan'), onClick: () => navigate('/') }}
        next={{
          label: t('nav.next'),
          sub: selectedPhotos.length
            ? `${t('gallery.selected', { count: selectedPhotos.length })} · Rp ${totalPrice.toLocaleString('id-ID')}`
            : t('gallery.footerEmpty'),
          onClick: () => navigate('/editor'),
          disabled: selectedPhotos.length === 0,
        }}
      />

      {/* Preview. Every prop here is required by PhotoPreview — it derives its
          counter and prev/next from `photos`, and carries the Select button
          that makes tapping a card the start of choosing it. */}
      {confirmClear && (
        <Modal title={t('gallery.clearConfirmTitle')} onClose={() => setConfirmClear(false)} size="sm">
          <div className="px-6 py-5 flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-neutral-700)' }}>{t('gallery.clearConfirmDesc')}</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmClear(false)}>{t('cart.removeCancel')}</Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => { dispatch({ type: 'CLEAR_SELECTION' }); setConfirmClear(false); }}
              >
                <Trash2 size={16} /> {t('gallery.clearAll')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
