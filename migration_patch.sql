-- =============================================================
-- athleteOS — Tournament Module
-- PATCH: Run this in Supabase SQL Editor
--
-- Picks up where migration.sql died (after tournament_teams).
-- Sections 1–8 already ran fine. This covers 9–24 with all
-- bugs fixed:
--   • players → tournament_players (avoids StatStream conflict)
--   • game_events FKs updated accordingly
--   • fn_advance_bracket: DECLARE moved to function top
--   • fn_update_score_cache: OLD reference fixed, duplicates removed
--   • updated_at loop: 'players' reference removed
-- =============================================================


-- =============================================================
-- SECTION 9: TOURNAMENT PLAYERS
-- =============================================================

CREATE TABLE IF NOT EXISTS tournament_players (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_team_id    UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  number                TEXT,
  user_id               UUID REFERENCES auth.users(id),
  waiver_signed         BOOLEAN DEFAULT false,
  waiver_signed_at      TIMESTAMPTZ,
  is_eligible           BOOLEAN DEFAULT true,
  ineligibility_reason  TEXT,
  suspension_games      INTEGER DEFAULT 0,
  sort_order            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_team ON tournament_players(tournament_team_id);
CREATE INDEX IF NOT EXISTS idx_tp_user ON tournament_players(user_id);

ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tp_public_read" ON tournament_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_teams tt
      JOIN tournaments t ON tt.tournament_id = t.id
      WHERE tt.id = tournament_players.tournament_team_id
      AND t.is_public = true
      AND t.status IN ('published','live','review','archived')
    )
  );

CREATE POLICY "tp_director_all" ON tournament_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournament_teams tt
      JOIN tournaments t ON tt.tournament_id = t.id
      WHERE tt.id = tournament_players.tournament_team_id
      AND t.director_id = auth.uid()
    )
  );

CREATE POLICY "tp_role_read" ON tournament_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_teams tt
      JOIN tournament_roles tr ON tr.tournament_id = tt.tournament_id
      WHERE tt.id = tournament_players.tournament_team_id
      AND tr.user_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 10: TOURNAMENT ROLES
-- =============================================================

CREATE TABLE IF NOT EXISTS tournament_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  role          TEXT NOT NULL CHECK (role IN (
                  'director','co_director','scorekeeper',
                  'division_manager','captain'
                )),
  division_id         UUID REFERENCES divisions(id),
  team_id             UUID REFERENCES tournament_teams(id),
  assigned_match_ids  UUID[],
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, user_id, role, team_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_tournament ON tournament_roles(tournament_id);
CREATE INDEX IF NOT EXISTS idx_roles_user       ON tournament_roles(user_id);

ALTER TABLE tournament_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_director_all" ON tournament_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_roles.tournament_id
      AND t.director_id = auth.uid()
    )
  );

CREATE POLICY "roles_self_read" ON tournament_roles
  FOR SELECT USING (user_id = auth.uid());


-- =============================================================
-- SECTION 11: MATCHES
-- =============================================================

CREATE TABLE IF NOT EXISTS matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id         UUID NOT NULL REFERENCES tournaments(id),
  division_id           UUID NOT NULL REFERENCES divisions(id),
  phase                 INTEGER DEFAULT 1,
  round                 INTEGER,
  match_number          INTEGER,
  pool_id               UUID REFERENCES pools(id),
  bracket_position      TEXT,
  bracket_slot          INTEGER,
  winner_next_match_id  UUID REFERENCES matches(id),
  loser_next_match_id   UUID REFERENCES matches(id),
  winner_next_slot      TEXT CHECK (winner_next_slot IN ('team_a','team_b')),
  loser_next_slot       TEXT CHECK (loser_next_slot IN ('team_a','team_b')),
  team_a_id             UUID REFERENCES tournament_teams(id),
  team_b_id             UUID REFERENCES tournament_teams(id),
  is_bye                BOOLEAN DEFAULT false,
  time_slot_id          UUID REFERENCES time_slots(id),
  venue_id              UUID REFERENCES venues(id),
  score_a               INTEGER DEFAULT 0,
  score_b               INTEGER DEFAULT 0,
  period_scores         JSONB DEFAULT '[]',
  winner_id             UUID REFERENCES tournament_teams(id),
  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                          'scheduled','in_progress','complete',
                          'forfeit','cancelled','postponed'
                        )),
  forfeit_team_id       UUID REFERENCES tournament_teams(id),
  forfeit_score_override JSONB,
  cap_status            TEXT CHECK (cap_status IN ('soft_cap','hard_cap')),
  cap_triggered_at      TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  score_confirmed_a     BOOLEAN DEFAULT false,
  score_confirmed_b     BOOLEAN DEFAULT false,
  score_confirmed_at    TIMESTAMPTZ,
  score_dispute         BOOLEAN DEFAULT false,
  score_dispute_notes   TEXT,
  scorekeeper_id        UUID REFERENCES auth.users(id),
  scorekeeper_pin       TEXT,
  round_label           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament  ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_division    ON matches(division_id);
