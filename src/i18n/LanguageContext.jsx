import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translations } from './translations';

const LanguageContext = createContext(null);

const DEFAULT_LANG = 'id';
const SUPPORTED = ['id', 'en'];

function loadLang() {
  try {
    const saved = localStorage.getItem('lang');
    return SUPPORTED.includes(saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

// Replace {token} placeholders in a string with values from `vars`.
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(loadLang);

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    try { localStorage.setItem('lang', next); } catch { /* ignore */ }
    setLangState(next);
  }, []);

  // t(key, vars?) → localized string, falling back to the key when missing.
  const t = useCallback(
    (key, vars) => {
      const entry = translations[key];
      const raw = entry ? (entry[lang] ?? entry[DEFAULT_LANG] ?? key) : key;
      return interpolate(raw, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within a LanguageProvider');
  return ctx;
}
