/ src/lib/workbook/presets/kingstonVolleyball.js
// 26th Annual Kingston Secondary School Elementary Volleyball Tournament
// UPDATE: Replace YYYY-MM-06 / YYYY-MM-07 with actual event dates

export const KINGSTON_VOLLEYBALL = {
  tournament: {
    name: '26th Annual Kingston Secondary School Elementary Volleyball Tournament',
    slug: 'kingston-elementary-volleyball',
    timezone: 'America/Toronto',
    startDate: 'YYYY-MM-06',
    endDate:   'YYYY-MM-07',
    hostSchool: 'Kingston Secondary School',
    location: 'Kingston, ON',
    primaryColor: '#1a56db',
  },

  fields: [
    { fieldName: 'Court 1', shortName: 'C1', qrSlug: 'court-1', sortOrder: 1 },
    { fieldName: 'Court 2', shortName: 'C2', qrSlug: 'court-2', sortOrder: 2 },
    { fieldName: 'Court 3', shortName: 'C3', qrSlug: 'court-3', sortOrder: 3 },
    { fieldName: 'Court 4', shortName: 'C4', qrSlug: 'court-4', sortOrder: 4 },
  ],

  tournamentDays: [
    {
      dayIndex:  1,
      eventDate: 'YYYY-MM-06',
      startTime: '15:00',
      endTime:   '21:00',
      label: 'Friday — Pool Play',
    },
    {
      dayIndex:  2,
      eventDate: 'YYYY-MM-07',
      startTime: '08:00',
      endTime:   '15:00',
      label: 'Saturday — Pool Play + Finals',
    },
  ],

  scheduleDefaults: {
    numberOfDays: 2,
    fieldsCount: 4,
    dayStartTime: '08:00',
    dayEndTime:   '21:00',
    gameDurationMinutes: 45,
    breakBetweenGamesMinutes: 0,
  },

  divisions: [
    // ── GIRLS ──────────────────────────────────────────────────────────────
    {
      name: 'Girls',
      slug: 'girls',
      formatType: 'pool_play',
      teamCount: 15,
      poolCount: 3,
      teamsAdvancePerPool: 1,
      thirdPlaceGame: false,
      consolationBracket: false,
      gameDurationMinutes: 45,
      breakBetweenGamesMinutes: 0,
      sortOrder: 0,
      pools: [
        { name: 'Pool A', shortName: 'A', sortOrder: 1 },
        { name: 'Pool B', shortName: 'B', sortOrder: 2 },
        { name: 'Pool C', shortName: 'C', sortOrder: 3 },
      ],
      teams: [
        // Pool A
        { name: 'Acadie B',            shortName: 'Acadie B',    seed: 1,  poolName: 'Pool A' },
        { name: 'Calvin Park A',       shortName: 'CalvPk A',    seed: 2,  poolName: 'Pool A' },
        { name: 'Cataraqui Woods A',   shortName: 'CatWd A',     seed: 3,  poolName: 'Pool A' },
        { name: 'Sainte-Marie-Rivier', shortName: 'SMR',         seed: 4,  poolName: 'Pool A' },
        { name: 'The Prince Charles',  shortName: 'Prince Chas', seed: 5,  poolName: 'Pool A' },
        // Pool B
        { name: 'Acadie A',            shortName: 'Acadie A',    seed: 6,  poolName: 'Pool B' },
        { name: 'Cataraqui Woods B',   shortName: 'CatWd B',     seed: 7,  poolName: 'Pool B' },
        { name: 'Loughborough B',      shortName: 'Lgbrgh B',    seed: 8,  poolName: 'Pool B' },
        { name: 'Perth Road',          shortName: 'Perth Rd',    seed: 9,  poolName: 'Pool B' },
        { name: 'Vanier B',            shortName: 'Vanier B',    seed: 10, poolName: 'Pool B' },
        // Pool C
        { name: 'Calvin Park B',       shortName: 'CalvPk B',    seed: 11, poolName: 'Pool C' },
        { name: 'Harrowsmith',         shortName: 'Harrowsmith', seed: 12, poolName: 'Pool C' },
        { name: 'Lancaster',           shortName: 'Lancaster',   seed: 13, poolName: 'Pool C' },
        { name: 'Loughborough A',      shortName: 'Lgbrgh A',    seed: 14, poolName: 'Pool C' },
        { name: 'Vanier A',            shortName: 'Vanier A',    seed: 15, poolName: 'Pool C' },
      ],
    },

    // ── BOYS ───────────────────────────────────────────────────────────────
    {
      name: 'Boys',
      slug: 'boys',
      formatType: 'pool_play',
      teamCount: 13,
      poolCount: 3,
      teamsAdvancePerPool: 1,
      thirdPlaceGame: false,
      consolationBracket: false,
      gameDurationMinutes: 45,
      breakBetweenGamesMinutes: 0,
      sortOrder: 1,
      pools: [
        { name: 'Pool D', shortName: 'D', sortOrder: 1 },
        { name: 'Pool E', shortName: 'E', sortOrder: 2 },
        { name: 'Pool F', shortName: 'F', sortOrder: 3 },
      ],
      teams: [
        // Pool D
        { name: 'Acadie',              shortName: 'Acadie',      seed: 1,  poolName: 'Pool D' },
        { name: 'Cataraqui Woods',     shortName: 'CatWd',       seed: 2,  poolName: 'Pool D' },
        { name: 'Loughborough B',      shortName: 'Lgbrgh B',    seed: 3,  poolName: 'Pool D' },
        { name: 'Sainte-Marie-Rivier', shortName: 'SMR',         seed: 4,  poolName: 'Pool D' },
        { name: 'Vanier A',            shortName: 'Vanier A',    seed: 5,  poolName: 'Pool D' },
        // Pool E
        { name: 'Calvin Park B',       shortName: 'CalvPk B',    seed: 6,  poolName: 'Pool E' },
        { name: 'Lancaster',           shortName: 'Lancaster',   seed: 7,  poolName: 'Pool E' },
        { name: 'Loughborough A',      shortName: 'Lgbrgh A',    seed: 8,  poolName: 'Pool E' },
        { name: 'Perth Road',          shortName: 'Perth Rd',    seed: 9,  poolName: 'Pool E' },
        // Pool F
        { name: 'Calvin Park A',       shortName: 'CalvPk A',    seed: 10, poolName: 'Pool F' },
        { name: 'The Prince Charles',  shortName: 'Prince Chas', seed: 11, poolName: 'Pool F' },
        { name: 'Vanier B',            shortName: 'Vanier B',    seed: 12, poolName: 'Pool F' },
        { name: 'Welborne',            shortName: 'Welborne',    seed: 13, poolName: 'Pool F' },
      ],
    },
  ],

  schedules: [
    // ── FRIDAY ─────────────────────────────────────────────────────────────
    // Court 1 — Girls
    { match_code: 'GA-F01', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Vanier B',           team_b_name: 'Acadie A',            scheduled_date: 'YYYY-MM-06', start_time: '15:30', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F02', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Lancaster',           team_b_name: 'Harrowsmith',         scheduled_date: 'YYYY-MM-06', start_time: '16:15', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F03', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods A',   team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-06', start_time: '17:00', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F04', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'The Prince Charles',  team_b_name: 'Acadie B',            scheduled_date: 'YYYY-MM-06', start_time: '17:45', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F05', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Vanier B',           team_b_name: 'Cataraqui Woods B',   scheduled_date: 'YYYY-MM-06', start_time: '18:30', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F06', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Calvin Park A',      team_b_name: 'Cataraqui Woods A',   scheduled_date: 'YYYY-MM-06', start_time: '19:15', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-F07', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Loughborough B',     team_b_name: 'Perth Road',          scheduled_date: 'YYYY-MM-06', start_time: '20:00', field_name: 'Court 1', status: 'scheduled' },

    // Court 2 — Girls
    { match_code: 'GA-F08', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Vanier A',           team_b_name: 'Calvin Park B',       scheduled_date: 'YYYY-MM-06', start_time: '15:15', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F09', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Acadie B',           team_b_name: 'Calvin Park A',       scheduled_date: 'YYYY-MM-06', start_time: '16:00', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F10', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods B',  team_b_name: 'Perth Road',          scheduled_date: 'YYYY-MM-06', start_time: '16:45', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F11', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Vanier A',           team_b_name: 'Loughborough A',      scheduled_date: 'YYYY-MM-06', start_time: '17:30', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F12', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Acadie A',           team_b_name: 'Loughborough B',      scheduled_date: 'YYYY-MM-06', start_time: '18:15', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F13', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Lancaster',           scheduled_date: 'YYYY-MM-06', start_time: '19:00', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-F14', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Loughborough A',     team_b_name: 'Harrowsmith',         scheduled_date: 'YYYY-MM-06', start_time: '19:45', field_name: 'Court 2', status: 'scheduled' },

    // Court 3 — Boys (+ Girls overflow at 20:00)
    { match_code: 'BO-F01', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Vanier A',           team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-06', start_time: '15:30', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-F02', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods',    team_b_name: 'Acadie',              scheduled_date: 'YYYY-MM-06', start_time: '16:15', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-F03', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods',    team_b_name: 'Vanier A',            scheduled_date: 'YYYY-MM-06', start_time: '17:00', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-F04', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Loughborough B',     team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-06', start_time: '17:45', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-F05', division_name: 'Boys',  pool_name: '',       round_label: 'Cross-pool', team_a_name: 'Lancaster',          team_b_name: 'Calvin Park A',       scheduled_date: 'YYYY-MM-06', start_time: '18:30', field_name: 'Court 3', status: 'scheduled', notes: 'E2 vs F1' },
    { match_code: 'BO-F06', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Acadie',             team_b_name: 'Loughborough B',      scheduled_date: 'YYYY-MM-06', start_time: '19:15', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'GA-F15', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'The Prince Charles', team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-06', start_time: '20:00', field_name: 'Court 3', status: 'scheduled', notes: 'Girls Pool A overflow' },

    // Court 4 — Boys
    { match_code: 'BO-F07', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'Calvin Park A',      team_b_name: 'Vanier B',            scheduled_date: 'YYYY-MM-06', start_time: '15:15', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-F08', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Lancaster',           scheduled_date: 'YYYY-MM-06', start_time: '16:00', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-F09', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'The Prince Charles', team_b_name: 'Welborne',            scheduled_date: 'YYYY-MM-06', start_time: '16:45', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-F10', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Loughborough A',     team_b_name: 'Perth Road',          scheduled_date: 'YYYY-MM-06', start_time: '17:30', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-F11', division_name: 'Boys',  pool_name: '',       round_label: 'Cross-pool', team_a_name: 'Calvin Park B',      team_b_name: 'Vanier B',            scheduled_date: 'YYYY-MM-06', start_time: '18:15', field_name: 'Court 4', status: 'scheduled', notes: 'E1 vs F3' },
    { match_code: 'BO-F12', division_name: 'Boys',  pool_name: '',       round_label: 'Cross-pool', team_a_name: 'Loughborough A',     team_b_name: 'The Prince Charles',  scheduled_date: 'YYYY-MM-06', start_time: '19:00', field_name: 'Court 4', status: 'scheduled', notes: 'E3 vs F2' },
    { match_code: 'BO-F13', division_name: 'Boys',  pool_name: '',       round_label: 'Cross-pool', team_a_name: 'Perth Road',         team_b_name: 'Welborne',            scheduled_date: 'YYYY-MM-06', start_time: '19:45', field_name: 'Court 4', status: 'scheduled', notes: 'E4 vs F4' },

    // ── SATURDAY ───────────────────────────────────────────────────────────
    // Court 1 — Girls
    { match_code: 'GA-S01', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Acadie A',           team_b_name: 'Cataraqui Woods B',   scheduled_date: 'YYYY-MM-07', start_time: '08:00', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S02', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Acadie B',           team_b_name: 'Cataraqui Woods A',   scheduled_date: 'YYYY-MM-07', start_time: '08:45', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S03', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Harrowsmith',         scheduled_date: 'YYYY-MM-07', start_time: '09:30', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S04', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Loughborough A',     team_b_name: 'Lancaster',           scheduled_date: 'YYYY-MM-07', start_time: '10:15', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S05', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Calvin Park A',      team_b_name: 'The Prince Charles',  scheduled_date: 'YYYY-MM-07', start_time: '11:00', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S06', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Sainte-Marie-Rivier',team_b_name: 'Acadie B',            scheduled_date: 'YYYY-MM-07', start_time: '11:45', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-S07', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods A',  team_b_name: 'The Prince Charles',  scheduled_date: 'YYYY-MM-07', start_time: '12:30', field_name: 'Court 1', status: 'scheduled' },
    { match_code: 'GA-SF1', division_name: 'Girls', pool_name: '',       round_label: 'Semi-final', team_a_name: 'TBD',               team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '13:15', field_name: 'Court 1', status: 'scheduled', notes: '1st seed vs 4th seed (wild card)' },
    { match_code: 'GA-FIN', division_name: 'Girls', pool_name: '',       round_label: 'Final',      team_a_name: 'TBD',               team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '14:00', field_name: 'Court 1', status: 'scheduled', notes: 'Full gym — Girls Final' },

    // Court 2 — Girls
    { match_code: 'GA-S08', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Lancaster',           team_b_name: 'Vanier A',            scheduled_date: 'YYYY-MM-07', start_time: '08:00', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S09', division_name: 'Girls', pool_name: 'Pool A', round_label: 'Pool Play', team_a_name: 'Calvin Park A',       team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-07', start_time: '08:45', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S10', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Perth Road',          team_b_name: 'Acadie A',            scheduled_date: 'YYYY-MM-07', start_time: '09:30', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S11', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Vanier A',            team_b_name: 'Harrowsmith',         scheduled_date: 'YYYY-MM-07', start_time: '10:15', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S12', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods B',   team_b_name: 'Loughborough B',      scheduled_date: 'YYYY-MM-07', start_time: '11:00', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S13', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Perth Road',          team_b_name: 'Vanier B',            scheduled_date: 'YYYY-MM-07', start_time: '11:45', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-S14', division_name: 'Girls', pool_name: 'Pool B', round_label: 'Pool Play', team_a_name: 'Loughborough B',      team_b_name: 'Vanier B',            scheduled_date: 'YYYY-MM-07', start_time: '12:30', field_name: 'Court 2', status: 'scheduled' },
    { match_code: 'GA-SF2', division_name: 'Girls', pool_name: '',       round_label: 'Semi-final', team_a_name: 'TBD',                team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '13:15', field_name: 'Court 2', status: 'scheduled', notes: '2nd seed vs 3rd seed' },

    // Court 3 — Boys (+ Girls overflow at 12:30)
    { match_code: 'BO-S01', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Acadie',             team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-07', start_time: '08:00', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-S02', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods',    team_b_name: 'Loughborough B',      scheduled_date: 'YYYY-MM-07', start_time: '08:45', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-S03', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'The Prince Charles', team_b_name: 'Vanier B',            scheduled_date: 'YYYY-MM-07', start_time: '09:30', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-S04', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Acadie',             team_b_name: 'Vanier A',            scheduled_date: 'YYYY-MM-07', start_time: '10:15', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-S05', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'Calvin Park A',      team_b_name: 'The Prince Charles',  scheduled_date: 'YYYY-MM-07', start_time: '11:00', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'BO-S06', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Lancaster',          team_b_name: 'Loughborough A',      scheduled_date: 'YYYY-MM-07', start_time: '11:45', field_name: 'Court 3', status: 'scheduled' },
    { match_code: 'GA-S15', division_name: 'Girls', pool_name: 'Pool C', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Loughborough A',      scheduled_date: 'YYYY-MM-07', start_time: '12:30', field_name: 'Court 3', status: 'scheduled', notes: 'Girls Pool C overflow' },
    { match_code: 'BO-SF1', division_name: 'Boys',  pool_name: '',       round_label: 'Semi-final', team_a_name: 'TBD',               team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '13:15', field_name: 'Court 3', status: 'scheduled', notes: '1st seed vs 4th seed (wild card)' },
    { match_code: 'BO-FIN', division_name: 'Boys',  pool_name: '',       round_label: 'Final',      team_a_name: 'TBD',               team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '14:00', field_name: 'Court 3', status: 'scheduled', notes: 'Full gym — Boys Final' },

    // Court 4 — Boys
    { match_code: 'BO-S07', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'Calvin Park A',      team_b_name: 'Welborne',            scheduled_date: 'YYYY-MM-07', start_time: '08:00', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S08', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Loughborough A',      scheduled_date: 'YYYY-MM-07', start_time: '08:45', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S09', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Lancaster',          team_b_name: 'Perth Road',          scheduled_date: 'YYYY-MM-07', start_time: '09:30', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S10', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Cataraqui Woods',    team_b_name: 'Sainte-Marie-Rivier', scheduled_date: 'YYYY-MM-07', start_time: '10:15', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S11', division_name: 'Boys',  pool_name: 'Pool F', round_label: 'Pool Play', team_a_name: 'Vanier B',           team_b_name: 'Welborne',            scheduled_date: 'YYYY-MM-07', start_time: '11:00', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S12', division_name: 'Boys',  pool_name: 'Pool D', round_label: 'Pool Play', team_a_name: 'Loughborough B',     team_b_name: 'Vanier A',            scheduled_date: 'YYYY-MM-07', start_time: '11:45', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-S13', division_name: 'Boys',  pool_name: 'Pool E', round_label: 'Pool Play', team_a_name: 'Calvin Park B',      team_b_name: 'Perth Road',          scheduled_date: 'YYYY-MM-07', start_time: '12:30', field_name: 'Court 4', status: 'scheduled' },
    { match_code: 'BO-SF2', division_name: 'Boys',  pool_name: '',       round_label: 'Semi-final', team_a_name: 'TBD',               team_b_name: 'TBD',                 scheduled_date: 'YYYY-MM-07', start_time: '13:15', field_name: 'Court 4', status: 'scheduled', notes: '2nd seed vs 3rd seed' },
  ],
}