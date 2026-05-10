import { useState, useEffect } from 'react';

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Dancing+Script:wght@400;700' +
  '&family=Lobster&family=Montserrat:ital,wght@0,400;0,700;1,400' +
  '&family=Oswald:wght@400;700&family=Pacifico' +
  '&family=Playfair+Display:ital,wght@0,400;0,700;1,400' +
  '&family=Raleway:ital,wght@0,400;0,700;1,400' +
  '&family=Righteous&family=Satisfy&family=Poppins:ital,wght@0,400;0,700;1,400' +
  '&family=Nunito:ital,wght@0,400;0,700;1,400&display=swap';

const FONTS = [
  { family: 'Montserrat',       label: 'Montserrat'   },
  { family: 'Poppins',          label: 'Poppins'      },
  { family: 'Nunito',           label: 'Nunito'       },
  { family: 'Raleway',          label: 'Raleway'      },
  { family: 'Oswald',           label: 'Oswald'       },
  { family: 'Bebas Neue',       label: 'Bebas Neue'   },
  { family: 'Anton',            label: 'Anton'        },
  { family: 'Righteous',        label: 'Righteous'    },
  { family: 'Playfair Display', label: 'Playfair'     },
  { family: 'Georgia',          label: 'Georgia'      },
  { family: 'Pacifico',         label: 'Pacifico'     },
  { family: 'Dancing Script',   label: 'Dancing Script'},
  { family: 'Lobster',          label: 'Lobster'      },
  { family: 'Satisfy',          label: 'Satisfy'      },
  { family: 'Impact',           label: 'Impact'       },
  { family: 'Arial',            label: 'Arial'        },
  { family: 'Comic Sans MS',    label: 'Comic Sans'   },
  { family: 'Courier New',      label: 'Courier New'  },
];

const PRESET_COLORS = [
  '#ffffff', '#1A1D23', '#017DC5', '#FBA519',
  '#16A34A', '#DC2626', '#a855f7', '#ec4899',
  '#f97316', '#14b8a6',
];

export default function TextPanel({ onAdd }) {
  const [text, setText] = useState('Your text here');
  const [fontSize, setFontSize] = useState(36);
  const [color, setColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Montserrat');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState('center');

  // Load Google Fonts once on mount
  useEffect(() => {
    const id = 'gf-text-panel';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);

  const fontStyle = italic && bold ? 'italic bold' : bold ? 'bold' : italic ? 'italic' : 'normal';

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

  function styleBtn(active) {
    return {
      width: 36, height: 36,
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: '0.9rem',
      transition: 'all 0.15s',
      background: active ? 'var(--color-primary)' : 'var(--color-neutral-100)',
      color: active ? '#fff' : 'var(--color-neutral-600)',
    };
  }

  function alignBtn(val) {
    const icons = { left: '⬤ ⬤\n⬤', center: ' ⬤ \n⬤ ⬤', right: ' ⬤ ⬤\n  ⬤' };
    const labels = { left: '≡', center: '≡', right: '≡' };
    return (
      <button
        key={val}
        style={styleBtn(align === val)}
        onClick={() => setAlign(val)}
        title={val}
      >
        {val === 'left' ? '⫷' : val === 'center' ? '≡' : '⫸'}
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{ background: '#fff', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-100)' }}
    >
      <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>Add Text</h3>

      {/* Text input */}
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type something…"
        style={{
          ...inputStyle, resize: 'none',
          fontFamily, fontWeight: bold ? '700' : '400',
          fontStyle: italic ? 'italic' : 'normal',
          fontSize: '1rem',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--color-neutral-200)')}
      />

      {/* Style + Align row */}
      <div className="flex items-center gap-2">
        <button style={styleBtn(bold)} onClick={() => setBold((v) => !v)} title="Bold">
          <span style={{ fontFamily: 'Arial', fontWeight: 900 }}>B</span>
        </button>
        <button style={styleBtn(italic)} onClick={() => setItalic((v) => !v)} title="Italic">
          <span style={{ fontFamily: 'Georgia', fontStyle: 'italic' }}>I</span>
        </button>
        <div className="flex-1" />
        {['left', 'center', 'right'].map((val) => alignBtn(val))}
      </div>

      {/* Font family picker */}
      <div>
        <label className="block mb-2" style={labelStyle}>Font</label>
        <div
          className="flex flex-col gap-1 overflow-y-auto no-scrollbar rounded-xl"
          style={{ maxHeight: 200, border: '1.5px solid var(--color-neutral-200)', padding: '4px' }}
        >
          {FONTS.map((f) => (
            <button
              key={f.family}
              onClick={() => setFontFamily(f.family)}
              className="text-left px-3 py-2 rounded-lg transition-all"
              style={{
                fontFamily: f.family,
                fontWeight: bold ? 700 : 400,
                fontStyle: italic ? 'italic' : 'normal',
                fontSize: '1.05rem',
                background: fontFamily === f.family ? 'var(--color-primary-50)' : 'transparent',
                color: fontFamily === f.family ? 'var(--color-primary)' : 'var(--color-neutral-800)',
                outline: fontFamily === f.family ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="block mb-1" style={labelStyle}>Size: {fontSize}px</label>
        <input
          type="range" min={14} max={120} value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-primary)' }}
        />
      </div>

      {/* Color */}
      <div>
        <label className="block mb-2" style={labelStyle}>Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: c,
                border: color === c ? '3px solid var(--color-primary)' : '2px solid var(--color-neutral-200)',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded-full cursor-pointer"
            style={{ border: '2px solid var(--color-neutral-200)' }}
            title="Custom color"
          />
        </div>
      </div>

      {/* Preview */}
      <div
        className="rounded-xl flex items-center justify-center py-3 px-4 min-h-12"
        style={{ background: 'var(--color-neutral-900)' }}
      >
        <span
          style={{
            fontFamily,
            fontSize: Math.min(fontSize, 28),
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? 'italic' : 'normal',
            color,
            textAlign: align,
            width: '100%',
            display: 'block',
            wordBreak: 'break-word',
          }}
        >
          {text || 'Preview'}
        </span>
      </div>

      <button
        className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
        style={{ background: 'var(--color-accent)', color: 'var(--color-neutral-900)' }}
        onClick={() => {
          if (text.trim()) onAdd({ text, fontSize, color, fontFamily, fontStyle, align });
        }}
      >
        + Add to Canvas
      </button>
    </div>
  );
}
