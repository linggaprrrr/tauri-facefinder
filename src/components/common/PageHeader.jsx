// Page title row from the theme-park design: orange icon tile, navy title and
// subtitle, and an optional action on the right (rescan, edit photos, …).
// One component so every page's header lines up the same way.
export default function PageHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
      {Icon && (
        <span
          className="hidden sm:flex shrink-0 items-center justify-center"
          style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'var(--gradient-accent)',
            color: '#fff',
            boxShadow: 'var(--shadow-glow-accent)',
          }}
        >
          <Icon size={32} strokeWidth={2.2} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-h1 font-black leading-tight" style={{ color: 'var(--color-neutral-900)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm sm:text-lg mt-0.5 leading-snug" style={{ color: 'var(--color-neutral-700)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
