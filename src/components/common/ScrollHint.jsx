import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Mobile-only "scroll down" hint. The app uses min-h-screen, so on phones the
 * page grows and the WINDOW scrolls (not an inner container). This watches
 * window scroll and shows a bouncing chevron whenever there's more content
 * below the fold — so customers realize there are more photos / a selection
 * bar / actions further down. Tapping it scrolls down; it hides near the bottom.
 */
export default function ScrollHint({ bottom = 24 }) {
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    let cancelled = false;
    const scroller = document.scrollingElement || document.documentElement;
    const update = () => {
      if (cancelled) return;
      // 24px slack so it hides cleanly near the bottom
      setShow(scroller.scrollHeight - window.innerHeight - scroller.scrollTop > 24);
    };
    // Defer first measurement out of the effect body (avoids a sync setState),
    // then re-measure a few times — page height settles after fonts/images load.
    const raf = requestAnimationFrame(update);
    const timers = [setTimeout(update, 300), setTimeout(update, 1000)];
    if (document.fonts?.ready) document.fonts.ready.then(update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [isMobile]);

  if (!isMobile || !show) return null;

  return (
    <button
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' })}
      aria-label="Scroll down for more"
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center justify-center rounded-full shadow-lg animate-bounce"
      style={{
        bottom,
        width: 40, height: 40,
        background: 'var(--color-primary)',
        color: '#fff',
        border: '2px solid #fff',
      }}
    >
      <ChevronDown size={22} />
    </button>
  );
}
