# athleteOS — Tournament Module
## Master Specification Document
**Version 1.0 | Status: Pre-Build Lock**

---

## Table of Contents
1. [Platform Context](#1-platform-context)
2. [Scope Boundaries — Phase 1 vs Phase 2](#2-scope-boundaries)
3. [Tournament State Machine](#3-tournament-state-machine)
4. [Tournament Formats Engine](#4-tournament-formats-engine)
5. [Sport Configuration System](#5-sport-configuration-system)
6. [Complete Database Schema](#6-complete-database-schema)
7. [Row Level Security Policies](#7-row-level-security-policies)
8. [Director Wizard Flow](#8-director-wizard-flow)
9. [Scoring Engine](#9-scoring-engine)
10. [Standings & Tie-Breaker Engine](#10-standings--tie-breaker-engine)
11. [Bracket Engine](#11-bracket-engine)
12. [QR Code & Public Scoreboard System](#12-qr-code--public-scoreboard-system)
13. [Spectator Follow System](#13-spectator-follow-system)
14. [Spirit of the Game (SOTG)](#14-spirit-of-the-game-sotg)
15. [Real-Time Architecture](#15-real-time-architecture)
16. [Auth & Roles](#16-auth--roles)
17. [Component Architecture](#17-component-architecture)
18. [Build Order & Priority](#18-build-order--priority)
19. [Ultimate Frisbee Sport Config Reference](#19-ultimate-frisbee-sport-config-reference)
20. [Open Questions & Deferred Decisions](#20-open-questions--deferred-decisions)

---

## 1. Platform Context

### athleteOS Ecosystem
The Tournament Module is one module within the athleteOS platform. It shares a single Supabase project with StatStream and statstream-training. All three apps are independently deployed on Vercel but operate against the same PostgreSQL database and auth system.

**Phase 1 Integration Rule:** The tournament module is a standalone React app (new Vercel deployment). It shares only:
- The Supabase project (DB, Auth, Storage, Realtime)
- The `profiles` table from StatStream
- Optionally, the `teams` table from StatStream (teams CAN be linked, not required)

No UI integration with StatStream in Phase 1. No nav links. No shared layout. This keeps the blast radius small for the upcoming tournament.

### First Implementation
- **Sport:** Ultimate Frisbee
- **Timeline:** Weeks away — Phase 1 must be production-ready
- **Divisions:** Multiple (Open, Mixed, Women's) — each division is independent
- **Fields:** 3–6 fields simultaneously
- **Team count:** 7–32 per division, realistic max 32
- **Formats needed Day 1:** Pool play → single elimination bracket

---

## 2. Scope Boundaries

### Phase 1 — Must Work Day One

| Feature | Detail |
|---|---|
| Director wizard | Create tournament, divisions, pools, teams, schedule |
| Semi-auto scheduling | System generates schedule, director drags to adjust |
| Live score entry | Point-by-point + goal/assist/turnover per point |
| Public scoreboard | No login required, real-time |
| Court QR codes | Hybrid: per-court QR + master tournament QR |
| Pool standings | Real-time, tie-breaker aware |
| Bracket generation | Auto-seeded from pool results, director can override |
| SOTG entry | Post-game, captain-submitted |
| Spectator follow | localStorage for guests, Supabase for logged-in users |
| Spectator dashboard | Followed games + scores in one view |
| Constraint display | Show director conflicts — no automated enforcement |

### Phase 1 Formats
- Pool play → single elimination bracket
- Single elimination only
- Round robin (everyone plays everyone)
- Crossover pools (pool winners vs other pool runners-up)

### Phase 1 Non-Power-of-2 Solutions
- Byes (empty slots, auto-advance)
- Play-in games (extra round to fill bracket)
- Uneven pools (e.g. 3 pools of 4 + 1 pool of 3)
- Flex pools (cross-pool games to equalize game counts)

### Phase 2 — After First Tournament

| Feature | Notes |
|---|---|
| Swiss system format | Requires round-by-round pairing engine |
| Double elimination | Requires loser bracket tracking |
| Player career stats | Cross-tournament aggregation pipeline |
| Video / AI stat tracking | Computer vision pipeline — separate infrastructure |
| Sponsor integration | Logo rotation on scoreboards |
| Governing body CSV export | USAU format TBD |
| Cross-tournament standings | athleteOS ranking system |
| Tournament templates | Save + reuse director configurations |
| SMS/push notifications | Twilio integration for score alerts |
| OBS overlay route | Transparent scoreboard for livestreams |

### Hard Out-of-Scope (Never Phase 1)
- Payments / registration fees
- Referee scheduling
- AI game recaps
- Heatmaps / shot charts
- Pickup game auto-draft
- Multi-venue travel buffer calculations

---

## 3. Tournament State Machine

Every tournament moves through exactly 5 states. State controls what is editable, what is visible, and what RLS policies allow.

```
DRAFT → PUBLISHED → LIVE → REVIEW → ARCHIVED
```

### State Definitions

| State | Description | Who Sees It | What's Editable |
|---|---|---|---|
| `draft` | Wizard in progress | Director only | Everything — teams, pools, schedule, constraints |
| `published` | Schedule locked, publicly visible | Everyone | Schedule times only (no bracket changes) |
| `live` | Games in progress | Everyone | Scores, stats, SOTG — nothing structural |
| `review` | All games complete, results being confirmed | Director + Captains | SOTG scores, tie-break overrides, incident notes |
| `archived` | Locked permanently | Everyone (read-only) | Nothing — full audit trail only |

### State Transition Rules

```
draft      → published   : Director explicitly publishes (cannot unpublish if any game is live)
published  → live        : First game marked in_progress (auto-transition)
live       → review      : All games in final division marked complete (auto-transition)
review     → archived    : Director clicks "Archive Tournament" (irreversible)
```

### State Enforcement
- State is stored on the `tournaments` table
- All mutations (score updates, team edits) check tournament state before executing
- RLS policies enforce state — not just application logic
- A tournament can have divisions in different sub-states (pool_play vs bracket_play)

---

## 4. Tournament Formats Engine

### Core Concept
Formats are not hard-coded logic. Each tournament has a `format_config` (JSONB) that drives behavior. A single tournament can be multi-phase (e.g., pool play Day 1 → single elimination Day 2). Each division runs its own independent format.

### Supported Formats — Phase 1

#### Pool Play → Single Elimination
The primary format for the Ultimate Frisbee tournament.
- Teams divided into pools
- Each team plays every other team in their pool (round robin within pool)
- Top N teams per pool advance to elimination bracket
- Seeding into bracket based on pool finish + tie-breakers
- Supports: crossover games before bracket to refine seeding

#### Single Elimination Only
- Standard bracket, one loss and out
- Handles non-power-of-2 via byes or play-in games
- Supports consolation bracket (optional per tournament)
- Supports 3rd place game (optional)

#### Round Robin
- Every team plays every other team
- No bracket — final standings determine all placements
- Used for small divisions (≤8 teams) or tournaments with no elimination

#### Crossover Pools
- Pool A winner plays Pool B runner-up and vice versa
- Used to balance bracket seeding across uneven pools
- Results of crossover games determine bracket placement

### Non-Power-of-2 Handling

The wizard calculates and presents options when team count is not a power of 2.

```
Given N teams:
  next_power = smallest power of 2 ≥ N
  byes_needed = next_power - N
  bye_pct = byes_needed / next_power

  if bye_pct > 0.25:
    recommend pool play instead of bracket
  else:
    offer byes OR play-in games
```

**Play-in games** — preferred over byes when:
- Teams have traveled far (guarantees a game)
- bye_pct > 0.15
- Director preference

**Uneven pools** — when pool play is selected with non-divisible team count:
```
Example: 14 teams, 3 pools suggested
  Pool A: 5 teams
  Pool B: 5 teams  
  Pool C: 4 teams
  
  Flex game: 1 team from Pool C plays cross-pool game
  to equalize total games played
```

**Flex pool cross-games** — a team in a smaller pool plays 1 opponent from an adjacent pool. This game counts toward standings using the same tie-breaker weight as a pool game.

### Multi-Phase Tournaments
A tournament can define multiple phases. Each phase has its own format, and teams advance between phases automatically when phase N is complete.

```json
{
  "phases": [
    {
      "phase_number": 1,
      "name": "Pool Play",
      "format": "pool_round_robin",
      "advance_rule": "top_2_per_pool"
    },
    {
      "phase_number": 2,
      "name": "Championship Bracket",
      "format": "single_elimination",
      "seeding": "pool_finish"
    }
  ]
}
```

Phase transition is manual — director reviews standings and clicks "Advance to Bracket." This prevents premature bracket generation when late scores haven't been entered.

---

## 5. Sport Configuration System

### Design Principle
No sport-specific columns anywhere in the schema. All sport behavior is driven by a `sport_config` JSON object stored in `sport_templates`. The UI reads this config to render the correct scorekeeper interface, stat buttons, and scoring structure.

### Sport Template Structure

```json
{
  "sport": "ultimate_frisbee",
  "display_name": "Ultimate Frisbee",
  "score_type": "point_by_point",
  "win_condition": {
    "type": "first_to",
    "value": 15,
    "cap_enabled": true,
    "soft_cap_add": 2,
    "hard_cap_add": 1
  },
  "periods": [
    { "name": "First Half", "ends_at_score": 8 },
    { "name": "Second Half" }
  ],
  "time_limits": {
    "soft_cap_minutes": 75,
    "hard_cap_minutes": 90
  },
  "draw_allowed": false,
  "overtime": null,
  "stats": [
    { "id": "goal", "label": "Goal", "adds_to_score": 1, "is_player_stat": true, "is_negative": false, "category": "scoring" },
    { "id": "assist", "label": "Assist", "adds_to_score": 0, "is_player_stat": true, "is_negative": false, "category": "scoring" },
    { "id": "turnover", "label": "Turnover", "adds_to_score": 0, "is_player_stat": true, "is_negative": true, "category": "disc" },
    { "id": "layout_d", "label": "Layout D", "adds_to_score": 0, "is_player_stat": true, "is_negative": false, "category": "defense" },
    { "id": "callahan", "label": "Callahan", "adds_to_score": 1, "is_player_stat": true, "is_negative": false, "category": "scoring" },
    { "id": "drop", "label": "Drop", "adds_to_score": 0, "is_player_stat": true, "is_negative": true, "category": "disc" },
    { "id": "stall", "label": "Stall Out", "adds_to_score": 0, "is_player_stat": false, "is_negative": true, "category": "disc" }
  ],
  "sotg_enabled": true,
  "sotg_categories": [
    "Knowledge of Rules",
    "Fouls and Body Contact",
    "Fair Mindedness",
    "Attitude and Self-Control",
    "Communication"
  ],
  "sotg_scale": { "min": 0, "max": 4 }
}
```

### Director Stat Customization
Directors can add/remove stats from the master list for their tournament. They cannot add a stat that doesn't exist in the master list (Phase 1). Custom stats are Phase 2.

The wizard shows all stats for the selected sport with toggles. The director's selection is saved as `enabled_stat_ids` on the tournament.

### Phase 1 Sport Templates
These templates must exist at launch:

| Sport | Score Type | Periods | Notes |
|---|---|---|---|
| Ultimate Frisbee | Point-by-point | 2 halves | Soft/hard cap logic |
| Basketball | Cumulative | 4 quarters (2 halves for youth) | Foul tracking |
| Volleyball | Set-based | Best of 3 or 5 sets | Rally scoring, 25/15 point sets |

Hockey and Tennis — templates defined in schema, UI not built Phase 1.

### Fully Custom Scoring Structure
Directors can override period structure in the wizard:
- Define period names
- Set score target per period (or none)
- Enable/disable time caps
- Set win condition (first to N, most after time, etc.)

---

## 6. Complete Database Schema

### Design Principles
1. No hard-coded sport columns — all sport logic in JSONB configs
2. Event-log pattern for scoring — never update a score column, append an event
3. Nullable foreign keys for optional athleteOS links (statstream teams)
4. All timestamps in UTC
5. Soft deletes on critical tables (deleted_at, not hard DELETE)
6. Every table has `created_at`, `updated_at`

---

### Table: `sport_templates`
Master list of sport configurations. Seeded at deployment.

```sql
CREATE TABLE sport_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,              -- 'ultimate_frisbee', 'basketball'
  display_name TEXT NOT NULL,
  config JSONB NOT NULL,                  -- Full sport config object (see Section 5)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Table: `tournaments`
The root object. One row per tournament event.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,              -- URL-safe: 'spring-ultimate-2025'
  name TEXT NOT NULL,
  description TEXT,
  sport_template_id UUID REFERENCES sport_templates(id),
  
  -- Location
  venue_name TEXT,
  venue_address TEXT,
  venue_lat DECIMAL(10,8),
  venue_lng DECIMAL(11,8),
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Toronto',
  
  -- State machine
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','live','review','archived')),
  
  -- Director
  director_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Config
  format_config JSONB,                    -- Multi-phase format definition
  enabled_stat_ids TEXT[],                -- Which stats from sport template are active
  custom_stats JSONB,                     -- Phase 2: director-defined custom stats
  
  -- Tie-breaker order (array of strings, ordered by priority)
  tiebreaker_order TEXT[] DEFAULT 
    ARRAY['head_to_head','point_diff','points_scored','points_against','sotg','director'],
  
  -- Display
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT,
  
  -- Flags
  is_public BOOLEAN DEFAULT true,
  sotg_enabled BOOLEAN DEFAULT true,
  allow_player_stats BOOLEAN DEFAULT true,
  
  -- athleteOS link (nullable — for future cross-app features)
  organization_id UUID,                   -- Future: link to org table
  
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_director ON tournaments(director_id);
CREATE INDEX idx_tournaments_slug ON tournaments(slug);
```

---

### Table: `divisions`
Each tournament can have multiple independent divisions.

```sql
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- 'Open', 'Mixed', 'Women\'s'
  slug TEXT NOT NULL,                     -- 'open', 'mixed', 'womens'
  
  -- Format (can differ per division)
  format_type TEXT NOT NULL DEFAULT 'pool_to_bracket'
    CHECK (format_type IN (
      'pool_to_bracket',
      'single_elimination',
      'double_elimination',
      'round_robin',
      'swiss',
      'crossover_pools'
    )),
  format_config JSONB,                    -- Phase-specific config for this division
  
  -- State (divisions can be in different phases)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','pool_play','bracket_play','review','complete')),
  current_phase INTEGER DEFAULT 1,
  
  -- Scheduling
  game_duration_minutes INTEGER DEFAULT 90,
  break_between_games_minutes INTEGER DEFAULT 30,
  
  -- Bracket config
  teams_advance_per_pool INTEGER DEFAULT 2,
  consolation_bracket BOOLEAN DEFAULT false,
  third_place_game BOOLEAN DEFAULT false,
  
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tournament_id, slug)
);

CREATE INDEX idx_divisions_tournament ON divisions(tournament_id);
```

---

### Table: `venues`
Physical fields/courts within a tournament.

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- 'Field 1', 'Court A', 'Rink 3'
  short_name TEXT,                        -- 'F1' — for tight UI
  
  -- For QR routing
  qr_slug TEXT NOT NULL,                  -- 'field-1' — unique within tournament
  
  -- Physical location (optional — for field maps)
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  notes TEXT,
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tournament_id, qr_slug)
);
```

---

### Table: `time_slots`
Master schedule slots. Decouples game assignment from wall-clock time.
This is the Schedule Engine backbone — games are assigned to slots, slots drift independently.

```sql
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id),
  
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  
  -- Drift tracking (for rain delays, running late)
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  offset_minutes INTEGER DEFAULT 0,       -- Global delay applied to this slot
  
  is_available BOOLEAN DEFAULT true,
  notes TEXT,                             -- 'Lightning delay', 'Field unavailable'
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_time_slots_tournament ON time_slots(tournament_id);
CREATE INDEX idx_time_slots_venue ON time_slots(venue_id);
CREATE INDEX idx_time_slots_start ON time_slots(scheduled_start);
```

---

### Table: `pools`
Groups of teams within a division for pool play.

```sql
CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- 'Pool A', 'Pool B'
  short_name TEXT,                        -- 'A', 'B'
  
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','complete')),
    
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pools_division ON pools(division_id);
```

---

### Table: `tournament_teams`
Teams participating in a tournament. Optionally linked to StatStream teams.

```sql
CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES divisions(id),
  pool_id UUID REFERENCES pools(id),      -- NULL until pools are assigned
  
  -- Team identity
  name TEXT NOT NULL,
  short_name TEXT,                        -- For tight bracket UI
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  
  -- athleteOS link (optional)
  statstream_team_id UUID,               -- Nullable link to existing StatStream team
  
  -- Seeding
  seed INTEGER,                           -- Overall seed within division
  pool_seed INTEGER,                      -- Seed within their pool
  
  -- Club/school constraints (shown to director, not enforced)
  club_name TEXT,
  school_name TEXT,
  
  -- Coach info (for constraint display)
  head_coach_name TEXT,
  head_coach_email TEXT,
  head_coach_phone TEXT,
  
  -- Availability constraints (JSONB for flexibility)
  -- e.g. {"unavailable_before": "10:00", "unavailable_after": "18:00"}
  constraints JSONB,
  
  -- Status
  status TEXT DEFAULT 'registered'
    CHECK (status IN ('registered','checked_in','withdrawn','disqualified')),
  check_in_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawn_reason TEXT,
  
  -- Waitlist support
  is_waitlisted BOOLEAN DEFAULT false,
  waitlist_position INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_tt_division ON tournament_teams(division_id);
CREATE INDEX idx_tt_pool ON tournament_teams(pool_id);
CREATE INDEX idx_tt_statstream ON tournament_teams(statstream_team_id);
```

---

### Table: `players`
Players on a tournament team roster.

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  number TEXT,                            -- Jersey number (string — handles '00', 'X')
  
  -- athleteOS link (optional)
  user_id UUID REFERENCES auth.users(id), -- If player has an account
  
  -- Eligibility
  waiver_signed BOOLEAN DEFAULT false,
  waiver_signed_at TIMESTAMPTZ,
  is_eligible BOOLEAN DEFAULT true,
  ineligibility_reason TEXT,
  
  -- Discipline
  suspension_games INTEGER DEFAULT 0,    -- Games remaining on suspension
  
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_players_team ON players(tournament_team_id);
CREATE INDEX idx_players_user ON players(user_id);
```

---

### Table: `matches`
Every game in the tournament. The structural node of all formats.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  division_id UUID NOT NULL REFERENCES divisions(id),
  
  -- Format context
  phase INTEGER DEFAULT 1,               -- 1 = pool play, 2 = bracket
  round INTEGER,                         -- Round number within phase
  match_number INTEGER,                  -- Global match number (for display)
  
  -- Pool play context
  pool_id UUID REFERENCES pools(id),
  
  -- Bracket context
  bracket_position TEXT,                 -- 'W1', 'L3', 'QF-A' etc.
  bracket_slot INTEGER,                  -- Position in bracket tree
  -- Where winner/loser advance to
  winner_next_match_id UUID REFERENCES matches(id),
  loser_next_match_id UUID REFERENCES matches(id),
  winner_next_slot TEXT,                 -- 'team_a' or 'team_b'
  loser_next_slot TEXT,
  
  -- Teams (NULL = TBD, populated when bracket advances)
  team_a_id UUID REFERENCES tournament_teams(id),
  team_b_id UUID REFERENCES tournament_teams(id),
  is_bye BOOLEAN DEFAULT false,          -- team_b_id = NULL + is_bye = advance team_a automatically
  
  -- Scheduling
  time_slot_id UUID REFERENCES time_slots(id),
  venue_id UUID REFERENCES venues(id),
  
  -- Score (computed from game_events — these are cached for performance)
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  
  -- Period/half scores (JSONB for flexibility across sports)
  -- e.g. [{"period": 1, "score_a": 8, "score_b": 7}, {"period": 2, "score_a": 7, "score_b": 6}]
  period_scores JSONB DEFAULT '[]',
  
  -- Match result
  winner_id UUID REFERENCES tournament_teams(id),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled',
      'in_progress', 
      'complete',
      'forfeit',
      'cancelled',
      'postponed'
    )),
  forfeit_team_id UUID REFERENCES tournament_teams(id),
  forfeit_score_override JSONB,          -- Sport-specific forfeit score config
  
  -- Cap state (Ultimate Frisbee specific but generic enough for other sports)
  cap_status TEXT CHECK (cap_status IN (NULL, 'soft_cap', 'hard_cap')),
  cap_triggered_at TIMESTAMPTZ,
  
  -- Actual times
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Score confirmation
  score_confirmed_a BOOLEAN DEFAULT false,
  score_confirmed_b BOOLEAN DEFAULT false,
  score_confirmed_at TIMESTAMPTZ,
  score_dispute BOOLEAN DEFAULT false,
  score_dispute_notes TEXT,
  
  -- Scorekeeper assignment
  scorekeeper_id UUID REFERENCES auth.users(id),
  scorekeeper_pin TEXT,                  -- 4-digit PIN for device-agnostic access
  
  -- Labels for display
  round_label TEXT,                      -- 'Pool A - Game 3', 'Quarterfinal', 'Final'
  
  -- Audit
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_division ON matches(division_id);
CREATE INDEX idx_matches_pool ON matches(pool_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_venue ON matches(venue_id);
CREATE INDEX idx_matches_timeslot ON matches(time_slot_id);
CREATE INDEX idx_matches_team_a ON matches(team_a_id);
CREATE INDEX idx_matches_team_b ON matches(team_b_id);
```

---

### Table: `game_events`
The event log. Every point, goal, turnover, substitution is a row here.
Scores are NEVER updated directly — they are computed from this table and cached on `matches`.

```sql
CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  -- What happened
  stat_id TEXT NOT NULL,                  -- Matches stat.id from sport_template config
  
  -- Who did it
  team_id UUID NOT NULL REFERENCES tournament_teams(id),
  player_id UUID REFERENCES players(id), -- NULL for team-level events
  
  -- Secondary player (e.g. assist on a goal)
  secondary_player_id UUID REFERENCES players(id),
  secondary_stat_id TEXT,                -- 'assist' when primary is 'goal'
  
  -- Score state AFTER this event
  score_a_after INTEGER,
  score_b_after INTEGER,
  period_after INTEGER DEFAULT 1,
  
  -- Timing
  game_time_seconds INTEGER,             -- Seconds into game when event occurred
  event_timestamp TIMESTAMPTZ DEFAULT now(),
  
  -- Data quality
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','ai_auto','ai_assisted','catchup')),
  is_verified BOOLEAN DEFAULT true,
  -- 'catchup' = entered in burst without live timing, sequence unverified
  
  -- Soft delete for undo
  deleted_at TIMESTAMPTZ,               -- NULL = active, set = undone
  deleted_by UUID REFERENCES auth.users(id),
  
  sequence INTEGER,                      -- Order within match for replay/undo
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_match ON game_events(match_id);
CREATE INDEX idx_events_team ON game_events(team_id);
CREATE INDEX idx_events_player ON game_events(player_id);
CREATE INDEX idx_events_deleted ON game_events(match_id) WHERE deleted_at IS NULL;
```

---

### Table: `score_audit_log`
Every cached score update on `matches` is logged here. Answers "who changed the score?"

```sql
CREATE TABLE score_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  
  old_score_a INTEGER,
  old_score_b INTEGER,
  new_score_a INTEGER,
  new_score_b INTEGER,
  
  trigger_event_id UUID REFERENCES game_events(id),
  change_reason TEXT,                    -- 'undo', 'correction', 'forfeit'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_match ON score_audit_log(match_id);
```

---

### Table: `sotg_scores`
Spirit of the Game scores. Submitted by team captains after each game.

```sql
CREATE TABLE sotg_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  
  -- Who is scoring whom
  scoring_team_id UUID NOT NULL REFERENCES tournament_teams(id),
  scored_team_id UUID NOT NULL REFERENCES tournament_teams(id),
  
  -- Category scores (array matching sotg_categories in sport config)
  -- e.g. [3, 3, 4, 2, 3] — one integer per category
  category_scores INTEGER[] NOT NULL,
  total_score INTEGER GENERATED ALWAYS AS (
    (SELECT SUM(s) FROM unnest(category_scores) s)
  ) STORED,
  
  comments TEXT,
  
  -- Submitted by (must be captain or director)
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  
  -- Director override
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(match_id, scoring_team_id)      -- One score per team per game
);

CREATE INDEX idx_sotg_match ON sotg_scores(match_id);
CREATE INDEX idx_sotg_scored_team ON sotg_scores(scored_team_id);
```

---

### Table: `pool_standings`
Materialized standings per pool. Recomputed after every game_event via database trigger.
Stored for performance — do not read standings by aggregating game_events live in the UI.

```sql
CREATE TABLE pool_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES tournament_teams(id),
  
  -- Record
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  
  -- Scoring
  points_scored INTEGER DEFAULT 0,
  points_against INTEGER DEFAULT 0,
  point_diff INTEGER GENERATED ALWAYS AS (points_scored - points_against) STORED,
  
  -- SOTG (average of received scores)
  sotg_total DECIMAL(5,2) DEFAULT 0,
  sotg_games INTEGER DEFAULT 0,
  sotg_average DECIMAL(4,2) GENERATED ALWAYS AS (
    CASE WHEN sotg_games > 0 THEN sotg_total / sotg_games ELSE 0 END
  ) STORED,
  
  -- Tiebreaker rank (recomputed after each game)
  rank INTEGER,
  is_tied BOOLEAN DEFAULT false,
  tied_with UUID[],                      -- team_ids this team is tied with
  tie_resolved_by TEXT,                  -- Which tie-breaker resolved it
  
  -- Advancement
  advances_to_bracket BOOLEAN DEFAULT false,
  bracket_seed INTEGER,
  
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(pool_id, team_id)
);

CREATE INDEX idx_standings_pool ON pool_standings(pool_id);
CREATE INDEX idx_standings_rank ON pool_standings(pool_id, rank);
```

---

### Table: `bracket_slots`
Tracks the bracket tree structure independently of matches.
Allows the bracket to be visualized even when TBD teams haven't been assigned yet.

```sql
CREATE TABLE bracket_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(id),
  phase INTEGER DEFAULT 2,
  
  round INTEGER NOT NULL,
  position INTEGER NOT NULL,             -- Position within round (1-indexed)
  
  -- Display
  label TEXT,                            -- 'Quarterfinal A', 'Semifinal', 'Final'
  bracket_side TEXT CHECK (bracket_side IN ('winners','losers','consolation')),
  
  -- Team assignment (TBD until previous round resolves)
  team_a_id UUID REFERENCES tournament_teams(id),
  team_b_id UUID REFERENCES tournament_teams(id),
  team_a_source TEXT,                    -- 'winner:slot_id' or 'pool_seed:1A'
  team_b_source TEXT,
  
  match_id UUID REFERENCES matches(id),
  
  -- Advancement
  winner_goes_to_slot_id UUID REFERENCES bracket_slots(id),
  loser_goes_to_slot_id UUID REFERENCES bracket_slots(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(division_id, phase, round, position)
);

CREATE INDEX idx_bracket_division ON bracket_slots(division_id);
```

---

### Table: `tournament_roles`
Extends auth.users with tournament-specific roles.

```sql
CREATE TABLE tournament_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  role TEXT NOT NULL CHECK (role IN (
    'director',        -- Full wizard + control
    'co_director',     -- Full wizard + control (same as director)
    'scorekeeper',     -- Score entry only (scoped to assigned matches)
    'division_manager',-- Approve/veto for one division
    'captain'          -- SOTG submission for their team
  )),
  
  -- For scoped roles
  division_id UUID REFERENCES divisions(id),   -- NULL = all divisions
  team_id UUID REFERENCES tournament_teams(id), -- For captain role
  
  -- For scorekeeper device-agnostic access
  assigned_match_ids UUID[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tournament_id, user_id, role)
);

CREATE INDEX idx_roles_tournament ON tournament_roles(tournament_id);
CREATE INDEX idx_roles_user ON tournament_roles(user_id);
```

---

### Table: `user_follows`
Spectator follow system. Supports both logged-in (Supabase) and guest (localStorage) users.

```sql
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Either user_id (logged in) OR guest_token (localStorage UUID)
  user_id UUID REFERENCES auth.users(id),
  guest_token UUID,                      -- Generated client-side, stored in localStorage
  
  -- What they're following
  tournament_team_id UUID REFERENCES tournament_teams(id),
  match_id UUID REFERENCES matches(id),
  tournament_id UUID REFERENCES tournaments(id),
  
  -- Notification preferences
  notify_score_updates BOOLEAN DEFAULT true,
  notify_game_start BOOLEAN DEFAULT true,
  notify_next_game BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- At least one of user_id or guest_token must be set
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE INDEX idx_follows_user ON user_follows(user_id);
CREATE INDEX idx_follows_guest ON user_follows(guest_token);
CREATE INDEX idx_follows_team ON user_follows(tournament_team_id);
```

---

### Table: `incident_reports`
Real-time field incident logging.

```sql
CREATE TABLE incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  match_id UUID REFERENCES matches(id),
  venue_id UUID REFERENCES venues(id),
  
  type TEXT NOT NULL CHECK (type IN (
    'injury','weather','field_condition','dispute',
    'equipment','need_water','need_medic','other'
  )),
  
  description TEXT,
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  reported_at TIMESTAMPTZ DEFAULT now(),
  
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

CREATE INDEX idx_incidents_tournament ON incident_reports(tournament_id);
```

---

### Table: `schedule_delays`
Global or venue-specific delay tracking. Cascades to affected time slots.

```sql
CREATE TABLE schedule_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  venue_id UUID REFERENCES venues(id),   -- NULL = all venues
  
  offset_minutes INTEGER NOT NULL,
  reason TEXT,                           -- 'Lightning delay', 'Field 3 flooding'
  
  applies_from TIMESTAMPTZ NOT NULL,     -- All slots after this time are affected
  announced_by UUID REFERENCES auth.users(id),
  announced_at TIMESTAMPTZ DEFAULT now(),
  
  is_active BOOLEAN DEFAULT true
);
```

---

### Database Triggers (Critical)

```sql
-- 1. Recompute pool standings after any game_event insert or soft-delete
CREATE OR REPLACE FUNCTION recompute_pool_standings()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate wins/losses/points for both teams in the affected match
  -- Updates pool_standings table
  -- Then re-runs tie-breaker algorithm and updates rank column
  PERFORM update_standings_for_match(
    COALESCE(NEW.match_id, OLD.match_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_standings_on_event
AFTER INSERT OR UPDATE ON game_events
FOR EACH ROW EXECUTE FUNCTION recompute_pool_standings();

-- 2. Auto-advance bye matches
CREATE OR REPLACE FUNCTION auto_advance_byes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_bye = true AND NEW.team_a_id IS NOT NULL THEN
    UPDATE matches SET 
      winner_id = NEW.team_a_id,
      status = 'complete'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bye_advance
AFTER INSERT OR UPDATE OF team_a_id ON matches
FOR EACH ROW EXECUTE FUNCTION auto_advance_byes();

-- 3. Update cached scores on matches when events change
CREATE OR REPLACE FUNCTION update_match_score_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE matches SET
    score_a = (SELECT COALESCE(SUM(CASE WHEN adds_to_score THEN 1 ELSE 0 END), 0)
               FROM game_events ge
               JOIN sport_stat_lookup ssl ON ge.stat_id = ssl.stat_id
               WHERE ge.match_id = COALESCE(NEW.match_id, OLD.match_id)
               AND ge.team_id = m.team_a_id
               AND ge.deleted_at IS NULL),
    score_b = (/* same for team_b */),
    updated_at = now()
  FROM matches m WHERE m.id = COALESCE(NEW.match_id, OLD.match_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. Row Level Security Policies

### Core Policy Design
- Public (unauthenticated) = read-only on published/live/archived tournaments
- Scorekeeper = insert/update game_events for assigned matches only
- Director = full control on their tournaments
- State machine enforced at DB level — not just application logic

```sql
-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sotg_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TOURNAMENTS
-- ============================================================

-- Public can read published/live/archived tournaments
CREATE POLICY "tournaments_public_read" ON tournaments
FOR SELECT USING (
  is_public = true 
  AND status IN ('published','live','review','archived')
  AND deleted_at IS NULL
);

-- Directors can read their own tournaments in any state
CREATE POLICY "tournaments_director_read" ON tournaments
FOR SELECT USING (
  director_id = auth.uid()
);

-- Directors can insert their own tournaments
CREATE POLICY "tournaments_director_insert" ON tournaments
FOR INSERT WITH CHECK (director_id = auth.uid());

-- Directors can update their own tournaments (with state guard)
CREATE POLICY "tournaments_director_update" ON tournaments
FOR UPDATE USING (director_id = auth.uid());

-- ============================================================
-- GAME EVENTS
-- ============================================================

-- Public can read events for live/complete matches
CREATE POLICY "events_public_read" ON game_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = game_events.match_id
    AND m.status IN ('in_progress','complete')
    AND t.status IN ('live','review','archived')
    AND t.is_public = true
  )
  AND deleted_at IS NULL
);

-- Scorekeepers can insert events for their assigned matches
CREATE POLICY "events_scorekeeper_insert" ON game_events
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_roles tr
    WHERE tr.user_id = auth.uid()
    AND tr.role IN ('scorekeeper','director','co_director')
    AND (
      game_events.match_id = ANY(tr.assigned_match_ids)
      OR tr.role IN ('director','co_director')
    )
  )
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = game_events.match_id
    AND m.status = 'in_progress'
  )
);

-- Scorekeepers can soft-delete (undo) their own events
CREATE POLICY "events_scorekeeper_undo" ON game_events
FOR UPDATE USING (
  created_by = auth.uid()
  AND deleted_at IS NULL
)
WITH CHECK (
  -- Only allow setting deleted_at (soft delete = undo)
  deleted_at IS NOT NULL
);

-- ============================================================
-- SOTG SCORES
-- ============================================================

-- Captains can insert SOTG for their team's matches
CREATE POLICY "sotg_captain_insert" ON sotg_scores
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournament_roles tr
    WHERE tr.user_id = auth.uid()
    AND tr.role = 'captain'
    AND tr.team_id = sotg_scores.scoring_team_id
  )
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = sotg_scores.match_id
    AND m.status = 'complete'
  )
);

-- Public can read SOTG totals (not per-category breakdowns) for complete tournaments
CREATE POLICY "sotg_public_totals_read" ON sotg_scores
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = sotg_scores.match_id
    AND t.status IN ('review','archived')
    AND t.is_public = true
  )
);

-- ============================================================
-- USER FOLLOWS
-- ============================================================

-- Users can manage their own follows
CREATE POLICY "follows_user_manage" ON user_follows
FOR ALL USING (
  user_id = auth.uid() 
  OR guest_token IS NOT NULL  -- Guest follows managed client-side, row accessible by token
);
```

---

## 8. Director Wizard Flow

### Wizard Steps (Linear, with back navigation)

```
Step 1: Tournament Basics
Step 2: Sport & Format
Step 3: Divisions
Step 4: Venues (Fields/Courts)
Step 5: Teams
Step 6: Schedule
Step 7: Constraint Review
Step 8: Preview & Publish
```

---

### Step 1: Tournament Basics
- Tournament name, description
- Start date / end date
- Timezone (auto-detect from browser, director can override)
- Venue name + address (geocoded for field map)
- Tournament logo upload (optional)
- Public vs private toggle

---

### Step 2: Sport & Format
- Sport selection (Ultimate Frisbee, Basketball, Volleyball, or Custom)
- On sport selection: load `sport_template` and display default stats
- Director toggles stats on/off (master list, can't add new in Phase 1)
- Scoring structure: pre-populated from template, director can edit
  - Win condition (first to N / time-based)
  - Period names and count
  - Soft cap / hard cap settings
- Save as `format_config` on tournament

---

### Step 3: Divisions
- Add one or more divisions (Open, Mixed, Women's, etc.)
- Per division:
  - Name
  - Format type (pool_to_bracket / single_elimination / round_robin / crossover)
  - Estimated team count (drives pool recommendation)
  - Game duration + break time
  - Teams advance per pool (for pool_to_bracket)
  - Consolation bracket on/off
  - 3rd place game on/off

**Format Recommendation Logic (shown when director enters team count):**

```
if format = pool_to_bracket:
  suggest_pools(team_count) →
    if team_count % 4 == 0: N/4 pools of 4
    if team_count % 3 == 0: N/3 pools of 3
    else: show options:
      Option A: uneven pools (e.g. 3 pools of 5 + 1 pool of 4 for 19 teams)
      Option B: play-in games (fill to next power of 2)
      Option C: flex pool cross-games
  
  Display: "14 teams → suggested: 2 pools of 4 + 1 pool of 3 + 3 flex cross-games"
  Display: total guaranteed games per team for each option
```

---

### Step 4: Venues (Fields/Courts)
- Add venues one by one (name, short name)
- Each venue gets auto-generated QR slug
- Optional: lat/lng for field map
- Set active/inactive (for if a field becomes unavailable)
- 3–6 venues typical — UI optimized for this count

---

### Step 5: Teams
**Entry methods (all supported):**
- Manual entry (name, seed, club/school, coach)
- CSV import (template provided for download)
- Copy from previous tournament (Phase 2)
- Import from StatStream teams table (optional link, not required)

**Per team:**
- Name + short name
- Seed (optional — can auto-assign)
- Club / school name (for constraint display)
- Head coach name + contact
- Availability constraints (optional)
- Primary / secondary colors

**Pool Assignment:**
- Auto-assignment based on seed (serpentine seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A...)
- Director can drag teams between pools
- Constraint warnings shown inline (not blocked):
  - ⚠️ "Wildcats A and Wildcats B (same club) are in the same pool"
  - ⚠️ "Coach Miller has 3 teams — check schedule for overlaps"

---

### Step 6: Schedule

**Semi-Auto Generation Flow:**

1. Director sets tournament start time, lunch break window, end time
2. System calculates available slots per venue
3. System places pool games automatically:
   - Distributes games across available venues + time slots
   - Ensures teams have minimum rest (configurable, default = 1 slot gap)
   - Groups pool games logically (all Pool A games visible together)
4. Director sees visual schedule grid (rows = time slots, columns = venues)
5. Director can drag games to different slots/venues
6. Conflict indicators shown on drag:
   - 🔴 Hard conflict: team already has a game in this slot
   - 🟡 Soft conflict: team has game in adjacent slot (rest violation)
   - ⚠️ Coach conflict: coach has another team in same slot

**Schedule Grid UI:**
- Columns: Field 1 | Field 2 | Field 3 | Field 4 | ... (up to 6)
- Rows: 8:00 AM | 9:30 AM | 11:00 AM | ... 
- Each cell: game card showing Pool, Team A vs Team B
- Empty cell = available slot
- Drag game card to move it

**Global Delay Controls:**
- "Delay all games from [time] by [N] minutes" button
- Delay reason text field
- Broadcasts delay to all spectator dashboards immediately via Realtime

---

### Step 7: Constraint Review

**Team-by-Team Review Panel:**

Left panel: list of all teams with status badges
- ✅ No conflicts detected
- ⚠️ Soft conflicts (same club in pool, coach overlap)
- 🔴 Hard conflicts (team plays twice in same slot)

Right panel (on team select): "Team Passport"
- Team name, pool, seed
- Full schedule: Date | Time | Field | Opponent
- Coach's full day: All teams this coach is responsible for, all times
- Same-club teams: Where are they in the bracket?
- Rest periods: Time between each game
- "Mark as Reviewed ✓" button

**Director actions per conflict:**
- "Looks good" → mark reviewed
- "Fix this" → jumps back to schedule drag interface with that team highlighted

Tournament cannot be published until director has reviewed all ⚠️ and 🔴 flags (can mark as "acknowledged" to proceed).

---

### Step 8: Preview & Publish

- Full tournament preview (public view)
- Final checklist:
  - [ ] All teams assigned to pools
  - [ ] All pool games scheduled
  - [ ] All venues have QR codes generated
  - [ ] Scorekeepers assigned (or director doing it themselves)
  - [ ] Constraint review completed
- "Publish Tournament" button → status changes `draft → published`
- QR code PDF download generated immediately
- Shareable tournament link shown

---

## 9. Scoring Engine

### Scorekeeper Access
Scorekeepers access their game via:
1. Direct URL: `/score/[match_id]`
2. Court QR scan: auto-routes to active game on that court
3. 4-digit PIN: device-agnostic access when logged-in session isn't available

PIN is generated per match, shown on the scorekeeper assignment screen, and valid only while match is `in_progress`.

### Scorekeeper UI — Ultimate Frisbee

**Pre-Game Screen:**
- Team A vs Team B
- Scheduled time + field
- Roster lists for both teams (loaded from `players` table)
- "Start Game" button (sets match status → `in_progress`, logs `started_at`)
- Digital disc flip (randomized, result logged)

**Live Scoring Screen:**

Layout: Two team columns side by side, large touch targets.

Each column contains:
- Team name + current score (large)
- "+1 Point" button (opens point-entry modal)
- Active roster scroll

**Point Entry Modal (on "+1 Point" tap):**
```
Who scored? [roster list — tap to select player]
Who assisted? [roster list — tap to select, or "Skip"]
Any turnovers this possession? [+/- counter with player selector]
Any layout D? [player selector]
Callahan? [toggle — auto-sets scorer + no assister]
[CONFIRM POINT] [CANCEL]
```

On confirm:
- Inserts multiple `game_events` rows (goal, assist, any turnovers)
- Triggers `update_match_score_cache()` DB function
- Score updates on all spectator screens via Supabase Realtime < 500ms

**Bottom Bar:**
- Current period indicator (Half 1 / Half 2)
- "Half Time" button → logs period boundary event
- "Hard Cap" toggle → sets `cap_status`, broadcasts cap banner to spectators
- "Undo Last Action" → soft-deletes last event(s) for this match

**Undo Stack:**
- Shows last 3 actions with undo button per action
- Undo = sets `deleted_at` on event(s), triggers score recompute
- Undo available for 10 minutes after event (prevents accidental late undos)

**End Game:**
- "End Game" button → requires confirmation
- Shows final score summary
- Prompts scorekeeper to confirm score is correct
- Sets match status → `complete`
- Triggers bracket advancement check (if applicable)
- Notifies both team captains to submit SOTG

### Score Confirmation Flow
1. Game ends → scorekeeper marks complete
2. Both captains receive in-app notification: "Confirm score: Team A 15 - Team B 11"
3. Each captain taps Confirm or Dispute
4. Both confirm → `score_confirmed_a` + `score_confirmed_b` set true
5. One disputes → `score_dispute = true` → director alerted
6. Director reviews audit log + overrides if needed
7. 30-minute timeout: if captains don't respond, auto-confirm

### Forfeit Handling
- Scorekeeper selects "Forfeit" from game menu
- Selects which team forfeited
- System applies sport-specific forfeit score (from `sport_template.forfeit_score`)
  - Ultimate default: 15-0 (configurable by director)
- `match_status = 'forfeit'`, `forfeit_team_id` set
- Standings calculation uses forfeit score for point differential
- Bracket advancement proceeds normally (opponent advances)

---

## 10. Standings & Tie-Breaker Engine

### Pool Standings Calculation
Standings are recomputed after every game_event via DB trigger and cached in `pool_standings`.

**Win/Loss calculation:**
- Win: team scored more points (or opponent forfeited)
- Loss: team scored fewer points (or team forfeited)
- Draw: equal scores (if sport config allows draws)

**Configured tie-breaker order (this tournament):**
1. Head-to-head record (wins in games between tied teams only)
2. Point differential (points_scored - points_against)
3. Points scored
4. Points against (lower = better)
5. SOTG average score received
6. Director override (manual drag to rank)

**Three-way tie handling:**
```
Step 1: Check head-to-head among ONLY the tied teams
  If one team beat both others → that team ranks higher
  If circular (A beat B, B beat C, C beat A) → advance to step 2
Step 2: Point differential in games among ONLY tied teams
Step 3: Point differential in ALL pool games
Step 4: ... continue through order ...
Step 5: SOTG
Step 6: Director manual override (disc flip / coin toss — director enters result)
```

**Tie display in UI:**
- Tied teams shown with `=` prefix: `=2. Wildcats` / `=2. Eagles`
- Yellow highlight on tied rows
- Tooltip: "Tied — next tiebreaker: Point differential in head-to-head games"

### Bracket Seeding from Pool Results
After all pool games complete, director clicks "Generate Bracket."

Default seeding:
```
1A → Bracket seed 1 (favorable side)
1B → Bracket seed 2 (favorable side, opposite half from 1A)
1C → Bracket seed 3
2A → Bracket seed [N+1]
...
```

Director can manually drag seeds before confirming bracket generation.
Once bracket is confirmed, pool standings are locked (no more edits without director override).

---

## 11. Bracket Engine

### Bracket Tree Structure
Each bracket is a directed acyclic graph (DAG) stored in `bracket_slots`. 
Winner of slot N advances to the `winner_goes_to_slot_id` of that slot.

### Auto-Population
When a match completes:
1. DB trigger checks `matches.winner_next_match_id`
2. Populates `team_a_id` or `team_b_id` on the next match based on `winner_next_slot`
3. If both teams are now set, next match becomes `scheduled`
4. Realtime broadcasts bracket update to all watching

### Visual Bracket Rendering
- Rendered as SVG tree (not a table)
- Each match node shows: Team A vs Team B, score (if complete), time + field
- Teams advance with animation on score update
- Tap any match node → jump to that game's live scoreboard
- Tap any team name → jump to that team's results view
- Zoom + pan on mobile (pinch gesture)
- "Path to Final" mini-map for spectators following a specific team

### TBD State
- Before teams advance, slots show "Winner of Match 12" or "1st Pool A"
- Rendered as empty node with source label
- No scoring input available until both teams confirmed

---

## 12. QR Code & Public Scoreboard System

### QR Strategy: Hybrid
Two types of QR codes per tournament:

**1. Master Tournament QR**
- URL: `[app-url]/t/[tournament_slug]`
- Lives at: entrance, main info board, captain packets
- Shows: tournament home page with all divisions, standings, schedule

**2. Per-Court QR**
- URL: `[app-url]/court/[tournament_id]/[venue_qr_slug]`
- Auto-detects current game: queries for `matches` where `venue_id = X` and `status = 'in_progress'`
- If game in progress → redirect to live scoreboard
- If between games → show "Next game in [N] minutes" + last game result
- If no games scheduled today → show venue schedule

**QR Code Generation:**
- Admin panel "Print QR Codes" button
- Generates printable cards (A5 size) for each court
- Each card: Tournament name, court name, large QR code, "SCAN FOR LIVE SCORES" text
- Download as PDF (all courts in one file)
- Recommended print: matte finish, minimum 15cm × 15cm QR area
- Error correction level: H (30%) — handles partial damage, mud, sunlight

### Public Scoreboard (no login required)
Accessible at: `/t/[tournament_slug]` and `/score/[match_id]`

**Public scoreboard shows:**
- Live score (Team A vs Team B, current score)
- Current period / cap status
- Last 5 scoring events (no player names — team-level only for public)
- Pool standings (abbreviated — wins/losses/points only)
- Next game at this venue
- "Follow this team" prompt → triggers follow wizard

**What requires login:**
- Player-level stats (who scored each point)
- Full event timeline
- Personal followed-teams dashboard
- SOTG scores (totals visible, per-category requires login)
- Incident reports

### Spectator Onboarding Wizard (on QR scan)
Triggered when spectator arrives at `/court/[id]` with no existing session:

```
Screen 1: Live scoreboard (immediate — no friction)
  ↓ (after 3 seconds, slide-up card appears)
  
Screen 2: "Watching [Team A]? Tap to follow them →"
  [Follow Team A] [Follow Team B] [Just watching]
  
Screen 3 (if team followed): 
  "Are there other teams you want to track?"
  Show: all teams in same division as selected team
  Multi-select, "Done"
  
Screen 4:
  "Save your teams across devices? Create a free account"
  [Create Account] [Continue as Guest]
  → Guest: saves followed teams to localStorage + guest_token in Supabase
  → Account: migrates guest_token follows to user_id
  
After wizard: "Your teams" tab appears in bottom nav with live scores
```

---

## 13. Spectator Follow System

### Guest Persistence
- On first visit, generate `guest_token` (UUID v4) and store in `localStorage`
- Create `user_follows` rows with `guest_token` set, `user_id` null
- All follow operations use `guest_token` as identifier
- Token persisted in localStorage key: `athleteOS_guest_token`

### Account Migration
When guest creates account:
```sql
UPDATE user_follows 
SET user_id = [new_user_id], guest_token = NULL
WHERE guest_token = [localStorage_token];
```

### Followed Games Dashboard
Available at: `/dashboard` (requires login) or as tab in public UI (guest)

**Shows:**
- All followed teams' upcoming games (sorted by start time)
- All followed teams' live games (pinned to top with LIVE indicator)
- All followed teams' completed games (score + result)
- Pool standings for divisions containing followed teams
- "Path to Final" for teams still in bracket

**Real-time updates:**
- Subscribe to Supabase Realtime channel filtered to followed team IDs
- Score update → card animates new score
- Game starts → card moves to "LIVE" section with pulsing indicator
- Game ends → card moves to "Completed" with final score

### Team Results View
Accessible by tapping any team name anywhere in the app.

Shows:
- Team info (name, record, pool standing)
- All games played (score, opponent, time, field)
- All upcoming games (time, field, opponent)
- Player stats summary (if logged in)
- SOTG score received (after tournament review phase)

---

## 14. Spirit of the Game (SOTG)

### When SOTG is Submitted
- After match status = `complete`
- Both team captains get notification/prompt
- Window: open until tournament moves to `archived` state
- Director can submit on behalf of a captain

### SOTG Categories (Ultimate Frisbee)
1. Knowledge of Rules
2. Fouls and Body Contact
3. Fair Mindedness
4. Attitude and Self-Control
5. Communication

Each category: 0–4 scale
- 0 = Very Poor
- 1 = Poor
- 2 = Acceptable
- 3 = Good
- 4 = Excellent

Total per game: 0–20

### SOTG Submission UI
- Simple 5-row form, one row per category
- Tap 0–4 buttons per row
- Optional comments field
- Submit button → creates `sotg_scores` row
- Cannot edit after submission (director override only)

### SOTG in Standings
- SOTG average appears in pool standings as 5th tie-breaker
- Displayed on team results page (total received, average per game)
- "Spirit Leaderboard" view available at tournament level
- Per-category breakdown visible only to logged-in users

---

## 15. Real-Time Architecture

### Supabase Realtime Channels

| Channel | Table | Events | Subscribers |
|---|---|---|---|
| `match:[match_id]` | game_events | INSERT | Everyone watching that game |
| `standings:[pool_id]` | pool_standings | UPDATE | Everyone viewing that pool |
| `bracket:[division_id]` | bracket_slots + matches | UPDATE | Everyone viewing bracket |
| `tournament:[tournament_id]` | matches, schedule_delays | INSERT/UPDATE | Everyone on tournament page |
| `dashboard:[user_id]` | matches (filtered) | UPDATE | Logged-in spectator dashboard |

### REPLICA IDENTITY
```sql
-- Required for Supabase Realtime to broadcast old + new values
ALTER TABLE matches REPLICA IDENTITY FULL;
ALTER TABLE game_events REPLICA IDENTITY FULL;
ALTER TABLE pool_standings REPLICA IDENTITY FULL;
ALTER TABLE bracket_slots REPLICA IDENTITY FULL;
ALTER TABLE schedule_delays REPLICA IDENTITY FULL;
```

### Supabase Publication
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE 
  matches, game_events, pool_standings, 
  bracket_slots, schedule_delays, sotg_scores;
```

### Offline Resilience (PWA)
- Register Service Worker on scorekeeper URL
- Cache: match data, roster data, sport config
- On score entry with no connection:
  - Store event in IndexedDB queue
  - Show "Offline — score queued (3 events pending)"
  - On reconnect: flush queue to Supabase in sequence order
  - Conflict detection: if two devices queued events for same match, flag for review

### Performance Targets
- Score update → spectator screen: < 500ms
- Standings update after point scored: < 2 seconds
- Bracket auto-advance after match complete: < 3 seconds
- QR scan → live scoreboard load: < 1.5 seconds

---

## 16. Auth & Roles

### Existing Auth
StatStream already has Supabase Auth + a `profiles` table. The tournament module extends this.

### Extending Profiles
```sql
-- Add tournament-related fields to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  default_sport TEXT,
  tournament_notifications BOOLEAN DEFAULT true,
  guest_token UUID;  -- Links historical guest follows to account
```

### Role Hierarchy

| Role | Create Tournament | Edit Schedule | Enter Scores | View All | SOTG |
|---|---|---|---|---|---|
| Director | ✅ | ✅ | ✅ | ✅ | ✅ |
| Co-Director | ✅ | ✅ | ✅ | ✅ | ✅ |
| Division Manager | ❌ | Own division | ✅ | ✅ | ✅ |
| Scorekeeper | ❌ | ❌ | Assigned games | ✅ | ❌ |
| Captain | ❌ | ❌ | ❌ | ✅ | Own games |
| Logged-in Fan | ❌ | ❌ | ❌ | ✅ (public) | ❌ |
| Guest | ❌ | ❌ | ❌ | ✅ (public) | ❌ |

### Scorekeeper Assignment
Directors can:
- Assign a registered user as scorekeeper for specific matches
- Generate a one-time PIN for a match (no account needed)
- Assign themselves as scorekeeper for all matches

PIN-based scorekeeper flow:
- Navigate to `/score/[match_id]`
- Enter 4-digit PIN
- Session stored in localStorage for duration of match
- PIN expires when match status = `complete`

---

## 17. Component Architecture

### App Structure
```
/src
  /pages
    /director
      TournamentWizard.jsx         -- 8-step wizard container
      WizardStep1Basics.jsx
      WizardStep2Sport.jsx
      WizardStep3Divisions.jsx
      WizardStep4Venues.jsx
      WizardStep5Teams.jsx
      WizardStep6Schedule.jsx
      WizardStep7Constraints.jsx
      WizardStep8Preview.jsx
      ScheduleGrid.jsx             -- Drag-drop schedule editor
      ConstraintReviewPanel.jsx    -- Team-by-team review
      TournamentDashboard.jsx      -- Director HQ during live tournament
      
    /public
      TournamentHome.jsx           -- Master QR landing page
      LiveScoreboard.jsx           -- Per-game scoreboard
      CourtLanding.jsx             -- Court QR landing + auto-redirect
      PoolStandings.jsx            -- Real-time standings table
      BracketView.jsx              -- Visual bracket SVG
      TeamResults.jsx              -- Team passport / results
      SpectatorDashboard.jsx       -- Followed games dashboard
      SpectatorWizard.jsx          -- Follow onboarding wizard
      
    /scorekeeper
      ScorekeeperConsole.jsx       -- Main scoring UI
      PointEntryModal.jsx          -- Per-point stat entry
      PreGameScreen.jsx            -- Roster check + disc flip
      PostGameScreen.jsx           -- Score confirmation
      SOTGEntry.jsx                -- Spirit score submission
      
  /components
    /bracket
      BracketTree.jsx              -- SVG bracket renderer
      BracketNode.jsx              -- Individual match node
      BracketConnector.jsx         -- SVG lines between nodes
    /scores
      LiveScoreCard.jsx            -- Score display card (used everywhere)
      EventFeed.jsx                -- Scrolling event timeline
      ScoreBadge.jsx               -- Compact inline score
    /standings
      PoolStandingsTable.jsx       -- Full standings table
      MiniStandings.jsx            -- Compact for sidebar
      TiebreakerTooltip.jsx        -- "Why are they tied?" explainer
    /schedule
      ScheduleGrid.jsx             -- Drag-drop schedule editor
      GameCard.jsx                 -- Match card for schedule grid
      ConflictBadge.jsx            -- Red/yellow conflict indicator
    /qr
      QRCodeCard.jsx               -- Printable QR card component
      QRPDFExport.jsx              -- Generate PDF of all court QRs
    /wizard
      WizardProgress.jsx           -- Step indicator
      PoolBuilder.jsx              -- Pool assignment drag UI
      TeamCard.jsx                 -- Team entry card
      TeamPassport.jsx             -- Constraint review card
      FormatRecommender.jsx        -- Format suggestion UI

  /hooks
    useRealtime.js                 -- Supabase Realtime subscription manager
    useMatch.js                    -- Match data + live updates
    useStandings.js                -- Pool standings with tie-breaker display
    useBracket.js                  -- Bracket tree data
    useFollows.js                  -- Guest + user follow management
    useTournament.js               -- Tournament + division data
    useScorekeeper.js              -- Score entry logic + undo stack
    
  /lib
    supabase.js                    -- Supabase client
    formatEngine.js                -- Pool/bracket generation algorithms
    tiebreaker.js                  -- Tie-breaker calculation logic
    scheduleGenerator.js           -- Semi-auto schedule generation
    qrGenerator.js                 -- QR code URL generation
    sportConfig.js                 -- Sport template helpers
    offlineQueue.js                -- IndexedDB queue for offline scoring
```

---

## 18. Build Order & Priority

### Week 1 — Foundation (Days 1–5)
Non-negotiable. Nothing else works without this.

1. **Supabase migration** — run all schema SQL, enable RLS, seed sport templates
2. **Auth extension** — add tournament_roles table, extend profiles
3. **Tournament + Division CRUD** — basic director create/edit
4. **Wizard Steps 1–4** — Basics, Sport, Divisions, Venues
5. **Team entry** — manual + CSV import
6. **Pool assignment** — auto-seeding + drag to adjust

### Week 2 — Scheduling & Scoring (Days 6–10)

7. **Schedule generation** — semi-auto algorithm + grid display
8. **Drag-to-adjust schedule** — conflict detection
9. **Constraint review panel** — team passport view
10. **Publish flow** — state transition + QR generation
11. **Scorekeeper console** — pre-game, live scoring, point entry modal
12. **Game events pipeline** — insert events → trigger → cache score update
13. **Undo stack** — soft delete events
14. **Realtime score broadcasting** — Supabase channel setup

### Week 3 — Public Facing (Days 11–15)

15. **Public scoreboard** — live score card + event feed
16. **Court QR landing** — auto-detect active game
17. **Pool standings** — real-time table with tie-breakers
18. **Spectator follow wizard** — guest token + localStorage
19. **Spectator dashboard** — followed games view
20. **SOTG entry** — captain submission form
21. **QR PDF export** — printable court cards
22. **Bracket generation** — from pool results
23. **Visual bracket** — SVG tree
24. **Bracket auto-advance** — DB trigger + Realtime broadcast

### Pre-Tournament Checklist
- [ ] All sport template seeds applied
- [ ] RLS policies tested for all 4 user types
- [ ] Realtime REPLICA IDENTITY set on all tables
- [ ] Court QR URLs validated end-to-end
- [ ] Scorekeeper PIN flow tested on mobile
- [ ] Offline queue tested (airplane mode scoring)
- [ ] Score confirmation flow tested
- [ ] SOTG submission flow tested
- [ ] Bracket generation tested with 14, 16, and 20 teams
- [ ] Delay broadcast tested (all spectator screens update)
- [ ] Load test: 50 concurrent spectators on one game

---

## 19. Ultimate Frisbee Sport Config Reference

Complete config to seed into `sport_templates` at deployment:

```json
{
  "slug": "ultimate_frisbee",
  "display_name": "Ultimate Frisbee",
  "config": {
    "score_type": "point_by_point",
    "win_condition": {
      "type": "first_to",
      "value": 15,
      "cap_enabled": true,
      "soft_cap_add": 2,
      "hard_cap_add": 1
    },
    "periods": [
      { "id": "h1", "name": "First Half", "ends_at_score": 8 },
      { "id": "h2", "name": "Second Half" }
    ],
    "time_limits": {
      "soft_cap_minutes": 75,
      "hard_cap_minutes": 90
    },
    "draw_allowed": false,
    "overtime": null,
    "forfeit_score": { "winner": 15, "loser": 0 },
    "stats": [
      { "id": "goal", "label": "Goal", "short": "G", "adds_to_score": 1, "is_player_stat": true, "is_negative": false, "category": "scoring", "icon": "disc" },
      { "id": "assist", "label": "Assist", "short": "A", "adds_to_score": 0, "is_player_stat": true, "is_negative": false, "category": "scoring", "icon": "arrow-up" },
      { "id": "callahan", "label": "Callahan", "short": "CAL", "adds_to_score": 1, "is_player_stat": true, "is_negative": false, "category": "scoring", "icon": "star" },
      { "id": "layout_d", "label": "Layout D", "short": "LD", "adds_to_score": 0, "is_player_stat": true, "is_negative": false, "category": "defense", "icon": "shield" },
      { "id": "d_block", "label": "D Block", "short": "D", "adds_to_score": 0, "is_player_stat": true, "is_negative": false, "category": "defense", "icon": "hand" },
      { "id": "turnover", "label": "Turnover", "short": "T", "adds_to_score": 0, "is_player_stat": true, "is_negative": true, "category": "disc", "icon": "x" },
      { "id": "drop", "label": "Drop", "short": "DR", "adds_to_score": 0, "is_player_stat": true, "is_negative": true, "category": "disc", "icon": "arrow-down" },
      { "id": "stall", "label": "Stall Out", "short": "ST", "adds_to_score": 0, "is_player_stat": false, "is_negative": true, "category": "disc", "icon": "clock" },
      { "id": "throwaway", "label": "Throwaway", "short": "TA", "adds_to_score": 0, "is_player_stat": true, "is_negative": true, "category": "disc", "icon": "x-circle" }
    ],
    "sotg_enabled": true,
    "sotg_categories": [
      "Knowledge of Rules",
      "Fouls and Body Contact",
      "Fair Mindedness",
      "Attitude and Self-Control",
      "Communication"
    ],
    "sotg_scale": { "min": 0, "max": 4 },
    "sotg_labels": {
      "0": "Very Poor",
      "1": "Poor",
      "2": "Acceptable",
      "3": "Good",
      "4": "Excellent"
    }
  }
}
```

---

## 20. Open Questions & Deferred Decisions

These are NOT blocking Phase 1 but must be decided before Phase 2 build begins:

| # | Question | Impact | Decision Needed By |
|---|---|---|---|
| 1 | USAU export format — exact CSV column spec? | Governing body export feature | Phase 2 start |
| 2 | Player accounts — can players self-register to a roster? Or director-only? | Player stats + career tracking | Phase 2 start |
| 3 | Cross-tournament player identity — email match or manual link? | athleteOS career stats | Phase 2 start |
| 4 | SMS notifications — which provider? (Twilio recommended) | Spectator alerts | Phase 2 start |
| 5 | Tournament registration / team fees — integrate Stripe or external? | Registration flow | Phase 2 |
| 6 | Can a tournament have multiple directors from different orgs? | Multi-org support | Phase 2 |
| 7 | Stat leaderboards — public by default or opt-in per tournament? | Privacy implications | Phase 2 |
| 8 | Video storage — Supabase Storage or external (Cloudflare R2)? | AI stat tracking | Phase 3 |
| 9 | HandRaise integration — do sessions share the athleteOS auth model? | Platform unification | TBD |
| 10 | Mobile app (React Native) vs PWA — when does mobile become priority? | Spectator + scorekeeper UX | After Phase 2 |

---

*Document Status: LOCKED for Phase 1 build*
*Last Updated: Pre-build specification review*
*Next Review: After first tournament — retrospective amendments only*
