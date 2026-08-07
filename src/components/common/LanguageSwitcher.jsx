import { Languages } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const LANGS = [
  { code: 'id', label: 'ID' },
  { code: 'en', label: 'EN' },
];

// Compact segmented ID | EN toggle for the kiosk header.
export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: 'var(--color-neutral-100)' }}
    >
      <Languages size={16} style={{ color: 'var(--color-neutral-600)', marginLeft: 2 }} />
      {LANGS.map(({ code, label }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={active}
            className="px-2.5 py-1 rounded-lg text-sm font-bold transition-colors"
            style={{
              background: active ? 'var(--color-primary)' : 'transparent',
              color: active ? '#fff' : 'var(--color-neutral-600)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
