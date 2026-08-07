/**
 * The "nothing here" panel — no search results, empty cart, nothing to download.
 *
 * Generalised out of the gallery's empty state rather than designed fresh:
 * that one was already the strongest of the three, so lifting it keeps the
 * migration a visual no-op and gives the other screens the good version.
 *
 * The tone is deliberately festive rather than cautionary — an empty gallery
 * is the normal result of a scan that found nothing, not a failure — and
 * `action` is a first-class slot because a dead end with no way forward is
 * the real problem with most empty states.
 */
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`festive-card flex flex-col items-center gap-4 text-center px-10 py-12 max-w-md ${className}`}>
      {Icon && (
        <div
          className="bob flex items-center justify-center w-24 h-24 rounded-full text-white shrink-0"
          style={{ background: 'var(--gradient-accent)', boxShadow: 'var(--shadow-glow-accent)' }}
        >
          <Icon size={44} strokeWidth={2.5} />
        </div>
      )}

      <h2 className="text-h2 font-black" style={{ color: 'var(--color-neutral-900)' }}>
        {title}
      </h2>

      {description && (
        <p className="text-base" style={{ color: 'var(--color-neutral-600)' }}>
          {description}
        </p>
      )}

      {action}
    </div>
  );
}
