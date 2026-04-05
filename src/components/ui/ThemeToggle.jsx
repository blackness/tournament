import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getTheme, toggleTheme } from '../../lib/useTheme'

export function ThemeToggle({ style = {} }) {
  const [theme, setThemeState] = useState(getTheme)

  function handleToggle() {
    const next = toggleTheme()
    setThemeState(next)
  }

  return (
    <button
      onClick={handleToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        cursor: 'pointer', color: 'var(--text-secondary)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0, ...style
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
