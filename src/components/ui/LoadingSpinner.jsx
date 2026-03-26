export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size]} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  )
}

export function PageLoader({ message = 'Loading...' }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
      <LoadingSpinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
