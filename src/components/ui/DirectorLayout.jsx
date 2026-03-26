import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { Trophy, PlusCircle, LogOut, ChevronLeft } from 'lucide-react'

export function DirectorLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-blue-700 text-white px-4 h-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/tournaments" className="flex items-center gap-1 text-blue-200 hover:text-white text-sm">
            <ChevronLeft size={16} />
            Public site
          </Link>
          <span className="text-blue-400">|</span>
          <Link to="/director" className="flex items-center gap-2 font-semibold">
            <Trophy size={16} />
            Director
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-sm hidden sm:block">{user?.email}</span>
          <button onClick={handleSignOut} className="text-blue-200 hover:text-white p-1">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
