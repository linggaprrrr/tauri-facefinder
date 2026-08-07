/**
 * Icon-only button.
 *
 * Exists because an icon on its own has two failure modes that are easy to
 * miss at the call site: it has no accessible name, and its hit area is the
 * glyph's own bounds rather than anything a finger can reliably land on. Both
 * are made structural here — `label` is required and becomes both the
 * aria-label and the tooltip, and the size scale starts at the 44px touch
 * target instead of at the icon size.
 *
 * The focus ring comes from the global `button:focus-visible` rule in
 * index.css, so it is not repeated here.
 */
const SIZES = {
  sm: { box: 'w-9 h-9',   icon: 18 },  // 36px — dense toolbars only
  md: { box: 'w-11 h-11', icon: 22 },  // 44px — the default; minimum touch target
  lg: { box: 'w-14 h-14', icon: 26 },  // 56px — primary canvas actions
};

const VARIANTS = {
  ghost:  { background: 'transparent',              color: 'var(--color-neutral-700)' },
  subtle: { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' },
  solid:  { background: 'var(--color-primary)',     color: '#fff' },
  danger: { background: 'var(--color-error-bg)',    color: 'var(--color-error)' },
  warning:{ background: 'var(--color-warning-bg)',  color: 'var(--color-warning)' },
  // For icons sitting on a coloured header or over a photo, where the neutral
  // ramp has nothing with enough contrast.
  onDark: { background: 'rgba(255,255,255,0.16)',   color: '#fff' },
};

export default function IconButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled,
  className = '',
  ...rest
}) {
  const { box, icon } = SIZES[size] ?? SIZES.md;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center shrink-0 rounded-xl
        transition-all duration-150 cursor-pointer
        hover:brightness-95 active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${box} ${className}`}
      style={VARIANTS[variant] ?? VARIANTS.ghost}
      {...rest}
    >
      <Icon size={icon} />
    </button>
  );
}
