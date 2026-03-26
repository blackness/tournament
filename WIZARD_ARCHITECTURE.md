# athleteOS — Tournament Module
## React Component Architecture & Routing

---

## Directory Structure

```
src/
├── app/
│   └── tournament/
│       ├── layout.jsx                    ← Tournament shell layout
│       ├── page.jsx                      ← Tournament list / home
│       │
│       ├── [slug]/                       ← Public tournament pages
│       │   ├── page.jsx                  ← Tournament home (master QR landing)
│       │   ├── bracket/
│       │   │   └── [division]/
│       │   │       └── page.jsx          ← Visual bracket
│       │   ├── standings/
│       │   │   └── [division]/
│       │   │       └── page.jsx          ← Pool standings
│       │   ├── schedule/
│       │   │   └── page.jsx              ← Full schedule
│       │   └── team/
│       │       └── [teamId]/
│       │           └── page.jsx          ← Team results / passport
│       │
│       ├── court/
│       │   └── [tournamentId]/
│       │       └── [venueSlug]/
│       │           └── page.jsx          ← Court QR landing (auto-redirects)
│       │
│       ├── score/
│       │   └── [matchId]/
│       │       └── page.jsx              ← Live scoreboard (public)
│       │
│       ├── scorekeeper/
│       │   └── [matchId]/
│       │       └── page.jsx              ← Scorekeeper console (protected)
│       │
│       ├── dashboard/
│       │   └── page.jsx                  ← Spectator followed-games dashboard
│       │
│       └── director/
│           ├── page.jsx                  ← Director's tournament list
│           ├── new/
│           │   └── page.jsx              ← Wizard (create new tournament)
│           └── [tournamentId]/
│               ├── page.jsx              ← Director HQ (live tournament control)
│               ├── edit/
│               │   └── page.jsx          ← Wizard (edit existing tournament)
│               ├── schedule/
│               │   └── page.jsx          ← Schedule grid editor
│               ├── constraints/
│               │   └── page.jsx          ← Constraint review panel
│               └── qr/
│                   └── page.jsx          ← QR code manager / PDF export
│
├── components/
│   ├── tournament/
│   │   ├── wizard/
│   │   │   ├── TournamentWizard.jsx      ← Wizard container + step router
│   │   │   ├── WizardProgress.jsx        ← Step indicator / breadcrumb
│   │   │   ├── WizardStep1Basics.jsx
│   │   │   ├── WizardStep2Sport.jsx
│   │   │   ├── WizardStep3Divisions.jsx
│   │   │   ├── WizardStep4Venues.jsx
│   │   │   ├── WizardStep5Teams.jsx
│   │   │   ├── WizardStep6Schedule.jsx
│   │   │   ├── WizardStep7Constraints.jsx
│   │   │   └── WizardStep8Preview.jsx
│   │   │
│   │   ├── schedule/
│   │   │   ├── ScheduleGrid.jsx          ← Drag-drop schedule editor
│   │   │   ├── GameCard.jsx              ← Match card in schedule grid
│   │   │   ├── TimeSlotCell.jsx          ← Empty/filled slot cell
│   │   │   ├── ConflictBadge.jsx         ← Red/yellow conflict indicator
│   │   │   └── DelayControls.jsx         ← Global delay button + broadcast
│   │   │
│   │   ├── bracket/
│   │   │   ├── BracketTree.jsx           ← SVG bracket renderer
│   │   │   ├── BracketRound.jsx          ← One round column
│   │   │   ├── BracketNode.jsx           ← Single match node
│   │   │   ├── BracketConnector.jsx      ← SVG lines between nodes
│   │   │   └── BracketMiniMap.jsx        ← "Path to Final" mini view
│   │   │
│   │   ├── scoring/
│   │   │   ├── ScorekeeperConsole.jsx    ← Main scoring UI container
│   │   │   ├── PreGameScreen.jsx         ← Roster check + disc flip
│   │   │   ├── LiveScoringScreen.jsx     ← Active game score entry
│   │   │   ├── PointEntryModal.jsx       ← Per-point stat collection
│   │   │   ├── UndoStack.jsx             ← Last 3 actions + undo buttons
│   │   │   ├── CapControls.jsx           ← Soft/hard cap toggle
│   │   │   ├── PostGameScreen.jsx        ← Confirm score + end game
│   │   │   └── ForfeitModal.jsx          ← Forfeit flow
│   │   │
│   │   ├── scores/
│   │   │   ├── LiveScoreCard.jsx         ← Score display (used everywhere)
│   │   │   ├── EventFeed.jsx             ← Scrolling event timeline
│   │   │   ├── ScoreBadge.jsx            ← Compact inline score
│   │   │   ├── CapStatusBanner.jsx       ← "Hard Cap is ON" banner
│   │   │   └── LiveIndicator.jsx         ← Pulsing LIVE dot
│   │   │
│   │   ├── standings/
│   │   │   ├── PoolStandingsTable.jsx    ← Full standings table
│   │   │   ├── MiniStandings.jsx         ← Compact sidebar version
│   │   │   ├── TiebreakerTooltip.jsx     ← "Why are they tied?" tooltip
│   │   │   └── SpiritLeaderboard.jsx     ← SOTG rankings
│   │   │
│   │   ├── teams/
│   │   │   ├── TeamCard.jsx              ← Team entry / display card
│   │   │   ├── TeamPassport.jsx          ← Director constraint review card
│   │   │   ├── PoolBuilder.jsx           ← Drag-drop pool assignment
│   │   │   ├── TeamImportCSV.jsx         ← CSV upload + preview
│   │   │   └── ConstraintWarning.jsx     ← Inline conflict warning
│   │   │
│   │   ├── spectator/
│   │   │   ├── SpectatorWizard.jsx       ← Follow onboarding wizard
│   │   │   ├── FollowedGamesList.jsx     ← Dashboard game cards
│   │   │   ├── FollowButton.jsx          ← Follow/unfollow toggle
│   │   │   └── GuestTokenManager.jsx     ← localStorage guest token logic
│   │   │
│   │   ├── sotg/
│   │   │   ├── SOTGEntryForm.jsx         ← Spirit score submission
│   │   │   └── SOTGDisplay.jsx           ← Score display (totals)
│   │   │
│   │   ├── qr/
│   │   │   ├── QRCodeCard.jsx            ← Printable QR card
│   │   │   └── QRPDFExport.jsx           ← All-courts PDF generator
│   │   │
│   │   └── director/
│   │       ├── TournamentHQ.jsx          ← Live director dashboard
│   │       ├── IncidentLog.jsx           ← Real-time incident feed
│   │       ├── RoleManager.jsx           ← Assign scorekeepers/captains
│   │       └── StateTransitionButton.jsx ← Publish / go live / archive
│   │
│   └── ui/                              ← Shared UI primitives
│       ├── Modal.jsx
│       ├── Drawer.jsx
│       ├── Tabs.jsx
│       ├── Badge.jsx
│       └── LoadingSpinner.jsx
│
├── hooks/
│   ├── useTournament.js                  ← Tournament + division data
│   ├── useMatch.js                       ← Single match data + live updates
│   ├── useStandings.js                   ← Pool standings + tie-breaker display
│   ├── useBracket.js                     ← Bracket tree structure
│   ├── useFollows.js                     ← Guest + user follow management
│   ├── useScorekeeper.js                 ← Score entry + undo stack
│   ├── useRealtime.js                    ← Supabase Realtime subscriptions
│   ├── useSchedule.js                    ← Schedule grid + drag operations
│   ├── useConstraints.js                 ← Conflict detection
│   └── useOfflineQueue.js                ← IndexedDB offline score queue
│
├── lib/
│   ├── supabase.js                       ← Supabase client (singleton)
│   ├── scheduleGenerator.js              ← Schedule algorithm (separate file)
│   ├── sportConfig.js                    ← Sport template helpers
│   ├── tiebreaker.js                     ← Tie-breaker calculation
│   ├── qrGenerator.js                    ← QR URL generation
│   ├── offlineQueue.js                   ← IndexedDB queue manager
│   └── constants.js                      ← Enums, defaults
│
└── store/
    └── wizardStore.js                    ← Zustand wizard state
```

