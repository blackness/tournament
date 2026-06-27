import { toSlug } from '../workbook/workbookDraftConfig'

function toNumberOrDefault(value, fallback) {
  if (value == null || value === '') return fallback
  const num = Number(value)
  return Number.isNaN(num) ? fallback : num
}

function parseBooleanLike(value, fallback = false) {
  if (value == null || value === '') return fallback
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true
  if (['false', 'no', 'n', '0'].includes(normalized)) return false

  return fallback
}

export function normalizeDivisionInput(raw = {}, index = 0) {
  const name =
    raw.name ||
    raw.division_name ||
    raw.divisionName ||
    ''

  const formatType =
    raw.formatType ||
    raw.format_type ||
    ''

  return {
    id: raw.id || `div_${crypto.randomUUID()}`,
    dbId: raw.dbId || raw.db_id || null,
    name,
    slug:
      raw.slug ||
      raw.division_slug ||
      (name ? toSlug(name) : ''),
    formatType,
    gameDurationMinutes: toNumberOrDefault(
      raw.gameDurationMinutes ?? raw.game_duration_minutes,
      90
    ),
    breakBetweenGamesMinutes: toNumberOrDefault(
      raw.breakBetweenGamesMinutes ?? raw.break_between_games_minutes,
      30
    ),
    teamsAdvancePerPool: toNumberOrDefault(
      raw.teamsAdvancePerPool ?? raw.teams_advance_per_pool,
      2
    ),
    thirdPlaceGame: parseBooleanLike(
      raw.thirdPlaceGame ?? raw.third_place_game,
      false
    ),
    consolationBracket: parseBooleanLike(
      raw.consolationBracket ?? raw.consolation_bracket,
      false
    ),
    sortOrder: toNumberOrDefault(raw.sortOrder ?? raw.sort_order, index),
    _expanded: raw._expanded ?? false,
  }
}