CREATE INDEX IF NOT EXISTS idx_matches_pool        ON matches(pool_id);
CREATE INDEX IF NOT EXISTS idx_matches_status      ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_venue       ON matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_matches_timeslot    ON matches(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_a      ON matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_b      ON matches(team_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_live        ON matches(status) WHERE status = 'in_progress';

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches REPLICA IDENTITY FULL;

CREATE POLICY "matches_public_read" ON matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = matches.tournament_id
      AND t.is_public = true
      AND t.status IN ('published','live','review','archived')
    )
  );

CREATE POLICY "matches_director_all" ON matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = matches.tournament_id
      AND t.director_id = auth.uid()
    )
  );

CREATE POLICY "matches_scorekeeper_update" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournament_roles tr
      WHERE tr.user_id = auth.uid()
      AND tr.tournament_id = matches.tournament_id
      AND tr.role = 'scorekeeper'
      AND (
        matches.id = ANY(tr.assigned_match_ids)
        OR matches.scorekeeper_id = auth.uid()
      )
    )
  );


-- =============================================================
-- SECTION 12: GAME EVENTS
-- NOTE: FKs point to tournament_players, not players
-- =============================================================

CREATE TABLE IF NOT EXISTS game_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  stat_id               TEXT NOT NULL,
  team_id               UUID NOT NULL REFERENCES tournament_teams(id),
  player_id             UUID REFERENCES tournament_players(id),
  secondary_player_id   UUID REFERENCES tournament_players(id),
  secondary_stat_id     TEXT,
  score_a_after         INTEGER,
  score_b_after         INTEGER,
  period_after          INTEGER DEFAULT 1,
  game_time_seconds     INTEGER,
  event_timestamp       TIMESTAMPTZ DEFAULT now(),
  source                TEXT DEFAULT 'manual'
                        CHECK (source IN ('manual','ai_auto','ai_assisted','catchup')),
  is_verified           BOOLEAN DEFAULT true,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID REFERENCES auth.users(id),
  sequence              INTEGER,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_match  ON game_events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_team   ON game_events(team_id);
CREATE INDEX IF NOT EXISTS idx_events_player ON game_events(player_id);
CREATE INDEX IF NOT EXISTS idx_events_active ON game_events(match_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_seq    ON game_events(match_id, sequence);

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events REPLICA IDENTITY FULL;

CREATE POLICY "events_public_read" ON game_events
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = game_events.match_id
      AND m.status IN ('in_progress','complete','forfeit')
      AND t.is_public = true
      AND t.status IN ('live','review','archived')
    )
  );

CREATE POLICY "events_scorekeeper_insert" ON game_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = game_events.match_id
      AND m.status = 'in_progress'
      AND (
        m.scorekeeper_id = auth.uid()
        OR t.director_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM tournament_roles tr
          WHERE tr.user_id = auth.uid()
          AND tr.tournament_id = m.tournament_id
          AND tr.role IN ('scorekeeper','co_director')
          AND (game_events.match_id = ANY(tr.assigned_match_ids) OR tr.role = 'co_director')
        )
      )
    )
  );

CREATE POLICY "events_scorekeeper_undo" ON game_events
  FOR UPDATE USING (created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (deleted_at IS NOT NULL);

CREATE POLICY "events_director_undo" ON game_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = game_events.match_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 13: SCORE AUDIT LOG
-- =============================================================

CREATE TABLE IF NOT EXISTS score_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id),
  changed_by        UUID REFERENCES auth.users(id),
  old_score_a       INTEGER,
  old_score_b       INTEGER,
  new_score_a       INTEGER,
  new_score_b       INTEGER,
  trigger_event_id  UUID REFERENCES game_events(id),
  change_reason     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_match ON score_audit_log(match_id);

