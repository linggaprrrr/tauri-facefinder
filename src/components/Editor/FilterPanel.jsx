import Konva from 'konva';
import { RotateCcw } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const FILTER_PRESETS = [
  { id: 'none',      labelKey: 'filter.normal', filters: [] },
  { id: 'grayscale', labelKey: 'filter.bw',     filters: [Konva.Filters.Grayscale] },
  { id: 'sepia',     labelKey: 'filter.sepia',  filters: [Konva.Filters.Sepia] },
  { id: 'invert',    labelKey: 'filter.invert', filters: [Konva.Filters.Invert] },
  { id: 'blur',      labelKey: 'filter.blur',   filters: [Konva.Filters.Blur] },
];

export default function FilterPanel({ filters, onChange }) {
  const { t } = useLang();
  const panelStyle = {
    background: '#fff',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--color-neutral-100)',
  };
  const labelStyle = { color: 'var(--color-neutral-500)', fontSize: '0.75rem', fontWeight: 600 };

  function applyPreset(preset) {
    onChange((prev) => ({ ...prev, list: preset.filters }));
  }

  // Check active preset by comparing filter list reference
  function isActive(preset) {
    return JSON.stringify(filters.list.map(String)) === JSON.stringify(preset.filters.map(String));
  }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={panelStyle}>
      <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>{t('filter.title')}</h3>

      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-2">
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.id}
            className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{
              background: isActive(p) ? 'var(--color-primary)' : 'var(--color-neutral-100)',
              color: isActive(p) ? '#fff' : 'var(--color-neutral-700)',
            }}
            onClick={() => applyPreset(p)}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {/* Brightness */}
      <div>
        <label className="block mb-1" style={labelStyle}>
          {t('filter.brightness')}: {filters.brightness > 0 ? '+' : ''}{filters.brightness.toFixed(2)}
        </label>
        <input
          type="range" min={-1} max={1} step={0.05}
          value={filters.brightness}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              brightness: Number(e.target.value),
              list: prev.list.includes(Konva.Filters.Brighten)
                ? prev.list
                : [...prev.list, Konva.Filters.Brighten],
            }))
          }
          style={{ width: '100%', accentColor: 'var(--color-primary)' }}
        />
      </div>

      {/* Contrast */}
      <div>
        <label className="block mb-1" style={labelStyle}>
          {t('filter.contrast')}: {filters.contrast > 0 ? '+' : ''}{filters.contrast.toFixed(0)}
        </label>
        <input
          type="range" min={-100} max={100} step={5}
          value={filters.contrast}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              contrast: Number(e.target.value),
              list: prev.list.includes(Konva.Filters.Contrast)
                ? prev.list
                : [...prev.list, Konva.Filters.Contrast],
            }))
          }
          style={{ width: '100%', accentColor: 'var(--color-primary)' }}
        />
      </div>

      <button
        className="py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5"
        style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
        onClick={() => onChange({ list: [], brightness: 0, contrast: 0 })}
      >
        <RotateCcw size={16} /> {t('filter.reset')}
      </button>
    </div>
  );
}
