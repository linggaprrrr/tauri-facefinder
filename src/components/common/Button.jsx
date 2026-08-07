/**
 * Kiosk-optimized button — responsive: compact on mobile, large touch targets
 * on desktop (sm+). Mobile keeps these noticeably smaller (esp. step nav like
 * prev/next/continue) so they don't dominate a phone screen.
 * variant  → primary (blue CTA) | secondary (orange) | ghost | danger
 * size     → xs | md (default) | lg | xl (hero actions)
 */
const SIZE_CLASSES = {
  // mobile (base) → desktop (sm:)
  xs: 'min-h-8 px-2.5 text-xs       sm:min-h-9  sm:px-3  sm:text-sm',
  md: 'min-h-9 px-3   text-sm       sm:min-h-12 sm:px-6  sm:text-base',
  lg: 'min-h-11 px-4  text-base     sm:min-h-16 sm:px-10 sm:text-xl',
  xl: 'min-h-12 px-5  text-base     sm:min-h-16 sm:px-12 sm:text-xl',
};

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  type = 'button',
  // Everything else lands on the <button>. Without this, call sites that need
  // aria-label, aria-expanded, title or form attributes had to drop the
  // component and hand-roll a raw <button> — which is how several of the
  // one-off button styles in this codebase started.
  ...rest
}) {
  const base = [
    'inline-flex items-center justify-center gap-2',
    'font-bold rounded-xl select-none',
    'transition-all duration-150 cursor-pointer',
    SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
  ].join(' ');

  return (
    <button
      type={type}
      className={`${base} btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
