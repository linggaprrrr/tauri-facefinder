const STEPS = ['Scan', 'Gallery', 'Editor', 'Cart', 'Download'];

export default function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      {STEPS.map((label, index) => {
        const isDone = index < current;
        const isActive = index === current;

        return (
          <div key={label} className="flex items-center">
            {/* Step circle */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-200"
                style={{
                  background: isActive
                    ? 'var(--color-primary)'
                    : isDone
                    ? 'var(--color-primary-100)'
                    : 'var(--color-neutral-200)',
                  color: isActive
                    ? '#fff'
                    : isDone
                    ? 'var(--color-primary-700)'
                    : 'var(--color-neutral-500)',
                  boxShadow: isActive ? '0 0 0 4px var(--color-primary-100)' : 'none',
                }}
              >
                {isDone ? '✓' : index + 1}
              </div>
              <span
                className="text-sm font-semibold hidden md:inline"
                style={{
                  color: isActive
                    ? 'var(--color-primary)'
                    : 'var(--color-neutral-400)',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className="w-6 h-0.5 mx-2 rounded-full transition-all duration-300"
                style={{
                  background: isDone
                    ? 'var(--color-primary-300)'
                    : 'var(--color-neutral-200)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
