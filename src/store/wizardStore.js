import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_TIEBREAKERS, SCHEDULE_DEFAULTS } from '../lib/constants'

// ─── Initial state ─────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  // Meta
  currentStep: 1,
  tournamentId: null,
  isDirty: false,

  // ── Step 1: Basics ────────────────────────────────────────────────────────────
  name: '',
  description: '',
  rulesText: '',
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

  // ── Step 2: Sport & format ────────────────────────────────────────────────────
  sportTemplateId: null,
  sportSlug: null,
  sportConfig: null,
  enabledStatIds: [],
  tiebreakerOrder: [...DEFAULT_TIEBREAKERS],
  sotgEnabled: true,

  // ── Step 3: Divisions ─────────────────────────────────────────────────────────
  divisions: [],

  // ── Step 4: Venues ────────────────────────────────────────────────────────────
  venues: [],

  // ── Step 5: Teams + pool assignment ──────────────────────────────────────────
  teams: [],
  pools: [],
  poolAssignments: {},
  tournamentDays: [],
  rosters: [],

  // ── Step 6: Schedule ──────────────────────────────────────────────────────────
  scheduleConfig: {
    startTime: null,
    endTime: null,
    lunchBreakStart: null,
    lunchBreakEnd: null,
    gameDurationMinutes: SCHEDULE_DEFAULTS.gameDurationMinutes,
    breakBetweenGamesMinutes: SCHEDULE_DEFAULTS.breakBetweenGamesMinutes,
    minRestBetweenTeamGames: SCHEDULE_DEFAULTS.minRestBetweenTeamGames,
    generationMode: 'round',
  },
  generatedSlots: [],
  generatedMatches: [],
  scheduleConflicts: [],

  // ── Step 7: Playoffs ──────────────────────────────────────────────────────────
  playoffConfigs: {},
  generatedPlayoffMatches: [],

  // ── Step 8: Constraints ───────────────────────────────────────────────────────
  reviewedTeamIds: [],
  acknowledgedConflicts: [],

  // ── Step 9: Preview / publish ─────────────────────────────────────────────────
  isPublished: false,
}

function clearGeneratedScheduleState() {
  return {
    generatedSlots: [],
    generatedMatches: [],
    scheduleConflicts: [],
  }
}