---

## Routing Map

| URL | Component | Auth | Description |
|---|---|---|---|
| `/tournament` | TournamentList | Public | Browse tournaments |
| `/tournament/[slug]` | TournamentHome | Public | Master QR landing |
| `/tournament/[slug]/bracket/[division]` | BracketView | Public | Visual bracket |
| `/tournament/[slug]/standings/[division]` | StandingsView | Public | Pool standings |
| `/tournament/[slug]/schedule` | ScheduleView | Public | Full schedule |
| `/tournament/[slug]/team/[id]` | TeamResults | Public | Team passport |
| `/tournament/court/[tid]/[venue]` | CourtLanding | Public | Court QR auto-redirect |
| `/tournament/score/[matchId]` | LiveScoreboard | Public | Public scoreboard |
| `/tournament/scorekeeper/[matchId]` | ScorekeeperConsole | Scorekeeper+ | Score entry |
| `/tournament/dashboard` | SpectatorDashboard | Guest/User | Followed games |
| `/tournament/director` | DirectorList | Director | My tournaments |
| `/tournament/director/new` | TournamentWizard | Director | Create tournament |
| `/tournament/director/[id]` | DirectorHQ | Director | Live tournament HQ |
| `/tournament/director/[id]/edit` | TournamentWizard | Director | Edit tournament |
| `/tournament/director/[id]/schedule` | ScheduleGridEditor | Director | Schedule editor |
| `/tournament/director/[id]/constraints` | ConstraintReview | Director | Team-by-team review |
| `/tournament/director/[id]/qr` | QRManager | Director | QR codes + PDF |

