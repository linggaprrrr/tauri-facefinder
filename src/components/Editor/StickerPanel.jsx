import { useLang } from '../../i18n/LanguageContext';

function emojiToDataUri(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <text y="96" font-size="96" font-family="Apple Color Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function StickerPanel({ onAdd, stickers = [], loading = false }) {
  const { t } = useLang();
  function handleAdd(s) {
    if (s.type === 'emoji') {
      onAdd(emojiToDataUri(s.value));
    } else {
      onAdd(s.url);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 h-full overflow-y-auto no-scrollbar"
      style={{ background: '#fff', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-100)' }}
    >
      <h3 className="font-bold mb-3" style={{ color: 'var(--color-neutral-700)' }}>
        {t('sticker.title')}
      </h3>
      {loading && (
        <p className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>{t('sticker.loading')}</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {stickers.map((s) => (
          <button
            key={s.id}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-90 min-h-16"
            style={{ background: 'var(--color-neutral-50)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-50)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-neutral-50)')}
            onClick={() => handleAdd(s)}
            title={s.label}
          >
            {s.type === 'image' && s.url ? (
              <img src={s.url} alt={s.label} className="w-10 h-10 object-contain" />
            ) : (
              <span className="text-3xl leading-none">{s.value}</span>
            )}
            <span className="text-xs mt-1" style={{ color: 'var(--color-neutral-500)' }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