export const useWizardStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── Navigation ─────────────────────────────────────────────────────────────
      goToStep: step => set({ currentStep: step }),
      nextStep: () => set(s => ({ currentStep: Math.min(s.currentStep + 1, 9) })),
      prevStep: () => set(s => ({ currentStep: Math.max(s.currentStep - 1, 1) })),

      // ── Generic setters ────────────────────────────────────────────────────────
      setField: (field, value) => set({ [field]: value, isDirty: true }),
      setFields: fields => set({ ...fields, isDirty: true }),

      // ── Step 2: Sport ──────────────────────────────────────────────────────────
      setSport: template => set({
        sportTemplateId: template.id,
        sportSlug: template.slug,
        sportConfig: template.config,
        enabledStatIds: template.config.stats
          .filter(s => s.default_enabled)
          .map(s => s.id),
        sotgEnabled: template.config.sotg_enabled ?? false,
        isDirty: true,
      }),

      toggleStat: statId => set(s => ({
        enabledStatIds: s.enabledStatIds.includes(statId)
          ? s.enabledStatIds.filter(id => id !== statId)
          : [...s.enabledStatIds, statId],
        isDirty: true,
      })),

      setTiebreakerOrder: order => set({ tiebreakerOrder: order, isDirty: true }),

      // ── Step 3: Divisions ──────────────────────────────────────────────────────
      setDivisions: divisions =>
        set({
          divisions,
          ...clearGeneratedScheduleState(),
          isDirty: true,
        }),

      addDivision: division =>
        set(s => ({
          divisions: [...s.divisions, division],
          isDirty: true,
        })),

      updateDivision: (id, updates) =>
        set(s => ({
          divisions: s.divisions.map(d => d.id === id ? { ...d, ...updates } : d),
          isDirty: true,
        })),

      removeDivision: id =>
        set(s => {
          const nextTeams = s.teams.filter(t => t.divisionId !== id)
          const nextPools = s.pools.filter(p => p.divisionId !== id)
          const nextPoolIds = new Set(nextPools.map(p => p.id))

          const nextAssignments = Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([teamId, poolId]) => {
              const teamStillExists = nextTeams.some(t => t.id === teamId)
              const poolStillExists = nextPoolIds.has(poolId)
              return teamStillExists && poolStillExists
            })
          )

          const nextPlayoffConfigs = { ...(s.playoffConfigs || {}) }
          delete nextPlayoffConfigs[id]

          return {
            divisions: s.divisions.filter(d => d.id !== id),
            teams: nextTeams,
            pools: nextPools,
            poolAssignments: nextAssignments,
            rosters: s.rosters.filter(r => nextTeams.some(t => t.id === r.teamId)),
            playoffConfigs: nextPlayoffConfigs,
            ...clearGeneratedScheduleState(),
            isDirty: true,
          }
        }),

      reorderDivisions: ordered =>
        set({
          divisions: ordered.map((d, i) => ({ ...d, sortOrder: i })),
          isDirty: true,
        }),

      // ── Step 4: Venues ─────────────────────────────────────────────────────────
      setVenues: venues =>
        set({
          venues,
          ...clearGeneratedScheduleState(),
          isDirty: true,
        }),

      addVenue: venue =>
        set(s => ({
          venues: [...s.venues, venue],
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      updateVenue: (id, updates) =>
        set(s => ({
          venues: s.venues.map(v => v.id === id ? { ...v, ...updates } : v),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      removeVenue: id =>
        set(s => ({
          venues: s.venues.filter(v => v.id !== id),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      reorderVenues: ordered =>
        set({
          venues: ordered.map((v, i) => ({ ...v, sortOrder: i })),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        }),

      // ── Step 5: Teams ──────────────────────────────────────────────────────────
      setTeams: teams =>
        set(s => {
          const nextTeamIds = new Set(teams.map(t => t.id))
          const nextAssignments = Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([teamId]) => nextTeamIds.has(teamId))
          )

          return {
            teams,
            poolAssignments: nextAssignments,
            rosters: s.rosters.filter(r => nextTeamIds.has(r.teamId)),
            ...clearGeneratedScheduleState(),
            isDirty: true,
          }
        }),

      addTeam: team =>
        set(s => ({
          teams: [...s.teams, team],
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      addTeams: newTeams =>
        set(s => ({
          teams: [...s.teams, ...newTeams],
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      updateTeam: (id, updates) =>
        set(s => ({
          teams: s.teams.map(t => t.id === id ? { ...t, ...updates } : t),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      removeTeam: id =>
        set(s => ({
          teams: s.teams.filter(t => t.id !== id),
          poolAssignments: Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([tid]) => tid !== id)
          ),
          rosters: s.rosters.filter(r => r.teamId !== id),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      // Pool management
      setPools: pools =>
        set(s => {
          const nextPoolIds = new Set(pools.map(p => p.id))
          const nextAssignments = Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([teamId, poolId]) => {
              const teamStillExists = s.teams.some(t => t.id === teamId)
              const poolStillExists = nextPoolIds.has(poolId)
              return teamStillExists && poolStillExists
            })
          )

          return {
            pools,
            poolAssignments: nextAssignments,
            ...clearGeneratedScheduleState(),
            isDirty: true,
          }
        }),

      addPool: pool =>
        set(s => ({
          pools: [...s.pools, pool],
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      updatePool: (id, updates) =>
        set(s => ({
          pools: s.pools.map(p => p.id === id ? { ...p, ...updates } : p),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      removePool: id =>
        set(s => ({
          pools: s.pools.filter(p => p.id !== id),
          poolAssignments: Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([, pid]) => pid !== id)
          ),
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      setPoolsForDivision: (divisionId, pools) =>
        set(s => {
          const retainedPools = s.pools.filter(p => p.divisionId !== divisionId)
          const nextPools = [...retainedPools, ...pools]
          const nextPoolIds = new Set(nextPools.map(p => p.id))

          const nextAssignments = Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([teamId, poolId]) => {
              const teamStillExists = s.teams.some(t => t.id === teamId)
              const poolStillExists = nextPoolIds.has(poolId)
              return teamStillExists && poolStillExists
            })
          )

          return {
            pools: nextPools,
            poolAssignments: nextAssignments,
            ...clearGeneratedScheduleState(),
            isDirty: true,
          }
        }),

      setPoolAssignment: (teamId, poolId) =>
        set(s => ({
          poolAssignments: {
            ...s.poolAssignments,
            [teamId]: poolId,
          },
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      setPoolAssignments: assignments =>
        set(s => ({
          poolAssignments: {
            ...(assignments || {}),
          },
          ...clearGeneratedScheduleState(),
          isDirty: true,
        })),

      setTournamentDays: days =>
        set({
          tournamentDays: days,
          isDirty: true,
        }),

      setRosters: rosters =>
        set({
          rosters,
          isDirty: true,
        }),

      // ── Step 6: Schedule ───────────────────────────────────────────────────────
      setScheduleConfig: config =>
        set(s => ({
          scheduleConfig: { ...s.scheduleConfig, ...config },
          isDirty: true,
        })),

      setGeneratedSchedule: ({ slots, matches, conflicts }) =>
        set({
          generatedSlots: slots,
          generatedMatches: matches,
          scheduleConflicts: conflicts,
          isDirty: true,
        }),

      updateMatchSlot: (matchId, slotId, venueId) =>
        set(s => ({
          generatedMatches: s.generatedMatches.map(m =>
            m.id === matchId ? { ...m, slot_id: slotId, venue_id: venueId } : m
          ),
          isDirty: true,
        })),

      clearSchedule: () =>
        set({
          generatedSlots: [],
          generatedMatches: [],
          scheduleConflicts: [],
        }),

      // ── Step 7: Playoffs ───────────────────────────────────────────────────────
      setPlayoffConfig: (divisionId, config) =>
        set(state => ({
          playoffConfigs: {
            ...(state.playoffConfigs || {}),
            [divisionId]: {
              ...(state.playoffConfigs?.[divisionId] || {}),
              ...config,
            },
          },
          isDirty: true,
        })),
setGeneratedPlayoffMatches: matches =>
  set({
    generatedPlayoffMatches: matches || [],
    isDirty: true,
  }),

clearGeneratedPlayoffMatches: () =>
  set({
    generatedPlayoffMatches: [],
    isDirty: true,
  }),
      clearPlayoffConfig: divisionId =>
        set(state => {
          const nextPlayoffConfigs = { ...(state.playoffConfigs || {}) }
          delete nextPlayoffConfigs[divisionId]

          return {
            playoffConfigs: nextPlayoffConfigs,
            isDirty: true,
          }
        }),

      // ── Step 8: Constraints ────────────────────────────────────────────────────
      markTeamReviewed: teamId =>
        set(s => ({
          reviewedTeamIds: [...new Set([...s.reviewedTeamIds, teamId])],
        })),

      acknowledgeConflict: conflictKey =>
        set(s => ({
          acknowledgedConflicts: [...new Set([...s.acknowledgedConflicts, conflictKey])],
        })),

      // ── Computed getters ───────────────────────────────────────────────────────
      getTeamsForDivision: divisionId =>
        get().teams.filter(t => t.divisionId === divisionId),

      getTeamsForPool: poolId =>
        get().teams.filter(t => get().poolAssignments[t.id] === poolId),

      getPoolsForDivision: divisionId =>
        get().pools.filter(p => p.divisionId === divisionId),

      getUnassignedTeams: divisionId => {
        const { teams, poolAssignments } = get()
        return teams
          .filter(t => t.divisionId === divisionId)
          .filter(t => !poolAssignments[t.id])
      },

      hasUnacknowledgedErrors: () =>
        get().scheduleConflicts
          .filter(c => c.severity === 'error')
          .some(c => !get().acknowledgedConflicts.includes(`${c.type}:${c.teamId}`)),

      getEnabledStats: () => {
        const { sportConfig, enabledStatIds } = get()
        if (!sportConfig?.stats) return []
        return sportConfig.stats.filter(s => enabledStatIds.includes(s.id))
      },

      // ── Step 9 / persistence ───────────────────────────────────────────────────
      setTournamentId: id => set({ tournamentId: id }),
      markSaved: () => set({ isDirty: false }),
      setPublished: () => set({ isPublished: true, isDirty: false }),

      // ── Reset ──────────────────────────────────────────────────────────────────
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'athleteos-wizard',
      partialize: s => ({
        currentStep: s.currentStep,
        tournamentId: s.tournamentId,
        isPublished: s.isPublished,

        // Step 1
        name: s.name,
        description: s.description,
        rules_text: s.rulesText || null,
        slug: s.slug,
        startDate: s.startDate,
        endDate: s.endDate,
        timezone: s.timezone,
        venueName: s.venueName,
        venueAddress: s.venueAddress,
        primaryColor: s.primaryColor,
        isPublic: s.isPublic,
        logoUrl: s.logoUrl,

        // Step 2
        sportTemplateId: s.sportTemplateId,
        sportSlug: s.sportSlug,
        sportConfig: s.sportConfig,
        enabledStatIds: s.enabledStatIds,
        tiebreakerOrder: s.tiebreakerOrder,
        sotgEnabled: s.sotgEnabled,

        // Step 3
        divisions: s.divisions,

        // Step 4
        venues: s.venues,

        // Step 5
        teams: s.teams,
        pools: s.pools,
        poolAssignments: s.poolAssignments,
        tournamentDays: s.tournamentDays,
        rosters: s.rosters,

        // Step 6
        scheduleConfig: s.scheduleConfig,
        generatedMatches: s.generatedMatches,
        generatedSlots: s.generatedSlots,

        // Step 7
        playoffConfigs: s.playoffConfigs,
        generatedPlayoffMatches: s.generatedPlayoffMatches,

        // Step 8
        reviewedTeamIds: s.reviewedTeamIds,
        acknowledgedConflicts: s.acknowledgedConflicts,
      }),
    }
  )
)