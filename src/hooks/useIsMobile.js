import { useState, useEffect } from 'react';

// Single source of truth for the mobile breakpoint (matches Tailwind's `sm`).
// Used to switch fundamentally different layouts (e.g. the editor's 3-column
// desktop grid vs. a stacked mobile layout) that CSS media queries alone
// can't express cleanly inside JS-driven components.
export const MOBILE_MAX_WIDTH = 640;

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsMobile(maxWidth = MOBILE_MAX_WIDTH) {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}