---

## Wizard State (Zustand)

The wizard uses a single Zustand store for all 8 steps.
State persists to localStorage so the director can close + reopen.

```javascript
// store/wizardStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const INITIAL_STATE = {
  // Meta
  currentStep: 1,
  tournamentId: null,         // Set after first save to DB
  isDirty: false,             // Unsaved changes exist

  // Step 1: Basics
  name: '',
  description: '',
  slug: '',
  startDate: null,
  endDate: null,
  timezone: 'America/Toronto',
  venueName: '',
  venueAddress: '',
  venueLat: null,
  venueLng: null,
  isPublic: true,
  logoUrl: null,
  primaryColor: '#1a56db',

  // Step 2: Sport & Format
  sportTemplateId: null,
  sportConfig: null,          // Loaded from sport_template
  enabledStatIds: [],         // Which stats are active
  formatConfig: null,

  // Step 3: Divisions
  divisions: [],              // Array of division objects

  // Step 4: Venues
  venues: [],                 // Array of venue objects

  // Step 5: Teams
  teams: [],                  // All teams across all divisions
  poolAssignments: {},        // team_id → pool_id

  // Step 6: Schedule
  scheduleConfig: {
    startTime: null,
    endTime: null,
    lunchBreak: null,
    gameDurationMinutes: 90,
    breakBetweenGamesMinutes: 30,
    minRestBetweenTeamGames: 90,
  },
  generatedSlots: [],
  generatedMatches: [],
  scheduleConflicts: [],

  // Step 7: Constraints
  reviewedTeamIds: [],        // Which teams director has reviewed
  acknowledgedConflicts: [],  // Which conflicts director has seen

  // Step 8: Preview
  isPublished: false,
}

export const useWizardStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // Navigation
      goToStep: (step) => set({ currentStep: step }),
      nextStep: () => set(s => ({ currentStep: Math.min(s.currentStep + 1, 8) })),
      prevStep: () => set(s => ({ currentStep: Math.max(s.currentStep - 1, 1) })),

      // Field setters
      setField: (field, value) => set({ [field]: value, isDirty: true }),
      setFields: (fields) => set({ ...fields, isDirty: true }),

      // Division management
      addDivision: (division) =>
        set(s => ({ divisions: [...s.divisions, division], isDirty: true })),
      updateDivision: (id, updates) =>
        set(s => ({
          divisions: s.divisions.map(d => d.id === id ? { ...d, ...updates } : d),
          isDirty: true,
        })),
      removeDivision: (id) =>
        set(s => ({
          divisions: s.divisions.filter(d => d.id !== id),
          isDirty: true,
        })),

      // Venue management
      addVenue: (venue) =>
        set(s => ({ venues: [...s.venues, venue], isDirty: true })),
      updateVenue: (id, updates) =>
        set(s => ({
          venues: s.venues.map(v => v.id === id ? { ...v, ...updates } : v),
          isDirty: true,
        })),
      removeVenue: (id) =>
        set(s => ({ venues: s.venues.filter(v => v.id !== id), isDirty: true })),

      // Team management
      addTeam: (team) =>
        set(s => ({ teams: [...s.teams, team], isDirty: true })),
      addTeams: (newTeams) =>
        set(s => ({ teams: [...s.teams, ...newTeams], isDirty: true })),
      updateTeam: (id, updates) =>
        set(s => ({
          teams: s.teams.map(t => t.id === id ? { ...t, ...updates } : t),
          isDirty: true,
        })),
      removeTeam: (id) =>
        set(s => ({ teams: s.teams.filter(t => t.id !== id), isDirty: true })),
      setPoolAssignment: (teamId, poolId) =>
        set(s => ({
          poolAssignments: { ...s.poolAssignments, [teamId]: poolId },
          isDirty: true,
        })),

      // Schedule
      setScheduleConfig: (config) =>
        set(s => ({ scheduleConfig: { ...s.scheduleConfig, ...config }, isDirty: true })),
      setGeneratedSchedule: ({ slots, matches, conflicts }) =>
        set({ generatedSlots: slots, generatedMatches: matches, scheduleConflicts: conflicts }),
      updateMatchSlot: (matchId, slotId, venueId) =>
        set(s => ({
          generatedMatches: s.generatedMatches.map(m =>
            m.id === matchId ? { ...m, slot_id: slotId, venue_id: venueId } : m
          ),
          isDirty: true,
        })),

      // Constraint review
      markTeamReviewed: (teamId) =>
        set(s => ({
          reviewedTeamIds: [...new Set([...s.reviewedTeamIds, teamId])],
        })),
      acknowledgeConflict: (conflictKey) =>
        set(s => ({
          acknowledgedConflicts: [...new Set([...s.acknowledgedConflicts, conflictKey])],
        })),

      // Computed
      getTeamsForDivision: (divisionId) =>
        get().teams.filter(t => t.division_id === divisionId),
      getTeamsForPool: (poolId) =>
        get().teams.filter(t => get().poolAssignments[t.id] === poolId),
      hasUnacknowledgedErrors: () =>
        get().scheduleConflicts
          .filter(c => c.severity === 'error')
          .some(c => !get().acknowledgedConflicts.includes(`${c.type}:${c.team_id}`)),

      // Save to DB
      markSaved: () => set({ isDirty: false }),
      setTournamentId: (id) => set({ tournamentId: id }),

      // Reset
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'athleteos-wizard',
      partialize: (state) => ({
        // Only persist non-derived data
        currentStep: state.currentStep,
        tournamentId: state.tournamentId,
        name: state.name,
        description: state.description,
        startDate: state.startDate,
        endDate: state.endDate,
        divisions: state.divisions,
        venues: state.venues,
        teams: state.teams,
        poolAssignments: state.poolAssignments,
        reviewedTeamIds: state.reviewedTeamIds,
        acknowledgedConflicts: state.acknowledgedConflicts,
      }),
    }
  )
)
```

