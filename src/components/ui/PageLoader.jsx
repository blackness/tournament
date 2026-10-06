export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
        </div>
        <p className="text-[var(--text-muted)]">Loading tournament...</p>
      </div>
    </div>
  )
}