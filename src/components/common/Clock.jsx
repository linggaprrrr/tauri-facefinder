import { useEffect, useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';

// Header clock. Ticks every 15s — the display only shows minutes, and a
// per-second timer would re-render the header for nothing.
export default function Clock() {
  const { lang } = useLang();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  // Built by hand, not toLocaleTimeString: id-ID formats it "14.32", and the
  // design (and every other clock a customer reads) uses a colon.
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col items-start leading-none">
      <span className="font-black tabular-nums" style={{ fontSize: 24, color: 'var(--color-neutral-900)' }}>{time}</span>
      <span className="text-xs font-semibold mt-1" style={{ color: 'var(--color-neutral-600)' }}>{date}</span>
    </div>
  );
}