---

## Core Hooks

### useRealtime.js
Central Supabase Realtime manager. Call once per page, returns live data.

```javascript
// hooks/useRealtime.js
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe to Supabase Realtime for a specific channel.
 * Automatically cleans up on unmount.
 *
 * @param {string}   channelName  - unique channel identifier
 * @param {Object[]} subscriptions - array of { table, filter, event, onData }
 * @returns {{ isConnected: boolean }}
 */
export function useRealtime(channelName, subscriptions) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!subscriptions || subscriptions.length === 0) return

    let channel = supabase.channel(channelName)

    for (const sub of subscriptions) {
      channel = channel.on(
        'postgres_changes',
        {
          event: sub.event || '*',
          schema: 'public',
          table: sub.table,
          filter: sub.filter,
        },
        (payload) => sub.onData(payload)
      )
    }

    channelRef.current = channel.subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [channelName])
}

/**
 * Subscribe to a live match.
 * Returns live score + events that update in real-time.
 */
export function useMatchRealtime(matchId, { onScoreUpdate, onEventAdded }) {
  useRealtime(`match-${matchId}`, [
    {
      table: 'matches',
      filter: `id=eq.${matchId}`,
      event: 'UPDATE',
      onData: (payload) => onScoreUpdate?.(payload.new),
    },
    {
      table: 'game_events',
      filter: `match_id=eq.${matchId}`,
      event: 'INSERT',
      onData: (payload) => onEventAdded?.(payload.new),
    },
  ])
}

/**
 * Subscribe to pool standings for a division.
 */
export function useStandingsRealtime(divisionId, onUpdate) {
  useRealtime(`standings-${divisionId}`, [
    {
      table: 'pool_standings',
      event: 'UPDATE',
      onData: onUpdate,
    },
  ])
}

/**
 * Subscribe to all matches in a tournament (for director HQ).
 */
export function useTournamentRealtime(tournamentId, { onMatchUpdate, onDelay }) {
  useRealtime(`tournament-${tournamentId}`, [
    {
      table: 'matches',
      filter: `tournament_id=eq.${tournamentId}`,
      event: 'UPDATE',
      onData: (payload) => onMatchUpdate?.(payload.new),
    },
    {
      table: 'schedule_delays',
      filter: `tournament_id=eq.${tournamentId}`,
      event: 'INSERT',
      onData: (payload) => onDelay?.(payload.new),
    },
  ])
}
```

---

### useMatch.js
Single match data with live updates.

