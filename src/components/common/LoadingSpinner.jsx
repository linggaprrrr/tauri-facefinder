export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Outer ring uses primary-100, spinning segment uses primary */}
      <div
        className="w-20 h-20 rounded-full animate-spin"
        style={{
          border: '6px solid var(--color-primary-100)',
          borderTopColor: 'var(--color-primary)',
        }}
      />
      <p
        className="text-xl font-semibold"
        style={{ color: 'var(--color-neutral-600)' }}
      >
        {message}
      </p>
    </div>
  );
}