ALTER TABLE score_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_director_read" ON score_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = score_audit_log.match_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 14: SOTG SCORES
-- =============================================================

CREATE TABLE IF NOT EXISTS sotg_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id),
  scoring_team_id   UUID NOT NULL REFERENCES tournament_teams(id),
  scored_team_id    UUID NOT NULL REFERENCES tournament_teams(id),
  category_scores   INTEGER[] NOT NULL,
  total_score       INTEGER,
  comments          TEXT,
  submitted_by      UUID NOT NULL REFERENCES auth.users(id),
  submitted_at      TIMESTAMPTZ DEFAULT now(),
  is_override       BOOLEAN DEFAULT false,
  override_reason   TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, scoring_team_id)
);

CREATE INDEX IF NOT EXISTS idx_sotg_match       ON sotg_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_sotg_scored_team ON sotg_scores(scored_team_id);

ALTER TABLE sotg_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sotg_scores REPLICA IDENTITY FULL;

CREATE POLICY "sotg_public_totals_read" ON sotg_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = sotg_scores.match_id
      AND t.is_public = true
      AND t.status IN ('review','archived')
    )
  );

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

CREATE POLICY "sotg_director_all" ON sotg_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = sotg_scores.match_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 15: POOL STANDINGS
-- =============================================================

CREATE TABLE IF NOT EXISTS pool_standings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES tournament_teams(id),
  games_played    INTEGER DEFAULT 0,
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  draws           INTEGER DEFAULT 0,
  points_scored   INTEGER DEFAULT 0,
  points_against  INTEGER DEFAULT 0,
  point_diff      INTEGER DEFAULT 0,
  sotg_total      DECIMAL(5,2) DEFAULT 0,
  sotg_games      INTEGER DEFAULT 0,
  sotg_average    DECIMAL(4,2) DEFAULT 0,
  rank            INTEGER,
  is_tied         BOOLEAN DEFAULT false,
  tied_with       UUID[],
  tie_resolved_by TEXT,
  advances_to_bracket BOOLEAN DEFAULT false,
  bracket_seed        INTEGER,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pool_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_pool ON pool_standings(pool_id);
CREATE INDEX IF NOT EXISTS idx_standings_rank ON pool_standings(pool_id, rank);

ALTER TABLE pool_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_standings REPLICA IDENTITY FULL;

CREATE POLICY "standings_public_read" ON pool_standings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pools p
      JOIN divisions d ON p.division_id = d.id
      JOIN tournaments t ON d.tournament_id = t.id
      WHERE p.id = pool_standings.pool_id
      AND t.is_public = true
      AND t.status IN ('published','live','review','archived')
    )
  );

CREATE POLICY "standings_director_all" ON pool_standings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pools p
      JOIN divisions d ON p.division_id = d.id
      JOIN tournaments t ON d.tournament_id = t.id
      WHERE p.id = pool_standings.pool_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 16: BRACKET SLOTS
-- =============================================================

CREATE TABLE IF NOT EXISTS bracket_slots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id             UUID NOT NULL REFERENCES divisions(id),
  phase                   INTEGER DEFAULT 2,
  round                   INTEGER NOT NULL,
  position                INTEGER NOT NULL,
  label                   TEXT,
  bracket_side            TEXT CHECK (bracket_side IN ('winners','losers','consolation')),
  team_a_id               UUID REFERENCES tournament_teams(id),
  team_b_id               UUID REFERENCES tournament_teams(id),
  team_a_source           TEXT,
  team_b_source           TEXT,
  match_id                UUID REFERENCES matches(id),
  winner_goes_to_slot_id  UUID REFERENCES bracket_slots(id),
  loser_goes_to_slot_id   UUID REFERENCES bracket_slots(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division_id, phase, round, position)
);

CREATE INDEX IF NOT EXISTS idx_bracket_division ON bracket_slots(division_id);

ALTER TABLE bracket_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_slots REPLICA IDENTITY FULL;

CREATE POLICY "bracket_public_read" ON bracket_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON d.tournament_id = t.id
      WHERE d.id = bracket_slots.division_id
      AND t.is_public = true
      AND t.status IN ('published','live','review','archived')
    )
  );

