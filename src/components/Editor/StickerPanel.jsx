const STICKERS = [
  { id: 's1',  emoji: '😂', label: 'LOL' },
  { id: 's2',  emoji: '❤️', label: 'Love' },
  { id: 's3',  emoji: '🌟', label: 'Star' },
  { id: 's4',  emoji: '🎉', label: 'Party' },
  { id: 's5',  emoji: '🔥', label: 'Fire' },
  { id: 's6',  emoji: '🌈', label: 'Rainbow' },
  { id: 's7',  emoji: '🦋', label: 'Butterfly' },
  { id: 's8',  emoji: '🌸', label: 'Flower' },
  { id: 's9',  emoji: '🐶', label: 'Dog' },
  { id: 's10', emoji: '🎈', label: 'Balloon' },
  { id: 's11', emoji: '🍕', label: 'Pizza' },
  { id: 's12', emoji: '☀️', label: 'Sun' },
];

function emojiToDataUri(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <text y="96" font-size="96" font-family="Apple Color Emoji,Noto Color Emoji,sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function StickerPanel({ onAdd }) {
  return (
    <div
      className="rounded-2xl p-4 h-full overflow-y-auto no-scrollbar"
      style={{ background: '#fff', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-100)' }}
    >
      <h3 className="font-bold mb-3" style={{ color: 'var(--color-neutral-700)' }}>
        Stickers
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {STICKERS.map((s) => (
          <button
            key={s.id}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-90 min-h-16"
            style={{ background: 'var(--color-neutral-50)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-50)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-neutral-50)')}
            onClick={() => onAdd(emojiToDataUri(s.emoji))}
            title={s.label}
          >
            <span className="text-3xl leading-none">{s.emoji}</span>
            <span className="text-xs mt-1" style={{ color: 'var(--color-neutral-500)' }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
