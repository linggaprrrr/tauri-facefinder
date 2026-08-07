import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

function emojiToDataUri(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <text y="96" font-size="96" font-family="Apple Color Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ALL = '__all__';

export default function StickerPanel({ onAdd, stickers = [], loading = false }) {
  const { t } = useLang();
  const [category, setCategory] = useState(ALL);

  // Derived from the data, never hardcoded: the sticker set is per-outlet and
  // served by the backend, so a fixed chip list here would either go stale or
  // advertise empty categories. Sets without categories get no chip row at all.
  const categories = useMemo(() => {
    const found = [...new Set(stickers.map((s) => s.category).filter(Boolean))];
    return found.length > 1 ? [ALL, ...found] : [];
  }, [stickers]);

  // Browsing only — no text filter. This kiosk has no keyboard, so a search
  // field is a control the customer physically cannot use. Categories carry it.
  const visible = useMemo(
    () => stickers.filter((s) => category === ALL || s.category === category),
    [stickers, category]
  );

  function handleAdd(s) {
    if (s.type === 'emoji') {
      onAdd({ src: emojiToDataUri(s.value), stickerId: s.id });
    } else {
      onAdd({ src: s.url, stickerId: s.id });
    }
  }

  return (
    <div
      className="h-full overflow-y-auto no-scrollbar flex flex-col gap-3"
    >
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-0.5">
          {categories.map((c) => {
            const isActive = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={isActive}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-neutral-100)',
                  color:      isActive ? '#fff' : 'var(--color-neutral-700)',
                }}
              >
                {c === ALL ? t('sticker.all') : c}
              </button>
            );
          })}
        </div>
      )}

      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>{t('sticker.loading')}</p>
      )}

      {!loading && visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <SearchX size={28} style={{ color: 'var(--color-neutral-500)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>
            {t('sticker.noMatch')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {visible.map((s) => (
            <button
              key={s.id}
              className="sticker-tile flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95 min-h-28 cursor-pointer"
              onClick={() => handleAdd(s)}
              title={s.label}
            >
              {s.type === 'image' && s.url ? (
                <img src={s.url} alt={s.label} className="w-16 h-16 object-contain" />
              ) : (
                <span className="text-5xl leading-none">{s.value}</span>
              )}
              <span className="text-sm font-semibold text-center leading-tight" style={{ color: 'var(--color-neutral-700)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
