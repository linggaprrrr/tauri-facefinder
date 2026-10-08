import { CloudDownload } from 'lucide-react';

// Product thumbnails for the Pay page, drawn from the customer's own photo so
// each card shows what they would actually get: a fanned stack of prints, a
// pair of photo strips, or the photo on a phone. Pure CSS over <img> — no
// canvas work, so it is free to re-render on every tap.
const card = { border: '3px solid #fff', boxShadow: '0 4px 10px rgba(14,31,77,0.25)', borderRadius: 4 };

export default function ProductArt({ kind, src, className = 'w-24 h-24' }) {
  if (kind === 'strip') {
    return (
      <span className={`relative block shrink-0 ${className}`} aria-hidden>
        {[{ left: '18%', rot: -8 }, { left: '50%', rot: 6 }].map(({ left, rot }) => (
          <span
            key={left}
            className="absolute top-[4%] flex flex-col gap-[3px] p-[3px] bg-white"
            style={{ left, width: '32%', height: '92%', transform: `rotate(${rot}deg)`, ...card, border: 'none' }}
          >
            {[0, 1, 2].map((i) => (
              <img key={i} src={src} alt="" className="block w-full flex-1 min-h-0 object-cover" />
            ))}
          </span>
        ))}
      </span>
    );
  }

  if (kind === 'soft') {
    return (
      <span className={`relative block shrink-0 ${className}`} aria-hidden>
        <span
          className="absolute left-[28%] top-[2%] w-[48%] h-[92%] p-[4%] rounded-[14%]"
          style={{ background: 'var(--color-neutral-900)', boxShadow: '0 4px 10px rgba(14,31,77,0.3)' }}
        >
          <img src={src} alt="" className="block w-full h-full object-cover rounded-[10%]" />
        </span>
        <span
          className="absolute left-[2%] bottom-[2%] w-[46%] h-[46%] rounded-full flex items-center justify-center text-white"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
        >
          <CloudDownload className="w-[60%] h-[60%]" strokeWidth={2.4} />
        </span>
      </span>
    );
  }

  // Print: three prints fanned out, the top one straight.
  return (
    <span className={`relative block shrink-0 ${className}`} aria-hidden>
      {[{ rot: -12, x: '6%', y: '20%' }, { rot: 8, x: '22%', y: '12%' }, { rot: -2, x: '12%', y: '26%' }].map(({ rot, x, y }, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="absolute w-[72%] h-[54%] object-cover"
          style={{ left: x, top: y, transform: `rotate(${rot}deg)`, ...card }}
        />
      ))}
    </span>
  );
}
