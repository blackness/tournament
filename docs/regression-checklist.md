# AthleteOS Regression Checklist

Use this checklist after meaningful changes to tournament setup, workbook import/export, scheduling, standings, visibility, or publish flows.

## Goal
Catch workflow regressions across:
- wizard setup
- workbook round-trip
- destructive edits
- schedule generation/persistence
- public visibility
- standings integrity

---

## 1. Tournament creation + visibility

### Goal
Confirm a tournament can be created, saved, hidden, and previewed correctly.

- [ ] Create a new tournament
- [ ] Step 1 saves basics successfully
- [ ] Public visibility checkbox appears in Step 1
- [ ] Toggle visibility off and save
- [ ] As director, direct slug page `/t/:slug` still loads
- [ ] As public/logged-out user, direct slug page is hidden / not found
- [ ] Hidden tournament does **not** appear in public tournament list
- [ ] Toggle visibility on and save
- [ ] Tournament now appears in public list
- [ ] Public slug page loads normally

---

## 2. Workbook sample/template flow

### Goal
Confirm sample workbooks generate, import, and populate wizard state correctly.

- [ ] Sample workbook dropdown appears in Step 1
- [ ] Download sample workbook works
- [ ] Upload workbook works
- [ ] Workbook summary appears after import
- [ ] Imported counts match expected structure
  - [ ] correct divisions
  - [ ] correct teams
  - [ ] correct pools
  - [ ] correct venues
  - [ ] correct tournament days
- [ ] Fresh import into new tournament does not carry stale state
- [ ] Existing tournament import does not duplicate structure unexpectedly

---

## 3. Divisions / venues / teams destructive sync

### Goal
Confirm pre-start deletes are real deletes.

- [ ] Delete a division and save
- [ ] Deleted division is gone from DB
- [ ] Delete a venue and save
- [ ] Deleted venue is gone from DB
- [ ] Renaming another venue does not collide with deleted venue slug
- [ ] Delete a team and save
- [ ] Deleted team is gone from DB
- [ ] Deleted team is not referenced by matches
- [ ] Delete a pool assignment / move a team between pools and save
- [ ] `tournament_teams.pool_id` updates correctly
- [ ] No stale rows remain in standings after pool changes
- [ ] Deleted items do not reappear after reloading wizard

---

## 4. Team + pool integrity

### Goal
Confirm pool assignments persist and downstream systems respect them.

- [ ] Auto-generate pools works
- [ ] Manual pool dropdown reassignment works
- [ ] Drag/drop pool board assignment works
- [ ] Clicking Next persists pool assignments to DB
- [ ] Teams show the correct `pool_id` in DB
- [ ] Workbook export reflects the current pool assignments
- [ ] Schedule generation uses the correct pools
- [ ] Standings only show actual teams in each pool
- [ ] No cross-pool ghost standings rows exist

---

## 5. Schedule generation

### Goal
Confirm Step 6 generation behaves correctly and clearly.

- [ ] Tournament days can be added
- [ ] New tournament day uses default day start/end times
- [ ] Tournament day row start/end times are editable
- [ ] Generate schedule works
- [ ] `First pool games only` creates only first pool round
- [ ] `All pool games` creates the full pool round robin
- [ ] Generated game count matches expectation
- [ ] Generated slot count matches expectation
- [ ] Conflict summary behaves correctly
- [ ] Clear schedule works
- [ ] Clearing removes generated draft schedule state
- [ ] Clearing saved schedule also removes persisted matches/time slots where intended

---

## 6. Schedule time correctness

### Goal
Confirm time windows and timezone display are correct.

- [ ] Generation starts at tournament day row start time
- [ ] Generation respects tournament day end time
- [ ] Step 6 preview times match public schedule times
- [ ] Step 6 preview uses local tournament timezone correctly
- [ ] Schedule page displays expected local times
- [ ] No raw UTC/ISO values appear in UI
- [ ] Edit-mode scheduleConfig time inputs show `HH:mm`, not full datetime strings

---

## 7. Schedule persistence / publish

