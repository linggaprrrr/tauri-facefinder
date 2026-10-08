import { ChevronLeft, ArrowRight } from 'lucide-react';

// Bottom Back / Next bar shared by every step. Each button carries a second
// line saying where it goes ("Back · Scan again", "Next · Payment") so a
// customer never has to guess what a tap will do. Either side can be omitted.
//
// back / next: { label, sub?, onClick, disabled?, icon? }
export default function NavBar({ back, next }) {
  return (
    <div className="flex items-stretch gap-3 sm:gap-4 shrink-0">
      {back && (
        <button
          type="button"
          onClick={back.onClick}
          disabled={back.disabled}
          className="raised-tile flex items-center gap-2 sm:gap-3 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-left transition-transform active:scale-[0.98] disabled:opacity-50 sm:min-w-[38%]"
          style={{ color: 'var(--color-neutral-900)' }}
        >
          <ChevronLeft size={26} strokeWidth={2.5} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-base sm:text-xl font-black leading-tight">{back.label}</span>
            {back.sub && <span className="hidden sm:block text-sm truncate" style={{ color: 'var(--color-neutral-700)' }}>{back.sub}</span>}
          </span>
        </button>
      )}
      {next && (
        <button
          type="button"
          onClick={next.onClick}
          disabled={next.disabled}
          className="flex-1 flex items-center justify-between gap-3 rounded-full pl-5 sm:pl-8 pr-2 py-2 text-left text-white transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
        >
          <span className="min-w-0">
            <span className="block text-lg sm:text-2xl font-black leading-tight">{next.label}</span>
            {next.sub && <span className="block text-xs sm:text-sm truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{next.sub}</span>}
          </span>
          <span
            className="flex items-center justify-center rounded-full shrink-0 w-11 h-11 sm:w-14 sm:h-14"
            style={{ background: '#fff', color: 'var(--color-primary)' }}
          >
            {next.icon ?? <ArrowRight size={26} strokeWidth={2.6} />}
          </span>
        </button>
      )}
    </div>
  );
}