CREATE POLICY "bracket_director_all" ON bracket_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON d.tournament_id = t.id
      WHERE d.id = bracket_slots.division_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 17: USER FOLLOWS
-- =============================================================

CREATE TABLE IF NOT EXISTS user_follows (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id),
  guest_token           UUID,
  tournament_team_id    UUID REFERENCES tournament_teams(id),
  match_id              UUID REFERENCES matches(id),
  tournament_id         UUID REFERENCES tournaments(id),
  notify_score_updates  BOOLEAN DEFAULT true,
  notify_game_start     BOOLEAN DEFAULT true,
  notify_next_game      BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_follows_user  ON user_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_guest ON user_follows(guest_token);
CREATE INDEX IF NOT EXISTS idx_follows_team  ON user_follows(tournament_team_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_user_manage" ON user_follows
  FOR ALL USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND guest_token IS NOT NULL)
  );


-- =============================================================
-- SECTION 18: INCIDENT REPORTS
-- =============================================================

CREATE TABLE IF NOT EXISTS incident_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  match_id      UUID REFERENCES matches(id),
  venue_id      UUID REFERENCES venues(id),
  type          TEXT NOT NULL CHECK (type IN (
                  'injury','weather','field_condition','dispute',
                  'equipment','need_water','need_medic','other'
                )),
  description   TEXT,
  reported_by   UUID NOT NULL REFERENCES auth.users(id),
  reported_at   TIMESTAMPTZ DEFAULT now(),
  resolved          BOOLEAN DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES auth.users(id),
  resolution_notes  TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_tournament ON incident_reports(tournament_id);
CREATE INDEX IF NOT EXISTS idx_incidents_unresolved ON incident_reports(tournament_id)
  WHERE resolved = false;

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports REPLICA IDENTITY FULL;

CREATE POLICY "incidents_director_all" ON incident_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = incident_reports.tournament_id
      AND t.director_id = auth.uid()
    )
  );

CREATE POLICY "incidents_scorekeeper_insert" ON incident_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_roles tr
      WHERE tr.user_id = auth.uid()
      AND tr.tournament_id = incident_reports.tournament_id
      AND tr.role IN ('scorekeeper','director','co_director','division_manager')
    )
  );


-- =============================================================
-- SECTION 19: SCHEDULE DELAYS
-- =============================================================

CREATE TABLE IF NOT EXISTS schedule_delays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id),
  venue_id        UUID REFERENCES venues(id),
  offset_minutes  INTEGER NOT NULL,
  reason          TEXT,
  applies_from    TIMESTAMPTZ NOT NULL,
  announced_by    UUID REFERENCES auth.users(id),
  announced_at    TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_delays_tournament ON schedule_delays(tournament_id);
CREATE INDEX IF NOT EXISTS idx_delays_active     ON schedule_delays(tournament_id)
  WHERE is_active = true;

ALTER TABLE schedule_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_delays REPLICA IDENTITY FULL;

CREATE POLICY "delays_public_read" ON schedule_delays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = schedule_delays.tournament_id
      AND t.is_public = true
    )
  );

CREATE POLICY "delays_director_all" ON schedule_delays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = schedule_delays.tournament_id
      AND t.director_id = auth.uid()
    )
  );


-- =============================================================
-- SECTION 20: REALTIME PUBLICATION
-- =============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE
  matches,
  game_events,
  pool_standings,
  bracket_slots,
  schedule_delays,
  sotg_scores,
  incident_reports;


-- =============================================================
-- SECTION 21: TRIGGERS
-- =============================================================

-- -------------------------------------------------------
-- 21a. Auto-advance bye matches
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auto_advance_bye()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_bye = true
     AND NEW.team_a_id IS NOT NULL
     AND NEW.status = 'scheduled'
  THEN
    UPDATE matches SET
      winner_id    = NEW.team_a_id,
      score_a      = 0,
      score_b      = 0,
      status       = 'complete',
      completed_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_auto_advance_bye ON matches;
CREATE TRIGGER trig_auto_advance_bye
  AFTER INSERT OR UPDATE OF team_a_id, is_bye ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_auto_advance_bye();


-- -------------------------------------------------------
-- 21b. Auto-advance bracket on match complete
-- FIX: DECLARE moved to function top (was inside IF — illegal)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_advance_bracket()
RETURNS TRIGGER AS $$
DECLARE
  loser_id UUID;
