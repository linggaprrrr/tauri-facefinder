/**
 * Kiosk-optimized button.
 * variant  → primary (blue CTA) | secondary (orange) | ghost | danger
 * size     → md (default, 48px min) | lg (64px, hero actions)
 */
export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  type = 'button',
}) {
  const base = [
    'inline-flex items-center justify-center gap-2',
    'font-bold rounded-xl select-none',
    'transition-all duration-150 cursor-pointer',
    size === 'lg' ? 'min-h-16 px-10 text-xl' : 'min-h-12 px-6 text-base',
  ].join(' ');

  return (
    <button
      type={type}
      className={`${base} btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
