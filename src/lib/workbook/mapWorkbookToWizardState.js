import { useWizardStore } from '../../store/wizardStore'
import { toSlug } from './workbookDraftConfig'
import { validateSchedule } from '../scheduleGenerator'

function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`
}

export function applyWorkbookToWizardState(validatedResult) {
  const normalized = validatedResult?.validation?.normalized
  if (!normalized) {
    throw new Error('No validated workbook data found.')
  }

  const store = useWizardStore.getState()

  const tournamentRows = asArray(normalized.tournament)
  const divisionRows = asArray(normalized.divisions)
  const poolRows = asArray(normalized.pools)
  const teamRows = asArray(normalized.teams)
  const fieldRows = asArray(normalized.fields)
  const tournamentDayRows = asArray(normalized.tournamentDays)
  const rosterRows = asArray(normalized.rosters)
  const scheduleRows = asArray(normalized.schedules)

  const tournamentRow = tournamentRows[0] ?? null

  const existingDivisions = asArray(store.divisions)
  const existingVenues = asArray(store.venues)
  const existingPools = asArray(store.pools)
  const existingTeams = asArray(store.teams)

  const existingDivisionByName = Object.fromEntries(
    existingDivisions.map(div => [String(div.name ?? '').trim().toLowerCase(), div])
  )

  const existingVenueByName = Object.fromEntries(
    existingVenues.map(venue => [String(venue.name ?? '').trim().toLowerCase(), venue])
  )

  const existingPoolByDivisionAndName = Object.fromEntries(
    existingPools.map(pool => {
      const division = existingDivisions.find(div => div.id === pool.divisionId)
      const divisionName = division?.name ? String(division.name).trim().toLowerCase() : ''
      const poolName = pool?.name ? String(pool.name).trim().toLowerCase() : ''
      return [`${divisionName}::${poolName}`, pool]
    })
  )

  const existingTeamByDivisionAndName = Object.fromEntries(
    existingTeams.map(team => {
      const division = existingDivisions.find(div => div.id === team.divisionId)
      const divisionName = division?.name ? String(division.name).trim().toLowerCase() : ''
      const teamName = team?.name ? String(team.name).trim().toLowerCase() : ''
      return [`${divisionName}::${teamName}`, team]
    })
  )


  // --------------------------------------------------
  // 1. Tournament basics
  // --------------------------------------------------
  if (tournamentRow) {
    store.setFields({
      name: tournamentRow.tournament_name || '',
      slug: tournamentRow.slug || toSlug(tournamentRow.tournament_name || ''),
      startDate: tournamentRow.start_date || '',
      endDate: tournamentRow.end_date || '',
      timezone: tournamentRow.timezone || 'America/Toronto',
      venueName: tournamentRow.host_school || '',
      venueAddress: tournamentRow.location || '',
      primaryColor: tournamentRow.primary_color || '#8b5cf6',
    })
  }

  // --------------------------------------------------
  // 2. Divisions
  // --------------------------------------------------
  const divisions = divisionRows.map((row, index) => {
    const existingDivision =
      existingDivisionByName[String(row.division_name ?? '').trim().toLowerCase()] || null

    return {
      id: existingDivision?.id || makeId('div'),
      dbId: existingDivision?.dbId || null,
      name: row.division_name,
      slug: row.division_slug || existingDivision?.slug || toSlug(row.division_name),
      formatType: row.format_type,
      gameDurationMinutes: toNumberOrDefault(row.game_duration_minutes, 90),
      breakBetweenGamesMinutes: toNumberOrDefault(row.break_between_games_minutes, 30),
      teamsAdvancePerPool: toNumberOrDefault(row.teams_advance_per_pool, 2),
      thirdPlaceGame: parseBooleanLike(row.third_place_game) ?? false,
      consolationBracket: parseBooleanLike(row.consolation_bracket) ?? false,
      sortOrder: index,
      _expanded: false,
    }
  })

  store.setDivisions(divisions)

  const divisionIdByName = Object.fromEntries(
    divisions.map(div => [String(div.name).toLowerCase(), div.id])
  )

  // --------------------------------------------------
  // 3. Venues / fields
  // --------------------------------------------------
  const venues = fieldRows.map((row, index) => {
    const existingVenue =
      existingVenueByName[String(row.field_name ?? '').trim().toLowerCase()] || null

    return {
      id: existingVenue?.id || makeId('venue'),
      dbId: existingVenue?.dbId || null,
      name: row.field_name,
      shortName: row.short_name || existingVenue?.shortName || '',
      qrSlug: row.qr_slug || existingVenue?.qrSlug || toSlug(row.field_name),
      sortOrder: toNumberOrDefault(row.sort_order, index + 1),
    }
  })

  store.setVenues(venues)

  const venueIdByName = Object.fromEntries(
    venues.map(venue => [String(venue.name).toLowerCase(), venue.id])
  )

  // --------------------------------------------------
  // 4. Pools
  // --------------------------------------------------
  const pools = poolRows
    .map((row, index) => {
      const divisionName = String(row.division_name ?? '').trim().toLowerCase()
      const divisionId = divisionIdByName[divisionName]
      if (!divisionId) return null

      const existingPool =
        existingPoolByDivisionAndName[
          `${divisionName}::${String(row.pool_name ?? '').trim().toLowerCase()}`
        ] || null

      return {
        id: existingPool?.id || makeId('pool'),
        dbId: existingPool?.dbId || null,
        divisionId,
        name: row.pool_name,
        shortName: row.pool_short_name || existingPool?.shortName || '',
        sortOrder: toNumberOrDefault(row.sort_order, index),
      }
    })
    .filter(Boolean)

  store.setPools(pools)

  const poolIdByDivisionAndName = Object.fromEntries(
    pools.map(pool => [`${pool.divisionId}::${String(pool.name).toLowerCase()}`, pool.id])
  )

  // --------------------------------------------------
  // 5. Teams
  // --------------------------------------------------
  const teams = teamRows
    .map(row => {
      const divisionName = String(row.division_name ?? '').trim().toLowerCase()
      const divisionId = divisionIdByName[divisionName]
      if (!divisionId) return null

      const teamName = String(row.team_name ?? '').trim()
      const lookupKey = `${divisionName}::${teamName.toLowerCase()}`
      const existingTeam =
        existingTeamByDivisionAndName[lookupKey] || null

      return {
        id: existingTeam?.id || makeId('team'),
        dbId: existingTeam?.dbId || null,
        divisionId,
        name: teamName,
        shortName: row.short_name || existingTeam?.shortName || '',
        schoolName: row.school_name || existingTeam?.schoolName || existingTeam?.clubName || '',
        clubName: row.school_name || existingTeam?.clubName || existingTeam?.schoolName || '',
        seed: row.seed != null && row.seed !== '' ? Number(row.seed) : existingTeam?.seed ?? null,
        primaryColor: row.primary_color || existingTeam?.primaryColor || '',
        headCoachName: existingTeam?.headCoachName || '',
        headCoachEmail: existingTeam?.headCoachEmail || '',
        constraints: existingTeam?.constraints || {},
      }
    })
    .filter(Boolean)

  store.setTeams(teams)

  const teamIdByDivisionAndName = Object.fromEntries(
    teams.map(team => [`${team.divisionId}::${String(team.name).toLowerCase()}`, team.id])
  )

  // --------------------------------------------------
  // 6. Pool assignments
  // --------------------------------------------------
  const poolAssignments = {}

  teamRows.forEach(row => {
    const divisionId = divisionIdByName[String(row.division_name ?? '').toLowerCase()]
    if (!divisionId) return

    const teamId =
      teamIdByDivisionAndName[
        `${divisionId}::${String(row.team_name ?? '').toLowerCase()}`
      ]
    if (!teamId) return

    if (row.pool_name) {
      const poolId =
        poolIdByDivisionAndName[
          `${divisionId}::${String(row.pool_name).toLowerCase()}`
        ]
      if (poolId) {
        poolAssignments[teamId] = poolId
      }
    }
  })

  store.setPoolAssignments(poolAssignments)

  // --------------------------------------------------
  // 7. Tournament days
  // --------------------------------------------------
  const tournamentDays = tournamentDayRows.map(row => ({
    id: makeId('day'),
    dayIndex: toNumberOrDefault(row.day_index, 1),
    eventDate: row.event_date || '',
    startTime: row.start_time || '09:00',
    endTime: row.end_time || '',
    label: row.label || '',
  }))

  store.setTournamentDays(tournamentDays)

  // --------------------------------------------------
  // 8. Rosters
  // --------------------------------------------------
  const rosters = rosterRows
    .map(row => {
      const divisionId = divisionIdByName[String(row.division_name ?? '').toLowerCase()]
      if (!divisionId) return null

      const teamId =
        teamIdByDivisionAndName[
          `${divisionId}::${String(row.team_name ?? '').toLowerCase()}`
        ]

      if (!teamId) return null

      return {
        id: makeId('roster'),
        teamId,
        divisionId,
        firstName: row.player_first_name || '',
        lastName: row.player_last_name || '',
        jerseyNumber: row.jersey_number || '',
        role: row.role || '',
        captain: parseBooleanLike(row.captain) ?? false,
        grade: row.grade || '',
        eligibilityNotes: row.eligibility_notes || '',
      }
    })
    .filter(Boolean)

  store.setRosters(rosters)

  // --------------------------------------------------
  // 9. Schedule rows -> generated schedule state
  // --------------------------------------------------
  const scheduleApplyResult = applyWorkbookSchedulesToGeneratedState({
    scheduleRows,
    currentMatches: asArray(store.generatedMatches),
    currentSlots: asArray(store.generatedSlots),
    venues,
    gameDurationMinutes: store.scheduleConfig?.gameDurationMinutes ?? 90,
  })

  if (scheduleApplyResult.applied) {
    const minRestMinutes = store.scheduleConfig?.minRestBetweenTeamGames ?? 90

    const conflicts = validateSchedule(
      scheduleApplyResult.matches,
      scheduleApplyResult.slots,
      minRestMinutes
    )

    store.setGeneratedSchedule({
      matches: scheduleApplyResult.matches,
      slots: scheduleApplyResult.slots,
      conflicts,
    })
  }

  return {
    divisions,
    venues,
    pools,
    teams,
    poolAssignments,
    tournamentDays,
    rosters,
    schedules: scheduleApplyResult.matches,
    summary: {
      tournamentLoaded: !!tournamentRow,
      divisionCount: divisions.length,
      venueCount: venues.length,
      poolCount: pools.length,
      teamCount: teams.length,
      tournamentDayCount: tournamentDays.length,
      rosterCount: rosters.length,
      scheduleRowCount: scheduleRows.length,
      scheduleApplied: scheduleApplyResult.applied,
      scheduleAppliedCount: scheduleApplyResult.appliedCount,
    },
  }
}

function applyWorkbookSchedulesToGeneratedState({
  scheduleRows,
  currentMatches,
  currentSlots,
  venues,
  gameDurationMinutes,
}) {
  if (!Array.isArray(scheduleRows) || scheduleRows.length === 0) {
    return {
      applied: false,
      appliedCount: 0,
      matches: currentMatches ?? [],
      slots: currentSlots ?? [],
    }
  }

  if (!Array.isArray(currentMatches) || currentMatches.length === 0) {
    return {
      applied: false,
      appliedCount: 0,
      matches: [],
      slots: currentSlots ?? [],
    }
  }

  const matches = [...currentMatches]
  const slots = [...(currentSlots ?? [])]
  const venueIdByName = Object.fromEntries(
    (venues ?? []).map(venue => [String(venue.name).toLowerCase(), venue.id])
  )

  const matchById = Object.fromEntries(
    matches.map(match => [String(match.id), match])
  )

  const matchByCode = Object.fromEntries(
    matches.map((match, index) => [buildMatchCode(match, index), match])
  )

  let appliedCount = 0

  scheduleRows.forEach(row => {
    const rowMatch =
      (row.match_id && matchById[String(row.match_id)]) ||
      (row.match_code && matchByCode[String(row.match_code)]) ||
      null

    if (!rowMatch) return

    const isUnscheduled =
      !row.scheduled_date && !row.start_time && !row.field_name

    if (isUnscheduled) {
      rowMatch.slot_id = null
      rowMatch.venue_id = null
      rowMatch.slotId = null
      rowMatch.venueId = null
      appliedCount++
      return
    }

    const venueId = venueIdByName[String(row.field_name || '').toLowerCase()] || null
    const slotId = upsertGeneratedSlot({
      slots,
      scheduledDate: row.scheduled_date,
      startTime: row.start_time,
      venueId,
      gameDurationMinutes,
    })

    rowMatch.slot_id = slotId
    rowMatch.venue_id = venueId
    rowMatch.slotId = slotId
    rowMatch.venueId = venueId
    appliedCount++
  })

  return {
    applied: appliedCount > 0,
    appliedCount,
    matches,
    slots,
  }
}

function upsertGeneratedSlot({
  slots,
  scheduledDate,
  startTime,
  venueId,
  gameDurationMinutes,
}) {
  const startIso = `${scheduledDate}T${startTime}:00`

  const existing = slots.find(
    slot =>
      String(slot.scheduled_start).slice(0, 16) === startIso.slice(0, 16) &&
      String(slot.venue_id) === String(venueId)
  )

  if (existing) return existing.id

  const end = new Date(startIso)
  end.setMinutes(end.getMinutes() + (gameDurationMinutes || 90))

  const slot = {
    id: makeId('slot'),
    venue_id: venueId,
    scheduled_start: startIso,
    scheduled_end: end.toISOString().slice(0, 19),
  }

  slots.push(slot)
  return slot.id
}

function buildMatchCode(match, index) {
  if (match.matchCode) return String(match.matchCode)
  if (match.match_code) return String(match.match_code)

  if (match.round && match.match_number) {
    return `R${match.round}-M${match.match_number}`
  }

  if (match.match_number) {
    return `M${match.match_number}`
  }

  return `MATCH-${index + 1}`
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumberOrDefault(value, fallback) {
  if (value == null || value === '') return fallback
  const num = Number(value)
  return Number.isNaN(num) ? fallback : num
}

function parseBooleanLike(value) {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true
  if (['false', 'no', 'n', '0'].includes(normalized)) return false

  return null
}