BEGIN
  IF NEW.status = 'complete'
     AND (OLD.status IS DISTINCT FROM 'complete')
     AND NEW.winner_id IS NOT NULL
  THEN
    IF NEW.winner_next_match_id IS NOT NULL THEN
      IF NEW.winner_next_slot = 'team_a' THEN
        UPDATE matches SET team_a_id = NEW.winner_id
        WHERE id = NEW.winner_next_match_id;
      ELSE
        UPDATE matches SET team_b_id = NEW.winner_id
        WHERE id = NEW.winner_next_match_id;
      END IF;
    END IF;

    IF NEW.loser_next_match_id IS NOT NULL THEN
      loser_id := CASE
        WHEN NEW.winner_id = NEW.team_a_id THEN NEW.team_b_id
        ELSE NEW.team_a_id
      END;

      IF loser_id IS NOT NULL THEN
        IF NEW.loser_next_slot = 'team_a' THEN
          UPDATE matches SET team_a_id = loser_id
          WHERE id = NEW.loser_next_match_id;
        ELSE
          UPDATE matches SET team_b_id = loser_id
          WHERE id = NEW.loser_next_match_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_advance_bracket ON matches;
CREATE TRIGGER trig_advance_bracket
  AFTER UPDATE OF status ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_advance_bracket();


