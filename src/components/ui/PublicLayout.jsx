import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { Trophy, LayoutDashboard, LogIn, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function PublicLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/tournaments')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/tournaments" className="flex items-center gap-2 font-bold text-gray-900">
              <Trophy size={20} className="text-blue-600" />
              <span>athleteOS</span>
              <span className="text-gray-400 font-normal hidden sm:inline">/ Tournaments</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-2">
              <Link to="/tournaments" className="btn-ghost btn-sm btn">Browse</Link>
              <Link to="/dashboard"   className="btn-ghost btn-sm btn">My Games</Link>
              {user ? (
                <>
                  <Link to="/director" className="btn-ghost btn-sm btn flex items-center gap-1">
                    <LayoutDashboard size={14} />
                    Director
                  </Link>
                  <button onClick={handleSignOut} className="btn-secondary btn btn-sm">
                    <LogOut size={14} />
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn-primary btn btn-sm">
                  <LogIn size={14} />
                  Sign in
                </Link>
              )}
            </nav>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setMenuOpen(o => !o)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
            <Link to="/tournaments" className="block py-2 text-sm text-gray-700" onClick={() => setMenuOpen(false)}>Browse tournaments</Link>
            <Link to="/dashboard"   className="block py-2 text-sm text-gray-700" onClick={() => setMenuOpen(false)}>My games</Link>
            {user ? (
              <>
                <Link to="/director" className="block py-2 text-sm text-gray-700" onClick={() => setMenuOpen(false)}>Director dashboard</Link>
                <button onClick={handleSignOut} className="block w-full text-left py-2 text-sm text-red-600">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="block py-2 text-sm text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Sign in</Link>
            )}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          athleteOS Tournament Module
        </div>
      </footer>
    </div>
  )
}