### Goal
Confirm generated schedule is truly saved to DB and visible publicly.

- [ ] Generate schedule in Step 6
- [ ] Continue to Step 8 preview
- [ ] Publish tournament succeeds
- [ ] `matches` rows are created in DB
- [ ] `time_slots` rows are created in DB
- [ ] Public schedule page shows the schedule
- [ ] Public home page shows upcoming/live games
- [ ] Re-publish after edits replaces schedule correctly
- [ ] No stale old schedule rows remain after replacement

---

## 8. Public schedule filters

### Goal
Confirm the schedule page filters are dynamic and composable.

- [ ] Schedule page loads
- [ ] Day quick filters are generated dynamically from actual match dates
- [ ] Day 1 filter shows actual first-day games
- [ ] Day 2 filter shows actual second-day games
- [ ] Championship filter appears only if championship games exist
- [ ] Consolation filter appears only if consolation games exist
- [ ] Crossover filter appears only if crossover/play-in games exist
- [ ] `All` + `Day 1` behavior works correctly
- [ ] Field filter cycles correctly
- [ ] No filter combination unexpectedly hides valid games

---

## 9. Standings

### Goal
Confirm standings are accurate and stable.

- [ ] Standings page loads for each division
- [ ] Each pool only shows real teams assigned to that pool
- [ ] Games played values are correct
- [ ] Wins/losses are correct
- [ ] Point differential is correct
- [ ] Rank order is correct
- [ ] Crossovers show correctly after completion
- [ ] No ghost rows / stale cross-pool standings rows exist
- [ ] Recomputing after completed pool match updates standings correctly

---

## 10. Edit-mode reload integrity

### Goal
Confirm saved tournaments round-trip cleanly through edit mode.

- [ ] Open existing tournament in edit mode
- [ ] Step 1 basics load correctly
- [ ] Step 4 venues load correctly
- [ ] Step 5 teams + pool assignments load correctly
- [ ] Step 6 saved schedule loads into preview correctly
- [ ] Editing and re-saving does not duplicate divisions/venues/teams/pools
- [ ] Editing and re-saving does not create ghost standings rows
- [ ] Editing and re-saving preserves public visibility setting

---

## 11. Workbook round-trip

### Goal
Confirm export → edit → reimport works safely.

- [ ] Export current tournament workbook
- [ ] Workbook fields sheet matches actual venues
- [ ] Workbook teams sheet has no duplicates unless intentionally added
- [ ] Workbook schedules sheet references real field names
- [ ] Reimporting edited workbook works
- [ ] Example rows are ignored
- [ ] Schedule rows reapply correctly when possible
- [ ] Reimport after deletes does not resurrect stale DB rows
- [ ] Reimport after schedule clear does not leave orphan schedule data

---

## 12. SQL / data integrity spot checks

### Goal
Have a quick sanity pass for suspicious states.

- [ ] No deleted venue still exists with conflicting `qr_slug`
- [ ] No deleted team remains in `tournament_teams`
- [ ] No match references deleted teams
- [ ] No cross-pool bad rows exist in `pool_standings`
- [ ] `pool_standings.pool_id` matches `tournament_teams.pool_id` for all rows
- [ ] `matches.team_a_id` and `team_b_id` reference valid teams
- [ ] `matches.time_slot_id` references valid time slots

---

## Golden Path Smoke Test

Use this as the fastest recurring end-to-end regression check.

- [ ] Create hidden tournament
- [ ] Import sample workbook
- [ ] Generate all pool games
- [ ] Publish
- [ ] Director can preview hidden tournament
- [ ] Public cannot
- [ ] Toggle public on
- [ ] Public list shows tournament
- [ ] Public schedule shows games
- [ ] Standings update correctly after scoring completed pool games
- [ ] Move a team’s pool, save, and verify standings remain clean

---

## Notes

- Treat pre-start wizard edits as destructive replacements where appropriate.
- Use DB queries to verify deletes, pool assignments, matches, and standings integrity.
- If a bug is found manually, add it to this checklist before fixing it.