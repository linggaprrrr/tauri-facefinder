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

// Layout frames: PNG-based multi-slot templates.
// Slot coordinates are NOT hardcoded here — they are loaded at runtime
// from a companion JSON file: /public/frames/<id>.json
// To add a new frame: drop the PNG + JSON into /public/frames/, then add an entry below.
export const LAYOUT_FRAMES = [
  {
    id: 'lotso-6',
    label: 'Lotso 6 Foto',
    type: 'layout',
    src: '/frames/lotso-6.png',
    slotCount: 6,
  },
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
  } else if (id === 'black') {
    svg = borderSvg(w, h, b, '#111111');
  } else if (id === 'film') {
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
  } else if (id === 'polaroid') {
    const thin = Math.round(Math.min(w, h) * 0.03);
    const thick = Math.round(h * 0.18);
    const col = '#f5f5ef';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="0" y="0" width="${w}" height="${thin}" fill="${col}"/>
      <rect x="0" y="${h - thick}" width="${w}" height="${thick}" fill="${col}"/>
      <rect x="0" y="${thin}" width="${thin}" height="${h - thin - thick}" fill="${col}"/>
      <rect x="${w - thin}" y="${thin}" width="${thin}" height="${h - thin - thick}" fill="${col}"/>
    </svg>`;
  } else if (id === 'gold') {
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
  } else if (id === 'floral') {
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
    svg = borderSvg(w, h, fb, '#f9b8cc', '', `${flower(cp, cp)}${flower(w - cp, cp)}${flower(cp, h - cp)}${flower(w - cp, h - cp)}`);
  } else if (id === 'rainbow') {
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