```javascript
// hooks/useMatch.js
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useMatchRealtime } from './useRealtime'

export function useMatch(matchId) {
  const [match, setMatch] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initial load
  useEffect(() => {
    if (!matchId) return

    async function load() {
      setLoading(true)
      const [matchRes, eventsRes] = await Promise.all([
        supabase
          .from('matches')
          .select(`
            *,
            team_a:tournament_teams!team_a_id(id, name, short_name, primary_color, logo_url),
            team_b:tournament_teams!team_b_id(id, name, short_name, primary_color, logo_url),
            venue:venues(id, name, short_name),
            time_slot:time_slots(scheduled_start, scheduled_end, offset_minutes)
          `)
          .eq('id', matchId)
          .single(),
        supabase
          .from('game_events')
          .select(`
            *,
            player:players(id, name, number),
            secondary_player:players!secondary_player_id(id, name, number)
          `)
          .eq('match_id', matchId)
          .is('deleted_at', null)
          .order('sequence', { ascending: true }),
      ])

      if (matchRes.error) setError(matchRes.error)
      else setMatch(matchRes.data)

      if (eventsRes.data) setEvents(eventsRes.data)
      setLoading(false)
    }

    load()
  }, [matchId])

  // Live updates
  useMatchRealtime(matchId, {
    onScoreUpdate: (updated) => {
      setMatch(prev => prev ? { ...prev, ...updated } : updated)
    },
    onEventAdded: (event) => {
      setEvents(prev => [...prev, event])
    },
  })

  return { match, events, loading, error }
}
```

---

### useScorekeeper.js
Score entry logic with undo stack.

```javascript
// hooks/useScorekeeper.js
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useOfflineQueue } from './useOfflineQueue'

const MAX_UNDO_HISTORY = 10
const UNDO_WINDOW_MINUTES = 10

export function useScorekeeper(matchId, userId) {
  const [undoStack, setUndoStack] = useState([])  // Array of event IDs
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const { queueEvent, isOnline } = useOfflineQueue()

  /**
   * Submit a point event (goal + optional assist + turnovers).
   * Handles offline queuing automatically.
   */
  const submitPoint = useCallback(async ({
    teamId,
    scoringPlayerId,
    assistPlayerId,
    turnovers = [],       // Array of { playerId, statId } for each turnover
    isCallahan = false,
    scoreAAfter,
    scoreBAfter,
    periodAfter,
    gameTimeSeconds,
  }) => {
    setIsSubmitting(true)
    setError(null)

    const events = []
    const now = new Date().toISOString()
    let seq = Date.now() // Use timestamp as sequence (monotonically increasing)

    // Main scoring event
    events.push({
      match_id: matchId,
      stat_id: isCallahan ? 'callahan' : 'goal',
      team_id: teamId,
      player_id: scoringPlayerId,
      secondary_player_id: assistPlayerId || null,
      secondary_stat_id: assistPlayerId ? 'assist' : null,
      score_a_after: scoreAAfter,
      score_b_after: scoreBAfter,
      period_after: periodAfter,
      game_time_seconds: gameTimeSeconds,
      event_timestamp: now,
      source: 'manual',
      sequence: seq++,
      created_by: userId,
    })

    // Turnover events (if any)
    for (const turnover of turnovers) {
      events.push({
        match_id: matchId,
        stat_id: turnover.statId || 'turnover',
        team_id: teamId,
        player_id: turnover.playerId,
        score_a_after: scoreAAfter,   // Score doesn't change for turnovers
        score_b_after: scoreBAfter,
        period_after: periodAfter,
        game_time_seconds: gameTimeSeconds,
        event_timestamp: now,
        source: 'manual',
        sequence: seq++,
        created_by: userId,
      })
    }

    // Submit or queue
    if (isOnline) {
      const { data, error: submitError } = await supabase
        .from('game_events')
        .insert(events)
        .select('id')

      if (submitError) {
        setError(submitError.message)
        setIsSubmitting(false)
        return { success: false, error: submitError }
      }

      // Add to undo stack (can undo this whole point)
      const eventIds = data.map(e => e.id)
      setUndoStack(prev => [
        { eventIds, timestamp: new Date(), description: 'Goal' },
        ...prev.slice(0, MAX_UNDO_HISTORY - 1),
      ])

      setIsSubmitting(false)
      return { success: true, eventIds }
    } else {
      // Queue for when connectivity returns
      for (const event of events) {
        queueEvent(event)
      }
      setIsSubmitting(false)
      return { success: true, queued: true }
    }
  }, [matchId, userId, isOnline])

  /**
   * Undo the last action (soft-delete events).
   */
  const undoLast = useCallback(async () => {
    if (undoStack.length === 0) return

    const [last, ...rest] = undoStack

    // Check undo window
    const ageMinutes = (new Date() - last.timestamp) / 60000
    if (ageMinutes > UNDO_WINDOW_MINUTES) {
      setError(`Cannot undo — action is more than ${UNDO_WINDOW_MINUTES} minutes old`)
      return
    }

    const { error: undoError } = await supabase
      .from('game_events')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .in('id', last.eventIds)

    if (undoError) {
      setError(undoError.message)
      return
    }

    setUndoStack(rest)
  }, [undoStack, userId])

  /**
   * Start the game — sets match status to in_progress.
   */
  const startGame = useCallback(async () => {
    const { error: startError } = await supabase
      .from('matches')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', matchId)

    if (startError) setError(startError.message)
    return { success: !startError }
  }, [matchId])

  /**
   * End the game — sets match status to complete, triggers bracket advance.
   */
  const endGame = useCallback(async (winnerId) => {
    const { error: endError } = await supabase
      .from('matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', matchId)

    if (endError) setError(endError.message)
    return { success: !endError }
  }, [matchId])

  /**
   * Toggle cap status.
   */
  const setCap = useCallback(async (capStatus) => {
    const { error: capError } = await supabase
      .from('matches')
      .update({
        cap_status: capStatus,
        cap_triggered_at: new Date().toISOString(),
      })
      .eq('id', matchId)

    if (capError) setError(capError.message)
  }, [matchId])

  return {
    submitPoint,
    undoLast,
    startGame,
    endGame,
    setCap,
    undoStack,
    canUndo: undoStack.length > 0,
    isSubmitting,
    isOnline,
    error,
  }
}
```

