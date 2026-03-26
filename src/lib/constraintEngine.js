// -----------------------------------------------------------------------------
// constraintEngine.js
//
// Extensible constraint registry + evaluator for tournament scheduling.
//
// Adding a new constraint type:
//   1. Add an entry to CONSTRAINT_REGISTRY
//   2. Implement its check() function
//   3. Done -- it auto-runs in evaluateConstraints()
// -----------------------------------------------------------------------------

// --- Constraint categories ----------------------------------------------------
export const CONSTRAINT_CATEGORIES = {
  POOL:     'pool',       // Pool assignment constraints
  SCHEDULE: 'schedule',  // Time / field constraints
  RIVALRY:  'rivalry',   // Team vs team relationship constraints
  ROSTER:   'roster',    // Player / coach overlap constraints
}

// --- Severity levels ----------------------------------------------------------
export const SEVERITY = {
  ERROR:   'error',    // Must be resolved before publishing
  WARNING: 'warning',  // Should be reviewed, can be acknowledged
  INFO:    'info',     // FYI only
}

// -----------------------------------------------------------------------------
// CONSTRAINT REGISTRY
// Each entry defines one type of constraint.
// check() receives the full evaluation context and returns violations[].
// -----------------------------------------------------------------------------
const CONSTRAINT_REGISTRY = [

  // -- Pool constraints --------------------------------------------------------

  {
    id:          'same_club_same_pool',
    category:    CONSTRAINT_CATEGORIES.POOL,
    severity:    SEVERITY.ERROR,
    autoDetect:  true,
    label:       'Same club in same pool',
    description: 'Two or more teams from the same club are assigned to the same pool.',
    check({ teams, poolAssignments }) {
      const violations = []
      const poolTeams  = groupBy(
        teams.filter(t => t.clubName && poolAssignments[t.id]),
        t => poolAssignments[t.id]
      )

      for (const [poolId, poolTeamList] of Object.entries(poolTeams)) {
        const byClub = groupBy(poolTeamList.filter(t => t.clubName?.trim()), t => t.clubName.trim().toLowerCase())
        for (const [club, clubTeams] of Object.entries(byClub)) {
          if (clubTeams.length < 2) continue
          violations.push({
            constraintId: 'same_club_same_pool',
            severity:     SEVERITY.ERROR,
            teamIds:      clubTeams.map(t => t.id),
            poolId,
            matchIds:     [],
            message:      `${clubTeams.map(t => t.name).join(' and ')} are from the same club (${clubTeams[0].clubName}) in the same pool`,
            suggestion:   'Move one team to a different pool',
            autoFixable:  true,
            autoFix:      (state) => suggestPoolSwap(clubTeams, poolId, state),
          })
        }
      }
      return violations
    },
  },

  {
    id:          'same_school_same_pool',
    category:    CONSTRAINT_CATEGORIES.POOL,
    severity:    SEVERITY.WARNING,
    autoDetect:  true,
    label:       'Same school in same pool',
    description: 'Two or more teams from the same school are in the same pool.',
    check({ teams, poolAssignments }) {
      const violations = []
      const poolTeams  = groupBy(
        teams.filter(t => t.schoolName && poolAssignments[t.id]),
        t => poolAssignments[t.id]
      )

      for (const [poolId, poolTeamList] of Object.entries(poolTeams)) {
        const bySchool = groupBy(poolTeamList.filter(t => t.schoolName?.trim()), t => t.schoolName.trim().toLowerCase())
        for (const [school, schoolTeams] of Object.entries(bySchool)) {
          if (schoolTeams.length < 2) continue
          violations.push({
            constraintId: 'same_school_same_pool',
            severity:     SEVERITY.WARNING,
            teamIds:      schoolTeams.map(t => t.id),
            poolId,
            matchIds:     [],
            message:      `${schoolTeams.map(t => t.name).join(' and ')} are from the same school in the same pool`,
            suggestion:   'Consider separating these teams into different pools',
            autoFixable:  false,
          })
        }
      }
      return violations
    },
  },

  {
    id:          'manual_no_same_pool',
    category:    CONSTRAINT_CATEGORIES.POOL,
    severity:    SEVERITY.ERROR,
    autoDetect:  false,
    label:       'Teams must not share a pool',
    description: 'Director has specified these teams must not be in the same pool.',
    check({ teams, poolAssignments }) {
      const violations = []

      for (const team of teams) {
        const noPoolWith = team.constraints?.no_same_pool_as ?? []
        for (const otherTeamId of noPoolWith) {
          const other = teams.find(t => t.id === otherTeamId)
          if (!other) continue
          if (poolAssignments[team.id] && poolAssignments[team.id] === poolAssignments[other.id]) {
            violations.push({
              constraintId: 'manual_no_same_pool',
              severity:     SEVERITY.ERROR,
              teamIds:      [team.id, other.id],
              poolId:       poolAssignments[team.id],
              matchIds:     [],
              message:      `${team.name} and ${other.name} are in the same pool but have a no-pool constraint`,
              suggestion:   'Move one team to a different pool',
              autoFixable:  false,
            })
          }
        }
      }
      return violations
    },
  },

  {
    id:          'must_play_in_pool',
    category:    CONSTRAINT_CATEGORIES.POOL,
    severity:    SEVERITY.INFO,
    autoDetect:  false,
    label:       'Teams must play each other in pool play',
    description: 'Director has requested these teams be in the same pool.',
    check({ teams, poolAssignments }) {
      const violations = []

      for (const team of teams) {
        const mustPlayWith = team.constraints?.must_same_pool_as ?? []
        for (const otherTeamId of mustPlayWith) {
          const other = teams.find(t => t.id === otherTeamId)
          if (!other) continue
          if (poolAssignments[team.id] && poolAssignments[other.id] &&
              poolAssignments[team.id] !== poolAssignments[other.id]) {
            violations.push({
              constraintId: 'must_play_in_pool',
              severity:     SEVERITY.WARNING,
              teamIds:      [team.id, other.id],
              poolId:       null,
              matchIds:     [],
              message:      `${team.name} and ${other.name} are requested to be in the same pool but are in different pools`,
              suggestion:   'Move one team to match the other pool',
              autoFixable:  false,
            })
          }
        }
      }
      return violations
    },
  },

  // -- Schedule constraints -----------------------------------------------------

  {
    id:          'team_not_before',
    category:    CONSTRAINT_CATEGORIES.SCHEDULE,
    severity:    SEVERITY.WARNING,
    autoDetect:  false,
    label:       'Team cannot play before a certain time',
    description: 'A team has a late-arrival constraint and cannot play early games.',
    check({ teams, matches, slots }) {
      const violations = []
      const slotMap = Object.fromEntries((slots ?? []).map(s => [s.id, s]))

      for (const team of teams) {
        const notBefore = team.constraints?.not_before
        if (!notBefore) continue

        const teamMatches = (matches ?? []).filter(m =>
          (m.team_a_id === team.id || m.team_b_id === team.id) && m.slot_id
        )

        for (const match of teamMatches) {
          const slot = slotMap[match.slot_id]
          if (!slot) continue
          const gameTime = timeOfDay(slot.scheduled_start)
          if (gameTime < notBefore) {
            violations.push({
              constraintId: 'team_not_before',
              severity:     SEVERITY.WARNING,
              teamIds:      [team.id],
              matchIds:     [match.id],
              poolId:       null,
              message:      `${team.name} is scheduled at ${gameTime} but cannot play before ${notBefore}`,
              suggestion:   'Move this game to a later time slot',
              autoFixable:  false,
            })
          }
        }
      }
      return violations
    },
  },

  {
    id:          'team_not_after',
    category:    CONSTRAINT_CATEGORIES.SCHEDULE,
    severity:    SEVERITY.WARNING,
    autoDetect:  false,
    label:       'Team cannot play after a certain time',
    description: 'A team has an early-departure constraint.',
    check({ teams, matches, slots }) {
      const violations = []
      const slotMap = Object.fromEntries((slots ?? []).map(s => [s.id, s]))

      for (const team of teams) {
        const notAfter = team.constraints?.not_after
        if (!notAfter) continue

        const teamMatches = (matches ?? []).filter(m =>
          (m.team_a_id === team.id || m.team_b_id === team.id) && m.slot_id
        )

        for (const match of teamMatches) {
          const slot = slotMap[match.slot_id]
          if (!slot) continue
          const gameEnd = timeOfDay(slot.scheduled_end)
          if (gameEnd > notAfter) {
            violations.push({
              constraintId: 'team_not_after',
              severity:     SEVERITY.WARNING,
              teamIds:      [team.id],
              matchIds:     [match.id],
              poolId:       null,
              message:      `${team.name} finishes at ${gameEnd} but cannot play after ${notAfter}`,
              suggestion:   'Move this game to an earlier time slot',
              autoFixable:  false,
            })
          }
        }
      }
      return violations
    },
  },

  {
    id:          'team_unavailable_window',
    category:    CONSTRAINT_CATEGORIES.SCHEDULE,
    severity:    SEVERITY.ERROR,
    autoDetect:  false,
    label:       'Team unavailable during window',
    description: 'A team has a blackout window (e.g. religious observance, long drive).',
    check({ teams, matches, slots }) {
      const violations = []
      const slotMap = Object.fromEntries((slots ?? []).map(s => [s.id, s]))

      for (const team of teams) {
        const windows = team.constraints?.unavailable_windows ?? []
        if (windows.length === 0) continue

        const teamMatches = (matches ?? []).filter(m =>
          (m.team_a_id === team.id || m.team_b_id === team.id) && m.slot_id
        )

        for (const match of teamMatches) {
          const slot = slotMap[match.slot_id]
          if (!slot) continue
          const gameStart = timeOfDay(slot.scheduled_start)
          const gameEnd   = timeOfDay(slot.scheduled_end)

          for (const window of windows) {
            if (timesOverlap(gameStart, gameEnd, window.start, window.end)) {
              violations.push({
                constraintId: 'team_unavailable_window',
                severity:     SEVERITY.ERROR,
                teamIds:      [team.id],
                matchIds:     [match.id],
                poolId:       null,
                message:      `${team.name} is scheduled during their unavailable window (${window.start}-${window.end}${window.label ? ': ' + window.label : ''})`,
                suggestion:   'Reschedule this game outside the unavailable window',
                autoFixable:  false,
              })
            }
          }
        }
      }
      return violations
    },
  },

  {
    id:          'insufficient_rest',
    category:    CONSTRAINT_CATEGORIES.SCHEDULE,
    severity:    SEVERITY.WARNING,
    autoDetect:  true,
    label:       'Insufficient rest between games',
    description: 'A team has less than the minimum rest time between consecutive games.',
    check({ teams, matches, slots, config }) {
      const violations  = []
      const slotMap     = Object.fromEntries((slots ?? []).map(s => [s.id, s]))
      const minRest     = (config?.minRestBetweenTeamGames ?? 90) * 60 * 1000

      for (const team of teams) {
        const teamMatches = (matches ?? [])
          .filter(m => (m.team_a_id === team.id || m.team_b_id === team.id) && m.slot_id)
          .filter(m => slotMap[m.slot_id])
          .sort((a, b) =>
            new Date(slotMap[a.slot_id].scheduled_start) - new Date(slotMap[b.slot_id].scheduled_start)
          )

        for (let i = 1; i < teamMatches.length; i++) {
          const prev    = new Date(slotMap[teamMatches[i - 1].slot_id].scheduled_end).getTime()
          const next    = new Date(slotMap[teamMatches[i].slot_id].scheduled_start).getTime()
          const restMs  = next - prev
          const restMin = Math.round(restMs / 60000)

          if (restMs < minRest) {
            violations.push({
              constraintId: 'insufficient_rest',
              severity:     restMin < 30 ? SEVERITY.ERROR : SEVERITY.WARNING,
              teamIds:      [team.id],
              matchIds:     [teamMatches[i - 1].id, teamMatches[i].id],
              poolId:       null,
              message:      `${team.name} has only ${restMin} min rest between games (minimum ${config?.minRestBetweenTeamGames ?? 90} min)`,
              suggestion:   'Swap one of these games to a later time slot',
              autoFixable:  false,
            })
          }
        }
      }
      return violations
    },
  },

  {
    id:          'coach_conflict',
    category:    CONSTRAINT_CATEGORIES.ROSTER,
    severity:    SEVERITY.WARNING,
    autoDetect:  true,
    label:       'Coach managing multiple teams at same time',
    description: 'The same coach email appears on two teams scheduled at the same time.',
    check({ teams, matches, slots }) {
      const violations = []
      const slotMap    = Object.fromEntries((slots ?? []).map(s => [s.id, s]))

      // Group teams by coach email
      const byCoach = groupBy(
        teams.filter(t => t.headCoachEmail?.trim()),
        t => t.headCoachEmail.trim().toLowerCase()
      )

      for (const [email, coachTeams] of Object.entries(byCoach)) {
        if (coachTeams.length < 2) continue

        // Find simultaneous matches
        const coachMatches = coachTeams.flatMap(team =>
          (matches ?? [])
            .filter(m => (m.team_a_id === team.id || m.team_b_id === team.id) && m.slot_id)
            .map(m => ({ ...m, teamId: team.id, teamName: team.name }))
        )

        // Check for time overlaps
        for (let i = 0; i < coachMatches.length; i++) {
          for (let j = i + 1; j < coachMatches.length; j++) {
            const a = coachMatches[i]
            const b = coachMatches[j]
            if (a.teamId === b.teamId) continue

            const slotA = slotMap[a.slot_id]
            const slotB = slotMap[b.slot_id]
            if (!slotA || !slotB) continue

            if (timesOverlap(
              timeOfDay(slotA.scheduled_start), timeOfDay(slotA.scheduled_end),
              timeOfDay(slotB.scheduled_start), timeOfDay(slotB.scheduled_end)
            )) {
              violations.push({
                constraintId: 'coach_conflict',
                severity:     SEVERITY.WARNING,
                teamIds:      [a.teamId, b.teamId],
                matchIds:     [a.id, b.id],
                poolId:       null,
                message:      `Coach (${email}) has ${a.teamName} and ${b.teamName} playing at the same time`,
                suggestion:   'Reschedule one game to a different time slot',
                autoFixable:  false,
              })
            }
          }
        }
      }
      return violations
    },
  },

  {
    id:          'unscheduled_game',
    category:    CONSTRAINT_CATEGORIES.SCHEDULE,
    severity:    SEVERITY.ERROR,
    autoDetect:  true,
    label:       'Game could not be scheduled',
    description: 'Not enough time slots to fit all games.',
    check({ matches }) {
      return (matches ?? [])
        .filter(m => !m.slot_id && !m.is_bye)
        .map(m => ({
          constraintId: 'unscheduled_game',
          severity:     SEVERITY.ERROR,
          teamIds:      [m.team_a_id, m.team_b_id].filter(Boolean),
          matchIds:     [m.id],
          poolId:       m.pool_id,
          message:      'A game could not be scheduled -- not enough available time slots',
          suggestion:   'Extend the day, add more fields, or reduce game duration',
          autoFixable:  false,
        }))
    },
  },
]

