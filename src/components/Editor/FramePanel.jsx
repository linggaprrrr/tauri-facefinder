import { useLang } from '../../i18n/LanguageContext';

function LayoutFramePreview({ src }) {
  return (
    <div className="relative rounded overflow-hidden" style={{ width: 64, height: 44 }}>
      <div className="absolute inset-0" style={{ background: '#f3e8ff' }} />
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

export default function FramePanel({ activeFrame, onSelect, layoutFrames = [], layoutLoading = false }) {
  const { t } = useLang();
  const activeId = typeof activeFrame === 'object' ? activeFrame?.id : activeFrame;

  return (
    <div
      className="rounded-2xl p-4 h-full overflow-y-auto no-scrollbar"
      style={{ background: '#fff', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-100)' }}
    >
      <h3 className="font-bold mb-3" style={{ color: 'var(--color-neutral-700)' }}>
        {t('frame.title')}
      </h3>
      {layoutLoading && (
        <p className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>{t('frame.loading')}</p>
      )}
      {!layoutLoading && layoutFrames.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>{t('frame.empty')}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {/* None option — always first */}
        <button
          onClick={() => onSelect('none')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all active:scale-95"
          style={{
            background: activeId === 'none' ? '#f3e8ff' : 'var(--color-neutral-50)',
            outline: activeId === 'none' ? '2px solid #7c3aed' : '2px solid transparent',
          }}
        >
          <div
            className="rounded overflow-hidden flex items-center justify-center"
            style={{ width: 64, height: 44, background: 'var(--color-neutral-200)', fontSize: 20 }}
          >
            🚫
          </div>
          <span
            className="text-xs font-semibold text-center leading-tight"
            style={{ color: activeId === 'none' ? '#7c3aed' : 'var(--color-neutral-600)' }}
          >
            {t('frame.none')}
          </span>
        </button>

        {layoutFrames.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all active:scale-95"
            style={{
              background: activeId === f.id ? '#f3e8ff' : 'var(--color-neutral-50)',
              outline: activeId === f.id ? '2px solid #7c3aed' : '2px solid transparent',
            }}
          >
            <LayoutFramePreview src={f.src} />
            <span
              className="text-xs font-semibold text-center leading-tight"
              style={{ color: activeId === f.id ? '#7c3aed' : 'var(--color-neutral-600)' }}
            >
              {f.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
