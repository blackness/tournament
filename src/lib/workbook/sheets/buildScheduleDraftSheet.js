import { addStyledHeaderRow, autoSizeColumns } from './sheetUtils.js'
import { WORKBOOK_SCHEDULE_DRAFT_LEVELS } from '../workbookDraftConfig.js'

export function buildScheduleDraftSheet(workbook, config, derived) {
  const ws = workbook.addWorksheet('ScheduleDraft')

  addStyledHeaderRow(ws, [
    'division_name',
    'day_index',
    'scheduled_start',
    'field_name',
    'phase',
    'round',
    'pool_name',
    'match_label',
    'team_a_name',
    'team_b_name',
    'notes',
  ])

  if (config.workbookOptions.scheduleDraftLevel === WORKBOOK_SCHEDULE_DRAFT_LEVELS.TIME_SLOTS) {
    buildTimeSlotDraftRows(ws, config, derived)
  } else {
    buildMatchScaffoldRows(ws, config, derived)
  }

  autoSizeColumns(ws, 14, 28)
}

function buildTimeSlotDraftRows(ws, config, derived) {
  const slots = buildTimeSlots(config)

  derived.tournamentDays.forEach(day => {
    slots.forEach(time => {
      derived.fields.forEach(field => {
        ws.addRow([
          '',
          day.dayIndex,
          `${day.eventDate ? `${day.eventDate} ` : ''}${time}`,
          field.fieldName,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ])
      })
    })
  })
}

function buildMatchScaffoldRows(ws, config, derived) {
  derived.divisions.forEach(division => {
    const rows = buildDivisionMatchScaffold(division)

    rows.forEach((row, index) => {
      const day = derived.tournamentDays[0]
      const field = derived.fields[index % Math.max(derived.fields.length, 1)]
      ws.addRow([
        division.name,
        day?.dayIndex ?? 1,
        day?.eventDate ? `${day.eventDate} ${day.startTime}` : '',
        field?.fieldName ?? '',
        row.phase,
        row.round,
        row.poolName,
        row.matchLabel,
        '',
        '',
        '',
      ])
    })
  })
}

function buildTimeSlots(config) {
  const {
    dayStartTime = '09:00',
    dayEndTime = '17:00',
    gameDurationMinutes = 90,
    breakBetweenGamesMinutes = 30,
  } = config.scheduleDefaults

  const slots = []
  let current = toMinutes(dayStartTime)
  const end = toMinutes(dayEndTime)
  const step = Number(gameDurationMinutes) + Number(breakBetweenGamesMinutes)

  while (current + Number(gameDurationMinutes) <= end) {
    slots.push(toTimeString(current))
    current += step
  }

  return slots
}

function buildDivisionMatchScaffold(division) {
  switch (division.formatType) {
    case 'round_robin':
      return buildRoundRobinScaffold(division)

    case 'pool_to_bracket':
    case 'pool_to_placement':
    case 'crossover_pools':
      return buildPoolBasedScaffold(division)

    case 'single_elimination':
      return buildSingleElimScaffold(division)

    default:
      return [
        {
          phase: '',
          round: '',
          poolName: '',
          matchLabel: `${division.name} Match 1`,
        },
      ]
  }
}

function buildRoundRobinScaffold(division) {
  const approximateGames = Math.floor((division.teamCount * (division.teamCount - 1)) / 2)
  return Array.from({ length: approximateGames }).map((_, index) => ({
    phase: 'round_robin',
    round: '',
    poolName: '',
    matchLabel: `Round Robin Match ${index + 1}`,
  }))
}

function buildPoolBasedScaffold(division) {
  const rows = []
  const poolCount = Number(division.poolCount || 0)

  for (let poolIndex = 0; poolIndex < poolCount; poolIndex++) {
    const letter = String.fromCharCode(65 + poolIndex)
    rows.push({
      phase: 'pool',
      round: 1,
      poolName: `Pool ${letter}`,
      matchLabel: `Pool ${letter} Round 1`,
    })
    rows.push({
      phase: 'pool',
      round: 2,
      poolName: `Pool ${letter}`,
      matchLabel: `Pool ${letter} Round 2`,
    })
  }

  rows.push({
    phase: 'championship',
    round: 1,
    poolName: '',
    matchLabel: 'Semi 1',
  })
  rows.push({
    phase: 'championship',
    round: 1,
    poolName: '',
    matchLabel: 'Semi 2',
  })

  if (division.thirdPlaceGame) {
    rows.push({
      phase: 'placement',
      round: 2,
      poolName: '',
      matchLabel: 'Bronze',
    })
  }

  rows.push({
    phase: 'championship',
    round: 2,
    poolName: '',
    matchLabel: 'Gold',
  })

  return rows
}

function buildSingleElimScaffold(division) {
  const rows = []
  const teamCount = Number(division.teamCount || 0)

  if (teamCount >= 8) {
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Quarter-final 1' })
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Quarter-final 2' })
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Quarter-final 3' })
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Quarter-final 4' })
    rows.push({ phase: 'championship', round: 2, poolName: '', matchLabel: 'Semi 1' })
    rows.push({ phase: 'championship', round: 2, poolName: '', matchLabel: 'Semi 2' })
  } else {
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Semi 1' })
    rows.push({ phase: 'championship', round: 1, poolName: '', matchLabel: 'Semi 2' })
  }

  if (division.thirdPlaceGame) {
    rows.push({ phase: 'placement', round: 3, poolName: '', matchLabel: 'Bronze' })
  }

  rows.push({ phase: 'championship', round: 3, poolName: '', matchLabel: 'Gold' })

  return rows
}

function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number)
  return h * 60 + m
}

function toTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}