// -----------------------------------------------------------------------------
// EVALUATOR
// Runs all registered constraints against current state.
// Returns a deduplicated, sorted list of violations.
// -----------------------------------------------------------------------------

/**
 * Evaluate all constraints against the current tournament state.
 *
 * @param {Object} ctx
 * @param {Array}  ctx.teams           - All tournament teams (with constraints JSONB)
 * @param {Array}  ctx.pools           - All pools
 * @param {Object} ctx.poolAssignments - { teamId: poolId }
 * @param {Array}  ctx.matches         - Generated matches (may be empty pre-schedule)
 * @param {Array}  ctx.slots           - Generated time slots
 * @param {Object} ctx.config          - Schedule config (minRestBetweenTeamGames, etc.)
 * @param {Array}  ctx.constraintIds   - Optional: only run these constraint IDs
 * @returns {Array} violations
 */
export function evaluateConstraints(ctx, constraintIds = null) {
  const violations = []
  const toRun = constraintIds
    ? CONSTRAINT_REGISTRY.filter(c => constraintIds.includes(c.id))
    : CONSTRAINT_REGISTRY

  for (const constraint of toRun) {
    try {
      const found = constraint.check(ctx)
      violations.push(...found)
    } catch (err) {
      console.warn('[constraintEngine] Error in constraint', constraint.id, err)
    }
  }

  // Deduplicate by matching teamIds + constraintId
  const seen = new Set()
  const deduped = violations.filter(v => {
    const key = v.constraintId + ':' + [...v.teamIds].sort().join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort: errors first, then warnings, then info
  const order = { error: 0, warning: 1, info: 2 }
  return deduped.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
}

/**
 * Run only pool-phase constraints (before schedule generation).
 */
export function evaluatePoolConstraints(ctx) {
  return evaluateConstraints(ctx,
    CONSTRAINT_REGISTRY
      .filter(c => c.category === CONSTRAINT_CATEGORIES.POOL)
      .map(c => c.id)
  )
}

/**
 * Run only schedule-phase constraints (after schedule generation).
 */
export function evaluateScheduleConstraints(ctx) {
  return evaluateConstraints(ctx,
    CONSTRAINT_REGISTRY
      .filter(c => c.category === CONSTRAINT_CATEGORIES.SCHEDULE || c.category === CONSTRAINT_CATEGORIES.ROSTER)
      .map(c => c.id)
  )
}

/**
 * Auto-detect constraints that don't require director input.
 * Safe to run anytime teams/pools change.
 */
export function autoDetect(ctx) {
  return evaluateConstraints(ctx,
    CONSTRAINT_REGISTRY.filter(c => c.autoDetect).map(c => c.id)
  )
}

// -----------------------------------------------------------------------------
// CONSTRAINT BUILDER
// Helper to build a team's constraints object from UI input.
// -----------------------------------------------------------------------------

export function buildConstraints({
  noSamePoolAs         = [],
  mustSamePoolAs       = [],
  noPlayAgainst        = [],
  mustPlayAgainst      = [],
  notBefore            = null,
  notAfter             = null,
  unavailableWindows   = [],
  noFirstGame          = false,
  noLastGame           = false,
  preferredFields      = [],
  avoidedFields        = [],
  notes                = '',
} = {}) {
  const c = {}
  if (noSamePoolAs.length)       c.no_same_pool_as       = noSamePoolAs
  if (mustSamePoolAs.length)     c.must_same_pool_as     = mustSamePoolAs
  if (noPlayAgainst.length)      c.no_play_against       = noPlayAgainst
  if (mustPlayAgainst.length)    c.must_play_against     = mustPlayAgainst
  if (notBefore)                 c.not_before            = notBefore
  if (notAfter)                  c.not_after             = notAfter
  if (unavailableWindows.length) c.unavailable_windows   = unavailableWindows
  if (noFirstGame)               c.no_first_game         = true
  if (noLastGame)                c.no_last_game          = true
  if (preferredFields.length)    c.preferred_fields      = preferredFields
  if (avoidedFields.length)      c.avoided_fields        = avoidedFields
  if (notes)                     c.notes                 = notes
  return c
}

/**
 * Parse a team's constraints JSONB into the UI-friendly shape.
 */
export function parseConstraints(raw = {}) {
  return {
    noSamePoolAs:       raw.no_same_pool_as       ?? [],
    mustSamePoolAs:     raw.must_same_pool_as      ?? [],
    noPlayAgainst:      raw.no_play_against        ?? [],
    mustPlayAgainst:    raw.must_play_against      ?? [],
    notBefore:          raw.not_before             ?? null,
    notAfter:           raw.not_after              ?? null,
    unavailableWindows: raw.unavailable_windows    ?? [],
    noFirstGame:        raw.no_first_game          ?? false,
    noLastGame:         raw.no_last_game           ?? false,
    preferredFields:    raw.preferred_fields       ?? [],
    avoidedFields:      raw.avoided_fields         ?? [],
    notes:              raw.notes                  ?? '',
  }
}

// -----------------------------------------------------------------------------
// CONSTRAINT REGISTRY INTROSPECTION
// -----------------------------------------------------------------------------

export function getConstraintRegistry() {
  return CONSTRAINT_REGISTRY.map(({ id, category, severity, autoDetect, label, description }) => ({
    id, category, severity, autoDetect, label, description,
  }))
}

export function getConstraintById(id) {
  return CONSTRAINT_REGISTRY.find(c => c.id === id)
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

/** Extract HH:MM from an ISO datetime string */
function timeOfDay(isoString) {
  if (!isoString) return '00:00'
  const d = new Date(isoString)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

/** Check if two HH:MM time ranges overlap */
function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

/** Suggest moving one team from a pool to another to resolve a conflict */
function suggestPoolSwap(conflictingTeams, poolId, state) {
  const { pools, poolAssignments } = state
  const otherPools = pools.filter(p => p.id !== poolId)
  if (otherPools.length === 0) return null

  // Find the pool with the fewest teams
  const poolSizes = otherPools.map(p => ({
    pool: p,
    size: Object.values(poolAssignments).filter(id => id === p.id).length,
  }))
  poolSizes.sort((a, b) => a.size - b.size)

  const targetPool  = poolSizes[0].pool
  const teamToMove  = conflictingTeams[conflictingTeams.length - 1]

  return {
    ...poolAssignments,
    [teamToMove.id]: targetPool.id,
  }
}