-- -------------------------------------------------------
-- 21c. Recompute pool standings
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recompute_standings(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
  v_pool_id   UUID;
  v_team_a_id UUID;
  v_team_b_id UUID;
  v_status    TEXT;
BEGIN
  SELECT pool_id, team_a_id, team_b_id, status
  INTO v_pool_id, v_team_a_id, v_team_b_id, v_status
  FROM matches WHERE id = p_match_id;

  IF v_pool_id IS NULL THEN RETURN; END IF;
  IF v_status NOT IN ('complete','forfeit') THEN RETURN; END IF;

  INSERT INTO pool_standings (pool_id, team_id)
  VALUES (v_pool_id, v_team_a_id)
  ON CONFLICT (pool_id, team_id) DO NOTHING;

  INSERT INTO pool_standings (pool_id, team_id)
  VALUES (v_pool_id, v_team_b_id)
  ON CONFLICT (pool_id, team_id) DO NOTHING;

  UPDATE pool_standings ps
  SET
    games_played   = agg.gp,
    wins           = agg.w,
    losses         = agg.l,
    draws          = agg.d,
    points_scored  = agg.pf,
    points_against = agg.pa,
    point_diff     = agg.pf - agg.pa,
    updated_at     = now()
  FROM (
    SELECT
      team_id,
      COUNT(*)                                    AS gp,
      SUM(CASE WHEN won   THEN 1 ELSE 0 END)      AS w,
      SUM(CASE WHEN lost  THEN 1 ELSE 0 END)      AS l,
      SUM(CASE WHEN drawn THEN 1 ELSE 0 END)      AS d,
      SUM(pf)                                     AS pf,
      SUM(pa)                                     AS pa
    FROM (
      SELECT team_a_id AS team_id,
             score_a > score_b AS won, score_a < score_b AS lost, score_a = score_b AS drawn,
             score_a AS pf, score_b AS pa
      FROM matches
      WHERE pool_id = v_pool_id AND status IN ('complete','forfeit')
        AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
      UNION ALL
      SELECT team_b_id AS team_id,
             score_b > score_a AS won, score_b < score_a AS lost, score_b = score_a AS drawn,
             score_b AS pf, score_a AS pa
      FROM matches
      WHERE pool_id = v_pool_id AND status IN ('complete','forfeit')
        AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
    ) combined
    GROUP BY team_id
  ) agg
  WHERE ps.pool_id = v_pool_id AND ps.team_id = agg.team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_trigger_recompute_standings()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM fn_recompute_standings(COALESCE(NEW.match_id, OLD.match_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_standings_on_event ON game_events;
CREATE TRIGGER trig_standings_on_event
  AFTER INSERT OR UPDATE ON game_events
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_recompute_standings();


-- -------------------------------------------------------
-- 21d. Cache score on matches
-- FIX: removed duplicate SELECT, fixed OLD ref on INSERT
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_score_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_match_id   UUID;
  v_old_a      INTEGER;
  v_old_b      INTEGER;
  v_new_a      INTEGER;
  v_new_b      INTEGER;
  v_changed_by UUID;
  v_event_id   UUID;
  v_reason     TEXT;
BEGIN
  v_match_id   := NEW.match_id;
  v_changed_by := NEW.created_by;
  v_event_id   := NEW.id;

  SELECT score_a, score_b INTO v_old_a, v_old_b
  FROM matches WHERE id = v_match_id;

  -- Use the latest active event's score_after as the source of truth
  SELECT score_a_after, score_b_after INTO v_new_a, v_new_b
  FROM game_events
  WHERE match_id = v_match_id
    AND deleted_at IS NULL
    AND score_a_after IS NOT NULL
  ORDER BY sequence DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- If all scoring events were undone, reset to 0
  v_new_a := COALESCE(v_new_a, 0);
  v_new_b := COALESCE(v_new_b, 0);

  IF v_new_a IS DISTINCT FROM COALESCE(v_old_a, -1)
  OR v_new_b IS DISTINCT FROM COALESCE(v_old_b, -1) THEN

    UPDATE matches
    SET score_a = v_new_a, score_b = v_new_b, updated_at = now()
    WHERE id = v_match_id;

    v_reason := CASE
      WHEN TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL THEN 'undo'
      WHEN TG_OP = 'INSERT' THEN 'score_event'
      ELSE 'correction'
    END;

    INSERT INTO score_audit_log (
      match_id, changed_by, old_score_a, old_score_b,
      new_score_a, new_score_b, trigger_event_id, change_reason
    ) VALUES (
      v_match_id, v_changed_by, v_old_a, v_old_b,
      v_new_a, v_new_b, v_event_id, v_reason
    );

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_score_cache ON game_events;
CREATE TRIGGER trig_score_cache
  AFTER INSERT OR UPDATE ON game_events
  FOR EACH ROW EXECUTE FUNCTION fn_update_score_cache();


-- -------------------------------------------------------
-- 21e. Updated_at timestamps
-- FIX: removed 'players' from list (table no longer exists by that name)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tournaments','divisions','venues','time_slots','pools',
    'tournament_teams','tournament_players','matches','sotg_scores','pool_standings'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trig_updated_at ON %I;
      CREATE TRIGGER trig_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;


-- =============================================================
-- SECTION 22: HELPER VIEWS
-- =============================================================

CREATE OR REPLACE VIEW active_matches_by_venue AS
SELECT
  m.id AS match_id, m.tournament_id, m.venue_id,
  v.qr_slug AS venue_qr_slug, v.name AS venue_name,
  m.status, m.score_a, m.score_b, m.cap_status,
  ta.name AS team_a_name, tb.name AS team_b_name,
  ta.primary_color AS team_a_color, tb.primary_color AS team_b_color,
  ts.scheduled_start, ts.offset_minutes
FROM matches m
JOIN venues v ON m.venue_id = v.id
LEFT JOIN tournament_teams ta ON m.team_a_id = ta.id
LEFT JOIN tournament_teams tb ON m.team_b_id = tb.id
LEFT JOIN time_slots ts ON m.time_slot_id = ts.id
WHERE m.status IN ('scheduled','in_progress');

CREATE OR REPLACE VIEW pool_standings_display AS
SELECT
  ps.*, tt.name AS team_name, tt.short_name AS team_short_name,
  tt.primary_color, tt.logo_url,
  p.name AS pool_name, p.short_name AS pool_short_name,
  d.name AS division_name, d.id AS division_id
FROM pool_standings ps
JOIN tournament_teams tt ON ps.team_id = tt.id
JOIN pools p ON ps.pool_id = p.id
JOIN divisions d ON p.division_id = d.id;

CREATE OR REPLACE VIEW team_schedule AS
SELECT
  m.id AS match_id, m.tournament_id,
  CASE WHEN m.team_a_id = tt.id THEN m.team_b_id ELSE m.team_a_id END AS opponent_id,
  CASE WHEN m.team_a_id = tt.id THEN opp.name  ELSE opp2.name END AS opponent_name,
  CASE WHEN m.team_a_id = tt.id THEN m.score_a ELSE m.score_b END AS team_score,
  CASE WHEN m.team_a_id = tt.id THEN m.score_b ELSE m.score_a END AS opp_score,
  m.status, m.winner_id, m.winner_id = tt.id AS team_won,
  ts.scheduled_start, v.name AS venue_name,
  m.round_label, m.phase, tt.id AS team_id
FROM matches m
JOIN tournament_teams tt ON (m.team_a_id = tt.id OR m.team_b_id = tt.id)
LEFT JOIN tournament_teams opp  ON opp.id  = m.team_b_id
LEFT JOIN tournament_teams opp2 ON opp2.id = m.team_a_id
LEFT JOIN time_slots ts ON m.time_slot_id = ts.id
LEFT JOIN venues v ON m.venue_id = v.id
WHERE m.status != 'cancelled';


-- =============================================================
-- SECTION 23: SPORT TEMPLATE SEEDS
-- =============================================================

INSERT INTO sport_templates (slug, display_name, config) VALUES
('ultimate_frisbee', 'Ultimate Frisbee', '{
  "score_type": "point_by_point",
  "win_condition": { "type": "first_to", "value": 15, "cap_enabled": true, "soft_cap_add": 2, "hard_cap_add": 1 },
  "periods": [
    { "id": "h1", "name": "First Half", "ends_at_score": 8 },
    { "id": "h2", "name": "Second Half" }
  ],
  "time_limits": { "soft_cap_minutes": 75, "hard_cap_minutes": 90 },
  "draw_allowed": false,
  "overtime": null,
  "forfeit_score": { "winner": 15, "loser": 0 },
  "default_game_duration_minutes": 90,
  "default_break_minutes": 30,
  "stats": [
    { "id": "goal",      "label": "Goal",      "short": "G",   "adds_to_score": true,  "is_player_stat": true,  "is_negative": false, "category": "scoring", "icon": "disc",       "default_enabled": true  },
    { "id": "assist",    "label": "Assist",    "short": "A",   "adds_to_score": false, "is_player_stat": true,  "is_negative": false, "category": "scoring", "icon": "arrow-up",   "default_enabled": true  },
    { "id": "callahan",  "label": "Callahan",  "short": "CAL", "adds_to_score": true,  "is_player_stat": true,  "is_negative": false, "category": "scoring", "icon": "star",       "default_enabled": true  },
    { "id": "layout_d",  "label": "Layout D",  "short": "LD",  "adds_to_score": false, "is_player_stat": true,  "is_negative": false, "category": "defense", "icon": "shield",     "default_enabled": true  },
    { "id": "d_block",   "label": "D Block",   "short": "D",   "adds_to_score": false, "is_player_stat": true,  "is_negative": false, "category": "defense", "icon": "hand",       "default_enabled": true  },
    { "id": "turnover",  "label": "Turnover",  "short": "T",   "adds_to_score": false, "is_player_stat": true,  "is_negative": true,  "category": "disc",    "icon": "x",          "default_enabled": true  },
    { "id": "drop",      "label": "Drop",      "short": "DR",  "adds_to_score": false, "is_player_stat": true,  "is_negative": true,  "category": "disc",    "icon": "arrow-down", "default_enabled": true  },
    { "id": "throwaway", "label": "Throwaway", "short": "TA",  "adds_to_score": false, "is_player_stat": true,  "is_negative": true,  "category": "disc",    "icon": "x-circle",   "default_enabled": true  },
    { "id": "stall",     "label": "Stall Out", "short": "ST",  "adds_to_score": false, "is_player_stat": false, "is_negative": true,  "category": "disc",    "icon": "clock",      "default_enabled": false }
  ],
  "sotg_enabled": true,
  "sotg_categories": ["Knowledge of Rules","Fouls and Body Contact","Fair Mindedness","Attitude and Self-Control","Communication"],
  "sotg_scale": { "min": 0, "max": 4 },
  "sotg_labels": { "0": "Very Poor", "1": "Poor", "2": "Acceptable", "3": "Good", "4": "Excellent" }
}')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, config = EXCLUDED.config, updated_at = now();

INSERT INTO sport_templates (slug, display_name, config) VALUES
('basketball', 'Basketball', '{
  "score_type": "cumulative",
  "win_condition": { "type": "most_after_periods", "cap_enabled": false },
  "periods": [{"id":"q1","name":"Q1"},{"id":"q2","name":"Q2"},{"id":"q3","name":"Q3"},{"id":"q4","name":"Q4"}],
  "overtime_periods": [{"id":"ot","name":"OT"}],
  "time_limits": { "period_minutes": 10 },
  "draw_allowed": false,
  "forfeit_score": { "winner": 20, "loser": 0 },
  "default_game_duration_minutes": 60,
  "default_break_minutes": 15,
  "stats": [
    {"id":"pts_1","label":"Free Throw","short":"1PT","adds_to_score":true,"score_value":1,"is_player_stat":true,"is_negative":false,"category":"scoring","default_enabled":true},
    {"id":"pts_2","label":"2 Pointer","short":"2PT","adds_to_score":true,"score_value":2,"is_player_stat":true,"is_negative":false,"category":"scoring","default_enabled":true},
    {"id":"pts_3","label":"3 Pointer","short":"3PT","adds_to_score":true,"score_value":3,"is_player_stat":true,"is_negative":false,"category":"scoring","default_enabled":true},
    {"id":"assist","label":"Assist","short":"AST","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"scoring","default_enabled":true},
    {"id":"rebound","label":"Rebound","short":"REB","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"defense","default_enabled":true},
    {"id":"steal","label":"Steal","short":"STL","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"defense","default_enabled":true},
    {"id":"block","label":"Block","short":"BLK","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"defense","default_enabled":true},
    {"id":"turnover","label":"Turnover","short":"TO","adds_to_score":false,"is_player_stat":true,"is_negative":true,"category":"disc","default_enabled":true},
    {"id":"foul","label":"Personal Foul","short":"PF","adds_to_score":false,"is_player_stat":true,"is_negative":true,"category":"fouls","default_enabled":true},
    {"id":"tech","label":"Technical","short":"T","adds_to_score":false,"is_player_stat":true,"is_negative":true,"category":"fouls","default_enabled":false}
  ],
  "sotg_enabled": false
}')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, config = EXCLUDED.config, updated_at = now();

INSERT INTO sport_templates (slug, display_name, config) VALUES
('volleyball', 'Volleyball', '{
  "score_type": "set_based",
  "win_condition": {"type":"best_of_sets","sets":3,"points_per_set":25,"final_set_points":15,"must_win_by":2},
  "periods": [],
  "draw_allowed": false,
  "forfeit_score": {"winner_sets":2,"loser_sets":0},
  "default_game_duration_minutes": 60,
  "default_break_minutes": 10,
  "stats": [
    {"id":"kill","label":"Kill","short":"K","adds_to_score":true,"is_player_stat":true,"is_negative":false,"category":"offense","default_enabled":true},
    {"id":"ace","label":"Ace","short":"ACE","adds_to_score":true,"is_player_stat":true,"is_negative":false,"category":"offense","default_enabled":true},
    {"id":"assist","label":"Assist","short":"A","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"offense","default_enabled":true},
    {"id":"block","label":"Block","short":"B","adds_to_score":true,"is_player_stat":true,"is_negative":false,"category":"defense","default_enabled":true},
    {"id":"dig","label":"Dig","short":"DIG","adds_to_score":false,"is_player_stat":true,"is_negative":false,"category":"defense","default_enabled":true},
    {"id":"error","label":"Error","short":"E","adds_to_score":false,"is_player_stat":true,"is_negative":true,"category":"errors","default_enabled":true},
    {"id":"serve_err","label":"Serve Error","short":"SE","adds_to_score":false,"is_player_stat":true,"is_negative":true,"category":"errors","default_enabled":true}
  ],
  "sotg_enabled": false
}')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name, config = EXCLUDED.config, updated_at = now();

INSERT INTO sport_templates (slug, display_name, config) VALUES
('custom', 'Custom Sport', '{
  "score_type": "cumulative",
  "win_condition": {"type":"most_after_periods","cap_enabled":false},
  "periods": [{"id":"p1","name":"Period 1"}],
  "draw_allowed": true,
  "forfeit_score": {"winner":1,"loser":0},
  "default_game_duration_minutes": 60,
  "default_break_minutes": 15,
  "stats": [],
  "sotg_enabled": false
}')
ON CONFLICT (slug) DO NOTHING;


-- =============================================================
-- SECTION 24: PROFILES EXTENSION
-- =============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS tournament_notifications BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS guest_token UUID,
      ADD COLUMN IF NOT EXISTS default_sport TEXT;
  END IF;
END;
$$;


-- =============================================================
-- DONE
-- =============================================================
