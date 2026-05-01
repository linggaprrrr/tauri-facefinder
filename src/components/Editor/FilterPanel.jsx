import Konva from 'konva';

const FILTER_PRESETS = [
  { id: 'none',      label: 'Normal',   filters: [] },
  { id: 'grayscale', label: 'B&W',      filters: [Konva.Filters.Grayscale] },
  { id: 'sepia',     label: 'Sepia',    filters: [Konva.Filters.Sepia] },
  { id: 'invert',    label: 'Invert',   filters: [Konva.Filters.Invert] },
  { id: 'blur',      label: 'Soft Blur',filters: [Konva.Filters.Blur] },
];

export default function FilterPanel({ filters, onChange }) {
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
      <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>Filters</h3>

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
            {p.label}
          </button>
        ))}
      </div>

      {/* Brightness */}
      <div>
        <label className="block mb-1" style={labelStyle}>
          Brightness: {filters.brightness > 0 ? '+' : ''}{filters.brightness.toFixed(2)}
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
          Contrast: {filters.contrast > 0 ? '+' : ''}{filters.contrast.toFixed(0)}
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
        className="py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}
        onClick={() => onChange({ list: [], brightness: 0, contrast: 0 })}
      >
        ↺ Reset Filters
      </button>
    </div>
  );
}
