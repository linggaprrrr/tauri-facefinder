import { useState, useEffect } from 'react';

// Single source of truth for the mobile breakpoint (matches Tailwind's `sm`).
// Used to switch fundamentally different layouts (e.g. the editor's 3-column
// desktop grid vs. a stacked mobile layout) that CSS media queries alone
// can't express cleanly inside JS-driven components.
export const MOBILE_MAX_WIDTH = 640;

export function useIsMobile(maxWidth = MOBILE_MAX_WIDTH) {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
