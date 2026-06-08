import { FORMAT_TYPES } from '../constants.js'
import { toSlug } from './workbookDraftConfig.js'

function makeTournament(name, startDate = '2026-05-22', numberOfDays = 2) {
  return {
    tournament: {
      name,
      slug: toSlug(name),
      timezone: 'America/Toronto',
      startDate,
      endDate: addDays(startDate, numberOfDays - 1),
      hostSchool: 'Sample Host School',
      location: 'Sample City, ON',
      primaryColor: '#1a56db',
    },
    scheduleDefaults: {
      numberOfDays,
      fieldsCount: 4,
      dayStartTime: '09:00',
      dayEndTime: '17:00',
      gameDurationMinutes: 90,
      breakBetweenGamesMinutes: 30,
    },
    workbookOptions: {
      includePools: true,
      includeRosters: true,
      includeScheduleDraft: false,
      scheduleDraftLevel: 'time_slots',
      teamRowStyle: 'seeded_placeholder',
      autoAssignPoolsEvenly: true,
      templateType: 'simple',
    },
    fields: [
      { fieldName: 'Field 1', shortName: 'F1', qrSlug: 'field-1', sortOrder: 1 },
      { fieldName: 'Field 2', shortName: 'F2', qrSlug: 'field-2', sortOrder: 2 },
      { fieldName: 'Field 3', shortName: 'F3', qrSlug: 'field-3', sortOrder: 3 },
      { fieldName: 'Field 4', shortName: 'F4', qrSlug: 'field-4', sortOrder: 4 },
    ],
    tournamentDays: buildTournamentDays(startDate, numberOfDays),
    divisions: [],
    schedules: [],
  }
}

function buildTournamentDays(startDate, numberOfDays) {
  return Array.from({ length: numberOfDays }).map((_, index) => ({
    dayIndex: index + 1,
    eventDate: addDays(startDate, index),
    startTime: '09:00',
    endTime: '17:00',
    label: `Day ${index + 1}`,
  }))
}

function addDays(dateString, daysToAdd) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString().slice(0, 10)
}

function buildSeededTeams(count, prefix = 'Team') {
  return Array.from({ length: count }).map((_, index) => ({
    name: `${prefix} ${index + 1}`,
    shortName: `T${index + 1}`,
    schoolName: `${prefix} School ${index + 1}`,
    primaryColor: '',
    seed: index + 1,
  }))
}

function buildPools(count) {
  return Array.from({ length: count }).map((_, index) => {
    const letter = String.fromCharCode(65 + index)
    return {
      name: `Pool ${letter}`,
      shortName: letter,
      sortOrder: index + 1,
    }
  })
}

function assignTeamsToPoolsEvenly(teams, pools) {
  return teams.map((team, index) => ({
    ...team,
    poolName: pools[index % pools.length]?.name || '',
  }))
}

function makeDivision({
  name,
  formatType,
  teamCount,
  poolCount = 0,
  teamsAdvancePerPool = 2,
  thirdPlaceGame = false,
  consolationBracket = false,
  gameDurationMinutes = 90,
  breakBetweenGamesMinutes = 30,
  prefix,
}) {
  const pools = poolCount > 0 ? buildPools(poolCount) : []
  const teams = buildSeededTeams(teamCount, prefix || name)

  return {
    name,
    slug: toSlug(name),
    formatType,
    teamCount,
    poolCount,
    teamsAdvancePerPool,
    thirdPlaceGame,
    consolationBracket,
    gameDurationMinutes,
    breakBetweenGamesMinutes,
    sortOrder: 0,
    pools,
    teams: pools.length > 0 ? assignTeamsToPoolsEvenly(teams, pools) : teams,
  }
}

