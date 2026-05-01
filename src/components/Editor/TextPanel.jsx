import { useState } from 'react';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Courier New', 'Impact', 'Comic Sans MS'];
const PRESET_COLORS = ['#ffffff', '#1A1D23', '#017DC5', '#FBA519', '#16A34A', '#DC2626', '#a855f7'];

export default function TextPanel({ onAdd }) {
  const [text, setText] = useState('Your text here');
  const [fontSize, setFontSize] = useState(36);
  const [color, setColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Arial');

  const panelStyle = {
    background: '#fff',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--color-neutral-100)',
  };
  const labelStyle = { color: 'var(--color-neutral-500)', fontSize: '0.75rem', fontWeight: 600 };
  const inputStyle = {
    border: '1.5px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    color: 'var(--color-neutral-800)',
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={panelStyle}>
      <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>Add Text</h3>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type something…"
        style={{ ...inputStyle, resize: 'none' }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--color-neutral-200)')}
      />

      {/* Font family */}
      <div>
        <label className="block mb-1" style={labelStyle}>Font</label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          style={inputStyle}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <div>
        <label className="block mb-1" style={labelStyle}>Size: {fontSize}px</label>
        <input
          type="range" min={16} max={120} value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-primary)' }}
        />
      </div>

      {/* Color swatches */}
      <div>
        <label className="block mb-2" style={labelStyle}>Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                background: c,
                border: color === c
                  ? '3px solid var(--color-primary)'
                  : '2px solid var(--color-neutral-200)',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer"
            style={{ border: '2px solid var(--color-neutral-200)' }}
            title="Custom color"
          />
        </div>
      </div>

      <button
        className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
        style={{ background: 'var(--color-accent)', color: 'var(--color-neutral-900)' }}
        onClick={() => { if (text.trim()) onAdd({ text, fontSize, color, fontFamily }); }}
      >
        + Add to Canvas
      </button>
    </div>
  );
}
