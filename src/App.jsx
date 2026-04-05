import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './lib/AuthContext'
import { AdminProvider } from './lib/AdminContext'

// Layouts (always needed)
import { PublicLayout }   from './components/ui/PublicLayout'
import { DirectorLayout } from './components/ui/DirectorLayout'
import { RequireAuth }    from './components/ui/RequireAuth'
import { PageLoader }     from './components/ui/LoadingSpinner'

// Critical public pages - loaded immediately
import { TournamentList }  from './pages/TournamentList'
import { TournamentHome }  from './pages/TournamentHome'
import { LiveScoreboard }  from './pages/LiveScoreboard'
import { CourtLanding }    from './pages/CourtLanding'
import { LoginPage }       from './pages/LoginPage'
import { SignupPage }      from './pages/SignupPage'

// Lazy-loaded public pages
const SchedulePage     = lazy(() => import('./pages/SchedulePage').then(m => ({ default: m.SchedulePage })))
const StandingsPage    = lazy(() => import('./pages/StandingsPage').then(m => ({ default: m.StandingsPage })))
const BracketPage      = lazy(() => import('./pages/BracketPage').then(m => ({ default: m.BracketPage })))
const TeamPage         = lazy(() => import('./pages/TeamPage').then(m => ({ default: m.TeamPage })))
const TeamComparePage  = lazy(() => import('./pages/TeamComparePage').then(m => ({ default: m.TeamComparePage })))
const GameDayPage      = lazy(() => import('./pages/GameDayPage').then(m => ({ default: m.GameDayPage })))
const WatchPage        = lazy(() => import('./pages/WatchPage').then(m => ({ default: m.WatchPage })))
const ScorekeeperPage  = lazy(() => import('./pages/ScorekeeperPage').then(m => ({ default: m.ScorekeeperPage })))
const SOTGEntryPage    = lazy(() => import('./pages/SOTGEntryPage').then(m => ({ default: m.SOTGEntryPage })))

// Lazy-loaded director pages
const DirectorDashboard = lazy(() => import('./pages/director/DirectorDashboard').then(m => ({ default: m.DirectorDashboard })))
const WizardPage        = lazy(() => import('./pages/director/WizardPage').then(m => ({ default: m.WizardPage })))
const DirectorHQ        = lazy(() => import('./pages/director/DirectorHQ').then(m => ({ default: m.DirectorHQ })))
const ScheduleEditor    = lazy(() => import('./pages/director/ScheduleEditor').then(m => ({ default: m.ScheduleEditor })))
const BracketGenerator  = lazy(() => import('./pages/director/BracketGenerator').then(m => ({ default: m.BracketGenerator })))
const RosterManager     = lazy(() => import('./pages/director/RosterManager').then(m => ({ default: m.RosterManager })))
const QRManager         = lazy(() => import('./pages/director/QRManager').then(m => ({ default: m.QRManager })))
const ConstraintReview  = lazy(() => import('./pages/director/ConstraintReview').then(m => ({ default: m.ConstraintReview })))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const SpectatorDashboard = lazy(() => import('./pages/SpectatorDashboard').then(m => ({ default: m.SpectatorDashboard })))

export default function App() {
  return (
    <AdminProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public routes ───────────────────────────────────────────── */}
          <Route element={<PublicLayout />}>
            <Route index element={<Navigate to="/tournaments" replace />} />
            <Route path="/tournaments"                        element={<TournamentList />} />
            <Route path="/t/:slug"                            element={<TournamentHome />} />
            <Route path="/t/:slug/standings/:divisionId"      element={<StandingsPage />} />
            <Route path="/t/:slug/bracket/:divisionId"        element={<BracketPage />} />
            <Route path="/t/:slug/schedule"                   element={<SchedulePage />} />
            <Route path="/t/:slug/team/:teamId"               element={<TeamPage />} />
          <Route path="/t/:slug/gameday"                     element={<GameDayPage />} />
          <Route path="/t/:slug/compare/:teamIdA/:teamIdB"     element={<TeamComparePage />} />
            <Route path="/watch/:matchId"  element={<WatchPage />} />
          <Route path="/score/:matchId"                     element={<LiveScoreboard />} />
            <Route path="/dashboard"                          element={<SpectatorDashboard />} />
          </Route>

          {/* ── Court QR landing (no layout chrome — full screen) ────────── */}
          <Route path="/court/:tournamentId/:venueSlug" element={<CourtLanding />} />

          {/* ── Scorekeeper console ─────────────────────────────────────── */}
          <Route path="/scorekeeper/:matchId" element={<ScorekeeperPage />} />
          <Route path="/sotg/:matchId"           element={<SOTGEntryPage />} />

          {/* ── Director routes (requires auth) ─────────────────────────── */}
          <Route element={<RequireAuth><DirectorLayout /></RequireAuth>}>
            <Route path="/director"                           element={<DirectorDashboard />} />
            <Route path="/director/new"                       element={<WizardPage mode="create" />} />
            <Route path="/director/:tournamentId"             element={<DirectorHQ />} />
            <Route path="/director/:tournamentId/edit"        element={<WizardPage mode="edit" />} />
            <Route path="/director/:tournamentId/schedule"    element={<ScheduleEditor />} />
            <Route path="/director/:tournamentId/bracket"     element={<BracketGenerator />} />
            <Route path="/director/:tournamentId/roster"      element={<RosterManager />} />
            <Route path="/director/:tournamentId/constraints" element={<ConstraintReview />} />
            <Route path="/director/:tournamentId/qr"          element={<QRManager />} />
          </Route>

          {/* ── Auth ──────────────────────────────────────────────────── */}
          <Route path="/signup"                              element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ── 404 ───────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/tournaments" replace />} />

        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </AdminProvider>
  )
}
