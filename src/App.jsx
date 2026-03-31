import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'

// Layouts
import { PublicLayout }   from './components/ui/PublicLayout'
import { DirectorLayout } from './components/ui/DirectorLayout'

// Public pages
import { TournamentList }    from './pages/TournamentList'
import { TournamentHome }    from './pages/TournamentHome'
import { StandingsPage }     from './pages/StandingsPage'
import { BracketPage }       from './pages/BracketPage'
import { SchedulePage }      from './pages/SchedulePage'
import { TeamPage }          from './pages/TeamPage'
import { GameDayPage }       from './pages/GameDayPage'
import { TeamComparePage }   from './pages/TeamComparePage'
import { LiveScoreboard }    from './pages/LiveScoreboard'
import { CourtLanding }      from './pages/CourtLanding'
import { SpectatorDashboard} from './pages/SpectatorDashboard'

// Director pages
import { DirectorDashboard }  from './pages/director/DirectorDashboard'
import { WizardPage }         from './pages/director/WizardPage'
import { DirectorHQ }         from './pages/director/DirectorHQ'
import { ScheduleEditor }     from './pages/director/ScheduleEditor'
import { BracketGenerator }  from './pages/director/BracketGenerator'
import { RosterManager }     from './pages/director/RosterManager'
import { ConstraintReview }   from './pages/director/ConstraintReview'
import { QRManager }          from './pages/director/QRManager'

// Scorekeeper
import { ScorekeeperPage } from './pages/ScorekeeperPage'
import { SignupPage }      from './pages/SignupPage'
import { SOTGEntryPage }    from './pages/SOTGEntryPage'

// Auth
import { LoginPage }        from './pages/LoginPage'
import { RequireAuth }      from './components/ui/RequireAuth'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}
