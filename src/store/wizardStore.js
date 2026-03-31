import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_TIEBREAKERS, SCHEDULE_DEFAULTS } from '../lib/constants'

// ─── Initial state ─────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  // Meta
  currentStep: 1,
  tournamentId: null,   // Set after first save to DB
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
  sportConfig: null,       // Full config loaded from sport_templates
  enabledStatIds: [],      // Subset of sport_config.stats the director wants
  tiebreakerOrder: [...DEFAULT_TIEBREAKERS],
  sotgEnabled: true,

  // ── Step 3: Divisions ─────────────────────────────────────────────────────────
  // Each division: { id (local uuid), name, slug, formatType, gameDurationMinutes,
  //                  breakBetweenGamesMinutes, teamsAdvancePerPool,
  //                  consolationBracket, thirdPlaceGame, sortOrder }
  divisions: [],

  // ── Step 4: Venues ────────────────────────────────────────────────────────────
  // Each venue: { id (local uuid), name, shortName, qrSlug, sortOrder }
  venues: [],

  // ── Step 5: Teams + pool assignment ──────────────────────────────────────────
  // Each team: { id (local uuid), name, shortName, divisionId, clubName,
  //              seed, primaryColor, headCoachName, headCoachEmail, constraints }
  teams: [],
  // Each pool: { id (local uuid), divisionId, name, shortName, sortOrder }
  pools: [],
  // teamId → poolId
  poolAssignments: {},

  // ── Step 6: Schedule ──────────────────────────────────────────────────────────
  scheduleConfig: {
    startTime: null,      // ISO datetime string
    endTime: null,
    lunchBreakStart: null,
    lunchBreakEnd: null,
    gameDurationMinutes:      SCHEDULE_DEFAULTS.gameDurationMinutes,
    breakBetweenGamesMinutes: SCHEDULE_DEFAULTS.breakBetweenGamesMinutes,
    minRestBetweenTeamGames:  SCHEDULE_DEFAULTS.minRestBetweenTeamGames,
  },
  generatedSlots: [],     // time_slot objects from scheduleGenerator
  generatedMatches: [],   // match objects from scheduleGenerator
  scheduleConflicts: [],  // conflict objects from scheduleGenerator

  // ── Step 7: Constraint review ─────────────────────────────────────────────────
  reviewedTeamIds: [],
  acknowledgedConflicts: [],

  // ── Step 8: Preview / publish ─────────────────────────────────────────────────
  isPublished: false,
}