---

### useFollows.js
Guest + logged-in follow management.

```javascript
// hooks/useFollows.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const GUEST_TOKEN_KEY = 'athleteOS_guest_token'

function getOrCreateGuestToken() {
  let token = localStorage.getItem(GUEST_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(GUEST_TOKEN_KEY, token)
  }
  return token
}

export function useFollows(userId = null) {
  const [follows, setFollows] = useState([])
  const [guestToken] = useState(() =>
    typeof window !== 'undefined' ? getOrCreateGuestToken() : null
  )

  // Load follows on mount
  useEffect(() => {
    if (!guestToken && !userId) return

    const query = supabase
      .from('user_follows')
      .select('*')

    if (userId) {
      query.eq('user_id', userId)
    } else {
      query.eq('guest_token', guestToken)
    }

    query.then(({ data }) => {
      if (data) setFollows(data)
    })
  }, [userId, guestToken])

  const isFollowing = useCallback((teamId) => {
    return follows.some(f => f.tournament_team_id === teamId)
  }, [follows])

  const followTeam = useCallback(async (teamId, tournamentId) => {
    const payload = {
      tournament_team_id: teamId,
      tournament_id: tournamentId,
      notify_score_updates: true,
      notify_game_start: true,
    }

    if (userId) {
      payload.user_id = userId
    } else {
      payload.guest_token = guestToken
    }

    const { data, error } = await supabase
      .from('user_follows')
      .upsert(payload, { onConflict: 'user_id,tournament_team_id' })
      .select()
      .single()

    if (!error && data) {
      setFollows(prev => [...prev.filter(f => f.tournament_team_id !== teamId), data])
    }

    return { success: !error }
  }, [userId, guestToken])

  const unfollowTeam = useCallback(async (teamId) => {
    const query = supabase
      .from('user_follows')
      .delete()
      .eq('tournament_team_id', teamId)

    if (userId) query.eq('user_id', userId)
    else query.eq('guest_token', guestToken)

    const { error } = await query

    if (!error) {
      setFollows(prev => prev.filter(f => f.tournament_team_id !== teamId))
    }
  }, [userId, guestToken])

  /**
   * Migrate guest follows to a user account (called on sign-up).
   */
  const migrateGuestFollows = useCallback(async (newUserId) => {
    if (!guestToken) return

    await supabase
      .from('user_follows')
      .update({ user_id: newUserId, guest_token: null })
      .eq('guest_token', guestToken)

    localStorage.removeItem(GUEST_TOKEN_KEY)
  }, [guestToken])

  const followedTeamIds = follows
    .filter(f => f.tournament_team_id)
    .map(f => f.tournament_team_id)

  return {
    follows,
    followedTeamIds,
    isFollowing,
    followTeam,
    unfollowTeam,
    migrateGuestFollows,
    guestToken,
  }
}
```

---

### useOfflineQueue.js
IndexedDB queue for offline score entry.

