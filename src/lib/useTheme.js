// Theme management - persists to localStorage, applies to html element
const STORAGE_KEY = 'athleteos-theme'

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) ?? 'light'
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

// Apply saved theme on load - call this once in main.jsx or App.jsx
export function initTheme() {
  const saved = getTheme()
  // Apply theme -- light is default for outdoor use
  if (saved === 'dark') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
  }
}