// ─── Store ─────────────────────────────────────────────────────────────────────
export const useWizardStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── Navigation ─────────────────────────────────────────────────────────────
      goToStep: (step) => set({ currentStep: step }),
      nextStep: () => set(s => ({ currentStep: Math.min(s.currentStep + 1, 8) })),
      prevStep: () => set(s => ({ currentStep: Math.max(s.currentStep - 1, 1) })),

      // ── Generic setters ────────────────────────────────────────────────────────
      setField: (field, value) => set({ [field]: value, isDirty: true }),
      setFields: (fields) => set({ ...fields, isDirty: true }),

      // ── Step 2: Sport ──────────────────────────────────────────────────────────
      setSport: (template) => set({
        sportTemplateId: template.id,
        sportSlug: template.slug,
        sportConfig: template.config,
        enabledStatIds: template.config.stats
          .filter(s => s.default_enabled)
          .map(s => s.id),
        sotgEnabled: template.config.sotg_enabled ?? false,
        isDirty: true,
      }),

      toggleStat: (statId) => set(s => ({
        enabledStatIds: s.enabledStatIds.includes(statId)
          ? s.enabledStatIds.filter(id => id !== statId)
          : [...s.enabledStatIds, statId],
        isDirty: true,
      })),

      setTiebreakerOrder: (order) => set({ tiebreakerOrder: order, isDirty: true }),

      // ── Step 3: Divisions ──────────────────────────────────────────────────────
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
          // Also remove teams and pools in this division
          teams: s.teams.filter(t => t.divisionId !== id),
          pools: s.pools.filter(p => p.divisionId !== id),
          isDirty: true,
        })),

      reorderDivisions: (ordered) =>
        set({ divisions: ordered.map((d, i) => ({ ...d, sortOrder: i })), isDirty: true }),

      // ── Step 4: Venues ─────────────────────────────────────────────────────────
      addVenue: (venue) =>
        set(s => ({ venues: [...s.venues, venue], isDirty: true })),

      updateVenue: (id, updates) =>
        set(s => ({
          venues: s.venues.map(v => v.id === id ? { ...v, ...updates } : v),
          isDirty: true,
        })),

      removeVenue: (id) =>
        set(s => ({ venues: s.venues.filter(v => v.id !== id), isDirty: true })),

      reorderVenues: (ordered) =>
        set({ venues: ordered.map((v, i) => ({ ...v, sortOrder: i })), isDirty: true }),

      // ── Step 5: Teams ──────────────────────────────────────────────────────────
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
        set(s => ({
          teams: s.teams.filter(t => t.id !== id),
          poolAssignments: Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([tid]) => tid !== id)
          ),
          isDirty: true,
        })),

      // Pool management
      addPool: (pool) =>
        set(s => ({ pools: [...s.pools, pool], isDirty: true })),

      updatePool: (id, updates) =>
        set(s => ({
          pools: s.pools.map(p => p.id === id ? { ...p, ...updates } : p),
          isDirty: true,
        })),

      removePool: (id) =>
        set(s => ({
          pools: s.pools.filter(p => p.id !== id),
          // Unassign teams from this pool
          poolAssignments: Object.fromEntries(
            Object.entries(s.poolAssignments).filter(([, pid]) => pid !== id)
          ),
          isDirty: true,
        })),

      setPoolsForDivision: (divisionId, pools) =>
        set(s => ({
          pools: [...s.pools.filter(p => p.divisionId !== divisionId), ...pools],
          isDirty: true,
        })),

      setPoolAssignment: (teamId, poolId) =>
        set(s => ({
          poolAssignments: { ...s.poolAssignments, [teamId]: poolId },
          isDirty: true,
        })),

      setPoolAssignments: (assignments) =>
        set(s => ({
          poolAssignments: { ...s.poolAssignments, ...assignments },
          isDirty: true,
        })),

      // ── Step 6: Schedule ───────────────────────────────────────────────────────
      setScheduleConfig: (config) =>
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
        set({ generatedSlots: [], generatedMatches: [], scheduleConflicts: [] }),

      // ── Step 7: Constraint review ──────────────────────────────────────────────
      markTeamReviewed: (teamId) =>
        set(s => ({
          reviewedTeamIds: [...new Set([...s.reviewedTeamIds, teamId])],
        })),

      acknowledgeConflict: (conflictKey) =>
        set(s => ({
          acknowledgedConflicts: [...new Set([...s.acknowledgedConflicts, conflictKey])],
        })),

      // ── Computed getters ───────────────────────────────────────────────────────
      getTeamsForDivision: (divisionId) =>
        get().teams.filter(t => t.divisionId === divisionId),

      getTeamsForPool: (poolId) =>
        get().teams.filter(t => get().poolAssignments[t.id] === poolId),

      getPoolsForDivision: (divisionId) =>
        get().pools.filter(p => p.divisionId === divisionId),

      getUnassignedTeams: (divisionId) => {
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

      // ── Step 8 / persistence ───────────────────────────────────────────────────
      setTournamentId: (id) => set({ tournamentId: id }),
      markSaved: () => set({ isDirty: false }),
      setPublished: () => set({ isPublished: true, isDirty: false }),

      // ── Reset ──────────────────────────────────────────────────────────────────
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'athleteos-wizard',
      // Only persist what the director would expect to survive a page reload.
      // Derived/generated data (schedule conflicts etc.) is omitted.
      partialize: (s) => ({
        currentStep:          s.currentStep,
        tournamentId:         s.tournamentId,
        isPublished:          s.isPublished,
        // Step 1
        name:                 s.name,
        description:          s.description,
        rules_text:           s.rulesText || null,
        slug:                 s.slug,
        startDate:            s.startDate,
        endDate:              s.endDate,
        timezone:             s.timezone,
        venueName:            s.venueName,
        venueAddress:         s.venueAddress,
        primaryColor:         s.primaryColor,
        isPublic:             s.isPublic,
        logoUrl:              s.logoUrl,
        // Step 2
        sportTemplateId:      s.sportTemplateId,
        sportSlug:            s.sportSlug,
        sportConfig:          s.sportConfig,
        enabledStatIds:       s.enabledStatIds,
        tiebreakerOrder:      s.tiebreakerOrder,
        sotgEnabled:          s.sotgEnabled,
        // Step 3
        divisions:            s.divisions,
        // Step 4
        venues:               s.venues,
        // Step 5
        teams:                s.teams,
        pools:                s.pools,
        poolAssignments:      s.poolAssignments,
        // Step 6
        scheduleConfig:       s.scheduleConfig,
        generatedMatches:     s.generatedMatches,
        generatedSlots:       s.generatedSlots,
        // Step 7
        reviewedTeamIds:      s.reviewedTeamIds,
        acknowledgedConflicts: s.acknowledgedConflicts,
      }),
    }
  )
)