```javascript
// hooks/useOfflineQueue.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const DB_NAME = 'athleteOS'
const STORE_NAME = 'event_queue'

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useOfflineQueue() {
  const [queueSize, setQueueSize] = useState(0)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const dbRef = useRef(null)

  // Monitor online status
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      flushQueue()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Open DB on mount
  useEffect(() => {
    openDB().then(db => {
      dbRef.current = db
      countQueue()
    })
  }, [])

  const countQueue = async () => {
    if (!dbRef.current) return
    const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
    const count = await new Promise(r => { const req = tx.objectStore(STORE_NAME).count(); req.onsuccess = () => r(req.result) })
    setQueueSize(count)
  }

  const queueEvent = useCallback(async (event) => {
    if (!dbRef.current) return
    const tx = dbRef.current.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ event, queued_at: new Date().toISOString() })
    await countQueue()
  }, [])

  const flushQueue = useCallback(async () => {
    if (!dbRef.current) return

    const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const all = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result) })

    for (const record of all) {
      try {
        const { error } = await supabase
          .from('game_events')
          .insert(record.event)

        if (!error) {
          // Remove from queue
          const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
          deleteTx.objectStore(STORE_NAME).delete(record.id)
        }
      } catch (e) {
        console.error('Failed to flush event:', e)
        break // Stop flushing on error — will retry when online again
      }
    }

    await countQueue()
  }, [])

  return { queueEvent, flushQueue, queueSize, isOnline }
}
```

---

## Key Component Sketches

### CourtLanding.jsx
Court QR auto-redirect logic.

```jsx
// pages/tournament/court/[tournamentId]/[venueSlug]/page.jsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LiveScoreCard } from '@/components/tournament/scores/LiveScoreCard'
import { SpectatorWizard } from '@/components/tournament/spectator/SpectatorWizard'

export default function CourtLanding({ params }) {
  const { tournamentId, venueSlug } = params
  const router = useRouter()
  const [activeMatch, setActiveMatch] = useState(null)
  const [nextMatch, setNextMatch] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function detectActiveGame() {
      // Find what's currently happening on this court
      const { data: active } = await supabase
        .from('active_matches_by_venue')   // Uses our helper view
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('venue_qr_slug', venueSlug)
        .eq('status', 'in_progress')
        .maybeSingle()

      if (active) {
        setActiveMatch(active)
        // Show wizard after 3 seconds of showing the score
        setTimeout(() => setShowWizard(true), 3000)
      } else {
        // Look for next scheduled game
        const { data: next } = await supabase
          .from('active_matches_by_venue')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('venue_qr_slug', venueSlug)
          .eq('status', 'scheduled')
          .order('scheduled_start', { ascending: true })
          .limit(1)
          .maybeSingle()

        setNextMatch(next)
        if (next) setTimeout(() => setShowWizard(true), 2000)
      }

      setLoading(false)
    }

    detectActiveGame()
  }, [tournamentId, venueSlug])

  if (loading) return <LoadingSpinner />

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {activeMatch && (
        <LiveScoreCard match={activeMatch} size="large" />
      )}

      {!activeMatch && nextMatch && (
        <NextGameCard match={nextMatch} />
      )}

      {!activeMatch && !nextMatch && (
        <NoGamesCard venueName={venueSlug} />
      )}

      {/* Spectator onboarding wizard — slides up from bottom */}
      {showWizard && (
        <SpectatorWizard
          match={activeMatch || nextMatch}
          tournamentId={tournamentId}
          onDismiss={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
```

---

### TournamentWizard.jsx
8-step wizard container with step routing.

```jsx
// components/tournament/wizard/TournamentWizard.jsx
'use client'
import { useWizardStore } from '@/store/wizardStore'
import { WizardProgress } from './WizardProgress'
import { WizardStep1Basics } from './WizardStep1Basics'
import { WizardStep2Sport } from './WizardStep2Sport'
import { WizardStep3Divisions } from './WizardStep3Divisions'
import { WizardStep4Venues } from './WizardStep4Venues'
import { WizardStep5Teams } from './WizardStep5Teams'
import { WizardStep6Schedule } from './WizardStep6Schedule'
import { WizardStep7Constraints } from './WizardStep7Constraints'
import { WizardStep8Preview } from './WizardStep8Preview'

const STEPS = [
  { number: 1, label: 'Basics',      component: WizardStep1Basics },
  { number: 2, label: 'Sport',       component: WizardStep2Sport },
  { number: 3, label: 'Divisions',   component: WizardStep3Divisions },
  { number: 4, label: 'Venues',      component: WizardStep4Venues },
  { number: 5, label: 'Teams',       component: WizardStep5Teams },
  { number: 6, label: 'Schedule',    component: WizardStep6Schedule },
  { number: 7, label: 'Review',      component: WizardStep7Constraints },
  { number: 8, label: 'Publish',     component: WizardStep8Preview },
]

export function TournamentWizard({ mode = 'create', tournamentId }) {
  const { currentStep, nextStep, prevStep } = useWizardStore()

  const CurrentStep = STEPS[currentStep - 1]?.component

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <WizardProgress steps={STEPS} currentStep={currentStep} />

      <div className="mt-8 bg-white rounded-2xl shadow-sm border p-8">
        {CurrentStep && (
          <CurrentStep
            onNext={nextStep}
            onBack={prevStep}
            isFirst={currentStep === 1}
            isLast={currentStep === 8}
          />
        )}
      </div>
    </div>
  )
}
```

