// ─── Tournament status ─────────────────────────────────────────────────────────
export const TOURNAMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  LIVE: 'live',
  REVIEW: 'review',
  ARCHIVED: 'archived',
}

export const TOURNAMENT_STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  live: 'Live',
  review: 'Review',
  archived: 'Archived',
}

// ─── Division formats ──────────────────────────────────────────────────────────
export const FORMAT_TYPES = {
  POOL_TO_BRACKET:    'pool_to_bracket',
  POOL_TO_PLACEMENT:  'pool_to_placement',
  SINGLE_ELIM:        'single_elimination',
  DOUBLE_ELIM:        'double_elimination',
  ROUND_ROBIN:        'round_robin',
  CROSSOVER:          'crossover_pools',
}

export const FORMAT_LABELS = {
  pool_to_bracket:    'Pool Play → Bracket',
  pool_to_placement:  'Pool Play → Placement Games',
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  round_robin:        'Round Robin',
  crossover_pools:    'Crossover Pools',
}

// ─── Match status ──────────────────────────────────────────────────────────────
export const MATCH_STATUS = {
  SCHEDULED:   'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETE:    'complete',
  FORFEIT:     'forfeit',
  CANCELLED:   'cancelled',
  POSTPONED:   'postponed',
}

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  DIRECTOR:         'director',
  CO_DIRECTOR:      'co_director',
  SCOREKEEPER:      'scorekeeper',
  DIVISION_MANAGER: 'division_manager',
  CAPTAIN:          'captain',
}

// ─── Tiebreaker order ──────────────────────────────────────────────────────────
export const DEFAULT_TIEBREAKERS = [
  'head_to_head',
  'point_diff',
  'points_scored',
  'points_against',
  'sotg',
  'director',
]

export const TIEBREAKER_LABELS = {
  head_to_head:   'Head-to-Head',
  point_diff:     'Point Differential',
  points_scored:  'Points Scored',
  points_against: 'Points Against (fewer = better)',
  sotg:           'Spirit of the Game (SOTG)',
  director:       'Director Override',
}

// ─── Schedule defaults ─────────────────────────────────────────────────────────
export const SCHEDULE_DEFAULTS = {
  gameDurationMinutes:      90,
  breakBetweenGamesMinutes: 30,
  minRestBetweenTeamGames:  90,
  lunchBreakMinutes:        60,
}

// ─── Timezones (common) ────────────────────────────────────────────────────────
export const TIMEZONES = [
  { value: 'America/Toronto',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',    label: 'Central (CT)' },
  { value: 'America/Denver',     label: 'Mountain (MT)' },
  { value: 'America/Vancouver',  label: 'Pacific (PT)' },
  { value: 'America/Halifax',    label: 'Atlantic (AT)' },
  { value: 'America/St_Johns',   label: 'Newfoundland (NT)' },
  { value: 'America/Winnipeg',   label: 'Central (Winnipeg)' },
  { value: 'America/Regina',     label: 'Saskatchewan' },
  { value: 'UTC',                label: 'UTC' },
]

// ─── Color palette for team/tournament branding ───────────────────────────────
export const BRAND_COLORS = [
  '#1a56db', // Blue
  '#e3a008', // Yellow
  '#0e9f6e', // Green
  '#f05252', // Red
  '#7e3af2', // Purple
  '#ff5a1f', // Orange
  '#3f83f8', // Light blue
  '#31c48d', // Teal
  '#e74694', // Pink
  '#111827', // Near black
]

// ─── App URL ──────────────────────────────────────────────────────────────────
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

// ─── QR URL builders ──────────────────────────────────────────────────────────
export const qrUrl = {
  court:      (tournamentId, venueSlug) => `${APP_URL}/court/${tournamentId}/${venueSlug}`,
  tournament: (slug) => `${APP_URL}/t/${slug}`,
  match:      (matchId) => `${APP_URL}/score/${matchId}`,
}
