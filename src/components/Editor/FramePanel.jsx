import { useMemo } from 'react';

export const FRAMES = [
  { id: 'none',     label: 'No Frame' },
  { id: 'white',    label: 'Classic'  },
  { id: 'black',    label: 'Elegance' },
  { id: 'film',     label: 'Film'     },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'gold',     label: 'Gold'     },
  { id: 'floral',   label: 'Floral'   },
  { id: 'rainbow',  label: 'Rainbow'  },
];

function borderSvg(w, h, strokeW, stroke, defs = '', extras = '') {
  const half = strokeW / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>${defs}</defs>
    <rect x="${half}" y="${half}" width="${w - strokeW}" height="${h - strokeW}"
      fill="none" stroke="${stroke}" stroke-width="${strokeW}"/>
    ${extras}
  </svg>`;
}

export function generateFrameDataUri(id, w, h) {
  if (id === 'none' || !w || !h) return null;
  const b = Math.round(Math.min(w, h) * 0.06);
  let svg = '';

  if (id === 'white') {
    svg = borderSvg(w, h, b, 'white');
  }

  else if (id === 'black') {
    svg = borderSvg(w, h, b, '#111111');
  }

  else if (id === 'film') {
    const fb = Math.round(b * 1.5);
    const hr = Math.round(fb * 0.28);
    const count = Math.max(4, Math.floor((h - fb * 2) / (hr * 3.5)));
    const spacing = (h - fb * 2) / count;
    let holes = '';
    for (let i = 0; i < count; i++) {
      const cy = Math.round(fb + spacing * i + spacing / 2);
      const rx = fb * 0.18;
      const lx = w - fb * 0.18 - hr * 1.6;
      holes += `<rect x="${rx}" y="${cy - hr}" width="${hr * 1.6}" height="${hr * 2}" rx="${hr * 0.3}" fill="#444"/>`;
      holes += `<rect x="${lx}" y="${cy - hr}" width="${hr * 1.6}" height="${hr * 2}" rx="${hr * 0.3}" fill="#444"/>`;
    }
    svg = borderSvg(w, h, fb, '#0d0d0d', '', holes);
  }

  else if (id === 'polaroid') {
    const thin = Math.round(Math.min(w, h) * 0.03);
    const thick = Math.round(h * 0.18);
    const col = '#f5f5ef';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="0" y="0" width="${w}" height="${thin}" fill="${col}"/>
      <rect x="0" y="${h - thick}" width="${w}" height="${thick}" fill="${col}"/>
      <rect x="0" y="${thin}" width="${thin}" height="${h - thin - thick}" fill="${col}"/>
      <rect x="${w - thin}" y="${thin}" width="${thin}" height="${h - thin - thick}" fill="${col}"/>
    </svg>`;
  }

  else if (id === 'gold') {
    const gb = Math.round(b * 1.1);
    const cs = Math.round(gb * 2.2);
    const defs = `<linearGradient id="gld" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f7e28a"/>
      <stop offset="30%" stop-color="#c9a432"/>
      <stop offset="60%" stop-color="#f7e28a"/>
      <stop offset="100%" stop-color="#c9a432"/>
    </linearGradient>`;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>${defs}</defs>
      <rect x="0" y="0" width="${cs}" height="${cs}" fill="url(#gld)"/>
      <rect x="${w - cs}" y="0" width="${cs}" height="${cs}" fill="url(#gld)"/>
      <rect x="0" y="${h - cs}" width="${cs}" height="${cs}" fill="url(#gld)"/>
      <rect x="${w - cs}" y="${h - cs}" width="${cs}" height="${cs}" fill="url(#gld)"/>
      <rect x="${cs}" y="0" width="${w - cs * 2}" height="${gb}" fill="url(#gld)"/>
      <rect x="${cs}" y="${h - gb}" width="${w - cs * 2}" height="${gb}" fill="url(#gld)"/>
      <rect x="0" y="${cs}" width="${gb}" height="${h - cs * 2}" fill="url(#gld)"/>
      <rect x="${w - gb}" y="${cs}" width="${gb}" height="${h - cs * 2}" fill="url(#gld)"/>
    </svg>`;
  }

  else if (id === 'floral') {
    const fb = Math.round(b * 0.8);
    const cs = Math.round(fb * 4);
    const r = cs * 0.33;
    const pr = r * 0.48;
    const off = r * 0.56;
    const doff = r * 0.4;

    function flower(cx, cy) {
      return `
        <circle cx="${cx}" cy="${cy - off}" r="${pr}" fill="#f9b8cc" opacity="0.9"/>
        <circle cx="${cx}" cy="${cy + off}" r="${pr}" fill="#f9b8cc" opacity="0.9"/>
        <circle cx="${cx - off}" cy="${cy}" r="${pr}" fill="#f9b8cc" opacity="0.9"/>
        <circle cx="${cx + off}" cy="${cy}" r="${pr}" fill="#f9b8cc" opacity="0.9"/>
        <circle cx="${cx - doff}" cy="${cy - doff}" r="${pr * 0.7}" fill="#fcd4e0" opacity="0.8"/>
        <circle cx="${cx + doff}" cy="${cy - doff}" r="${pr * 0.7}" fill="#fcd4e0" opacity="0.8"/>
        <circle cx="${cx - doff}" cy="${cy + doff}" r="${pr * 0.7}" fill="#fcd4e0" opacity="0.8"/>
        <circle cx="${cx + doff}" cy="${cy + doff}" r="${pr * 0.7}" fill="#fcd4e0" opacity="0.8"/>
        <circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="#e8729c"/>
      `;
    }

    const cp = cs * 0.5;
    const extras = `
      ${flower(cp, cp)}
      ${flower(w - cp, cp)}
      ${flower(cp, h - cp)}
      ${flower(w - cp, h - cp)}
    `;
    svg = borderSvg(w, h, fb, '#f9b8cc', '', extras);
  }

  else if (id === 'rainbow') {
    const defs = `<linearGradient id="rbw" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="33%" stop-color="#8b5cf6"/>
      <stop offset="66%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>`;
    svg = borderSvg(w, h, b, 'url(#rbw)', defs);
  }

  if (!svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function FramePreview({ frameId }) {
  const src = useMemo(() => generateFrameDataUri(frameId, 64, 44), [frameId]);
  return (
    <div className="relative rounded overflow-hidden" style={{ width: 64, height: 44 }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }} />
      {src && (
        <img src={src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill' }} />
      )}
    </div>
  );
}

export default function FramePanel({ activeFrame, onSelect }) {
  return (
    <div
      className="rounded-2xl p-4 h-full overflow-y-auto no-scrollbar"
      style={{ background: '#fff', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-neutral-100)' }}
    >
      <h3 className="font-bold mb-3" style={{ color: 'var(--color-neutral-700)' }}>
        Bingkai / Frames
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {FRAMES.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all active:scale-95"
            style={{
              background: activeFrame === f.id ? 'var(--color-primary-50)' : 'var(--color-neutral-50)',
              outline: activeFrame === f.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            <FramePreview frameId={f.id} />
            <span
              className="text-xs font-semibold"
              style={{ color: activeFrame === f.id ? 'var(--color-primary)' : 'var(--color-neutral-600)' }}
            >
              {f.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