---

### ScorekeeperConsole.jsx
Main scoring UI — mobile-first, large touch targets.

```jsx
// components/tournament/scoring/ScorekeeperConsole.jsx
'use client'
import { useState } from 'react'
import { useMatch } from '@/hooks/useMatch'
import { useScorekeeper } from '@/hooks/useScorekeeper'
import { PreGameScreen } from './PreGameScreen'
import { LiveScoringScreen } from './LiveScoringScreen'
import { PostGameScreen } from './PostGameScreen'

export function ScorekeeperConsole({ matchId, userId }) {
  const { match, events, loading } = useMatch(matchId)
  const scorekeeper = useScorekeeper(matchId, userId)
  const [screen, setScreen] = useState('pre') // 'pre' | 'live' | 'post'

  if (loading || !match) return <LoadingSpinner />

  // Screen routing based on match status
  if (match.status === 'scheduled' || screen === 'pre') {
    return (
      <PreGameScreen
        match={match}
        onStart={async () => {
          const result = await scorekeeper.startGame()
          if (result.success) setScreen('live')
        }}
      />
    )
  }

  if (match.status === 'in_progress' || screen === 'live') {
    return (
      <LiveScoringScreen
        match={match}
        events={events}
        scorekeeper={scorekeeper}
        onEndGame={() => setScreen('post')}
      />
    )
  }

  if (match.status === 'complete' || screen === 'post') {
    return (
      <PostGameScreen
        match={match}
        events={events}
      />
    )
  }
}
```

---

## Page Auth Guards

```javascript
// lib/withAuth.js
// Higher-order component for protected pages

import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export async function requireDirector(tournamentId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('director_id')
    .eq('id', tournamentId)
    .single()

  if (tournament?.director_id !== user.id) redirect('/unauthorized')
  return user
}

export async function requireScorekeeper(matchId) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Check PIN in localStorage instead
    const pin = localStorage.getItem(`match_pin_${matchId}`)
    if (!pin) redirect(`/tournament/score/${matchId}?auth=scorekeeper`)
    return null // PIN user — no user object
  }

  const { data: role } = await supabase
    .from('tournament_roles')
    .select('role, assigned_match_ids')
    .eq('user_id', user.id)
    .in('role', ['scorekeeper','director','co_director'])
    .maybeSingle()

  if (!role) redirect('/unauthorized')
  return user
}
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Server-side only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Dependencies to Install

```bash
# Core (already in athleteOS)
npm install @supabase/supabase-js

# State management
npm install zustand

# Drag and drop (schedule grid + pool builder)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# QR codes
npm install qrcode.react

# PDF generation (for QR code print cards)
npm install @react-pdf/renderer

# CSV parsing (team import)
npm install papaparse

# Date/time
npm install date-fns date-fns-tz

# Icons (if not already installed)
npm install lucide-react
```

---

## Build Priority Reminder

```
Week 1 (Foundation):
  ✓ migration.sql       → run this first
  ✓ supabase.js         → client singleton
  ✓ wizardStore.js      → state before any wizard UI
  1. WizardStep1-4      → basics, sport, divisions, venues
  2. WizardStep5        → teams + pool assignment
  3. ScheduleGrid       → semi-auto + drag-to-adjust

Week 2 (Scoring):
  4. ScorekeeperConsole → pre-game, live, point entry
  5. useRealtime        → Supabase channels
  6. LiveScoreCard      → public scoreboard
  7. CourtLanding       → QR auto-redirect

Week 3 (Public):
  8. PoolStandingsTable → real-time with tie-breakers
  9. SpectatorWizard    → follow onboarding
  10. BracketTree        → SVG bracket
  11. QRPDFExport        → printable QR cards
  12. SOTGEntryForm      → post-game spirit scores
```
