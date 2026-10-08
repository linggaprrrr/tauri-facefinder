import { useEffect, useState } from 'react';
import { composePrintImage } from '../../utils/composePrintImage';

// "This is how your print will look": the real print composition (template,
// frame, logo, text) from the same composePrintImage the printer gets, shown
// scaled. Photos are the light editor sources (edited render or proxy), not
// the full-res originals the actual print fetches — fine for a preview, and
// it keeps this off the network-heavy path.
//
// srcs: one image URL/dataURL per slot (a single-slot template uses srcs[0]).
export default function PrintPreview({ templateVersion, srcs, outletName, className = '', style }) {
  const [state, setState] = useState({ key: '', url: null, failed: false });
  const key = `${templateVersion?.id ?? ''}|${srcs.join('|')}`;

  useEffect(() => {
    if (!templateVersion || !srcs.length) return;
    let cancelled = false;
    // Debounced: an edit can change the source a few times in quick succession,
    // and each compose draws a full print-resolution canvas.
    const timer = setTimeout(() => {
      composePrintImage(templateVersion, srcs, { outlet_name: outletName ?? '' })
        .then((url) => { if (!cancelled) setState({ key, url, failed: false }); })
        .catch((err) => {
          console.warn('print preview failed', err);
          if (!cancelled) setState({ key, url: null, failed: true });
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key covers templateVersion + srcs

  const ratio = templateVersion ? `${templateVersion.width_px} / ${templateVersion.height_px}` : '3 / 2';
  const current = state.key === key;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: ratio, background: '#fff', boxShadow: 'var(--shadow-lg)', ...style }}>
      {current && state.url ? (
        <img src={state.url} alt="" className="block w-full h-full object-contain" />
      ) : current && state.failed ? (
        // The template could not be drawn (e.g. an asset failed to load):
        // still show the photo, so the card is never an empty box.
        <img src={srcs[0]} alt="" className="block w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--color-neutral-200)' }} />
      )}
    </div>
  );
}