export const WORKBOOK_PRESET_6_TEAM_2_POOL_SEMIS = {
  key: '6-team-2-pool-semis',
  fileName: '6-team-2-pool-semis.xlsx',
  config: (() => {
    const base = makeTournament('6 Team - 2 Pool Semis')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 6,
        poolCount: 2,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: false,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_8_TEAM_2_POOL_SEMIS = {
  key: '8-team-2-pool-semis',
  label: '8 Team - 2 Pool Semis',
  fileName: '8-team-2-pool-semis.xlsx',
  config: (() => {
    const base = makeTournament('8 Team - 2 Pool Semis')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 8,
        poolCount: 2,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_8_TEAM_2_POOL_QUARTERS = {
  key: '8-team-2-pool-quarters',
  fileName: '8-team-2-pool-quarters.xlsx',
  config: (() => {
    const base = makeTournament('8 Team - 2 Pool Quarters')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 8,
        poolCount: 2,
        teamsAdvancePerPool: 4,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_10_TEAM_2_POOL_SEMIS = {
  key: '10-team-2-pool-semis',
  fileName: '10-team-2-pool-semis.xlsx',
  config: (() => {
    const base = makeTournament('10 Team - 2 Pool Semis')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 10,
        poolCount: 2,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_12_TEAM_4_POOL_QUARTERS = {
  key: '12-team-4-pool-quarters',
  fileName: '12-team-4-pool-quarters.xlsx',
  config: (() => {
    const base = makeTournament('12 Team - 4 Pool Quarters')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 12,
        poolCount: 4,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_16_TEAM_4_POOL_QUARTERS = {
  key: '16-team-4-pool-quarters',
  fileName: '16-team-4-pool-quarters.xlsx',
  config: (() => {
    const base = makeTournament('16 Team - 4 Pool Quarters')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.POOL_TO_BRACKET,
        teamCount: 16,
        poolCount: 4,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_SINGLE_ELIM_BRONZE_8 = {
  key: 'single-elim-bronze-8',
  fileName: 'single-elim-bronze-8.xlsx',
  config: (() => {
    const base = makeTournament('8 Team - Single Elim Bronze')
    base.workbookOptions.includePools = false
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.SINGLE_ELIMINATION_BRONZE,
        teamCount: 8,
        poolCount: 0,
        teamsAdvancePerPool: 0,
        thirdPlaceGame: true,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_DOUBLE_ELIM_8 = {
  key: 'double-elim-8',
  fileName: 'double-elim-8.xlsx',
  config: (() => {
    const base = makeTournament('8 Team - Double Elim')
    base.workbookOptions.includePools = false
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.DOUBLE_ELIMINATION,
        teamCount: 8,
        poolCount: 0,
        teamsAdvancePerPool: 0,
        thirdPlaceGame: false,
        prefix: 'Open',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESET_OFSAA_16_FULL_CLASSIFICATION = {
  key: 'ofsaa-16-full-classification',
  fileName: 'ofsaa-16-full-classification.xlsx',
  config: (() => {
    const base = makeTournament('OFSAA 16 Team Full Classification')
    base.divisions = [
      makeDivision({
        name: 'Open',
        formatType: FORMAT_TYPES.OFSAA_FULL_CLASSIFICATION,
        teamCount: 16,
        poolCount: 4,
        teamsAdvancePerPool: 2,
        thirdPlaceGame: false,
        consolationBracket: true,
        prefix: 'OFSAA',
      }),
    ]
    return base
  })(),
}

export const WORKBOOK_PRESETS = [
  WORKBOOK_PRESET_6_TEAM_2_POOL_SEMIS,
  WORKBOOK_PRESET_8_TEAM_2_POOL_SEMIS,
  WORKBOOK_PRESET_8_TEAM_2_POOL_QUARTERS,
  WORKBOOK_PRESET_10_TEAM_2_POOL_SEMIS,
  WORKBOOK_PRESET_12_TEAM_4_POOL_QUARTERS,
  WORKBOOK_PRESET_16_TEAM_4_POOL_QUARTERS,
  WORKBOOK_PRESET_SINGLE_ELIM_BRONZE_8,
  WORKBOOK_PRESET_DOUBLE_ELIM_8,
  WORKBOOK_PRESET_OFSAA_16_FULL_CLASSIFICATION,
]
export const SAMPLE_WORKBOOK_PRESETS = WORKBOOK_PRESETS