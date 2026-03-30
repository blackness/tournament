export function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 16, md: 24, lg: 40 }[size] ?? 24
  return (
    <div className={className} style={{ width:s, height:s, border:`${s/8}px solid rgba(255,255,255,0.1)`, borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'40vh' }}>
      <LoadingSpinner size="lg" />
    </div>
  )
}
