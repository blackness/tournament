# AthleteOS Debug Playbook

Use this playbook when a tournament workflow behaves unexpectedly.

This is not a full regression checklist. It is a fast troubleshooting guide:
- if you see **X**
- check **Y**
- likely cause
- likely fix

---

## 1. Workbook import says duplicate team or bad field names

### Symptoms
- Duplicate team error on import
- `field_name` in `Schedules` does not match known field
- Exported workbook re-import fails after edits

### Check
- Inspect the exported workbook itself:
  - `Teams` sheet for duplicate rows
  - `Fields` sheet values
  - `Schedules` sheet field names
- Check whether deleted teams or venues still exist in DB
- Check whether exported schedule rows are using stale field names

### Likely cause
- stale wizard state
- stale DB rows not truly deleted
- export combining old and new data
- non-destructive persistence where destructive sync is expected

### Likely fix
- confirm deletes are real deletes in DB
- normalize wizard state before export
- ensure workbook export uses current fields/teams only

---

## 2. Deleted venue/team/division still causes conflicts later

### Symptoms
- Renaming a venue causes unique slug conflict
- Deleted team still appears duplicated
- Old divisions/teams/venues seem to come back later

### Check
- Query DB directly:
  - `venues`
  - `tournament_teams`
  - `divisions`
- Confirm deleted row is actually gone
- Check whether matches still reference deleted row

### Likely cause
- non-destructive save logic
- deleted row preserved in DB
- references preventing deletion

### Likely fix
- enforce pre-start destructive sync
- delete dependent rows in correct order
- block deletion with a clear message if dependencies still exist

---

## 3. Schedule appears generated in wizard but not on public site

### Symptoms
- Step 6/8 preview shows games
- Public schedule/home page does not show them

### Check
- Query DB:
  - `matches` count for tournament
  - `time_slots` count for tournament

### Likely cause
- generated schedule only exists in wizard state
- publish/save path did not persist `matches` / `time_slots`

### Likely fix
- persist generated slots and matches before/while publishing
- confirm public site reads DB-backed matches, not local state

---

## 4. Step 6 preview time is wrong, public schedule time is correct

### Symptoms
- Wizard Step 6 shows wrong times
- Public schedule shows expected local times

### Check
- Inspect preview code for raw ISO splitting
- Look for `split('T')` / string slicing of timestamps
- Compare with public page formatting

### Likely cause
- preview rendering raw UTC timestamps instead of local timezone formatting

### Likely fix
- use `new Date(...).toLocaleTimeString(...)`
- pass tournament timezone into preview display

---

## 5. `<input type="time">` throws invalid format error

### Symptoms
- browser console says value does not conform to `HH:mm`
- Step 6 crashes or shows broken time inputs

### Check
- inspect value feeding the time input
- look for full ISO datetime strings assigned to `startTime` / `endTime`

### Likely cause
- edit-mode hydration assigning full datetime to time-only input

### Likely fix
- normalize to `HH:mm` when loading edit-mode schedule config

---

## 6. Hidden tournament cannot be previewed by director

### Symptoms
- `is_public = false`
- director still gets "Tournament not found"

### Check
- confirm public page access logic
- confirm auth loading is settled before access decision
- confirm tournament `director_id` matches logged-in user

### Likely cause
- hidden tournament access check runs before auth finishes loading
- owner-bypass logic missing or too early

### Likely fix
- wait for auth loading to finish
- allow access when `is_public = true` OR user owns tournament

---

## 7. Hidden tournament still appears in public list

### Symptoms
- `is_public = false`
- tournament still visible on `/tournaments`

### Check
- inspect public tournament list query
- confirm query filters `.eq('is_public', true)`

### Likely cause
- public list query ignores `is_public`

### Likely fix
- add `is_public = true` filter to public listing query

---

## 8. Public schedule filter buttons behave strangely

### Symptoms
- `All` + `Day 1` shows no games
- day filters don’t match actual tournament days
- championship/consolation/crossover buttons appear at wrong times

### Check
- inspect quick-view filter definitions
- look for hardcoded dates or static view definitions

### Likely cause
- day filters hardcoded to fixed dates
- "all" handled incorrectly
- filters not derived from actual match data

### Likely fix
- generate day filters dynamically from scheduled match dates
- generate bracket-type filters only if those matches exist
- treat "all" as neutral within its filter group

---

## 9. Standings page shows wrong team / 0 games played / ghost rows

### Symptoms
- team shows 0 GP despite completed matches
- pool has extra team
- one team appears in the wrong pool standings

### Check
- audit match linkage per team
- inspect `pool_standings_display`
- inspect `pool_standings`
- compare `pool_standings.pool_id` with `tournament_teams.pool_id`

### Likely cause
- stale or cross-pool rows in `pool_standings`
- standings recompute function not deleting stale rows
- standings seeded from wrong team set

### Likely fix
- delete invalid cross-pool standings rows
- patch standings recompute function to:
  - remove stale rows for the pool
  - insert rows for all actual teams in the pool
  - recompute from completed pool matches only

---

## 10. Pool reassignment seems visual only

### Symptoms
- moving team to another pool looks correct in wizard
- later DB-driven pages behave as if team stayed in old pool

### Check
- query `tournament_teams.pool_id` after saving Step 5
- confirm changed team has new persisted pool id
- inspect downstream standings/schedule data

### Likely cause
- either:
  - pool assignment was not saved to DB
  - or it was saved, but downstream derived data was not rebuilt correctly

### Likely fix
- confirm Step 5 writes `pool_id` into `tournament_teams`
- clear/recompute stale standings after pool changes
- ensure schedule regeneration uses persisted/current pool state

---

## 11. Schedule generation does not follow Step 6 "Day start time"

### Symptoms
- changing schedule settings start time doesn’t change generated first game time

### Check
- inspect `tournamentDays[].startTime`
- inspect generator inputs
- compare with `scheduleConfig.startTime`

### Likely cause
- generator uses tournament day row times when present
- Schedule Settings “Day start time” is only acting like a default/fallback

### Likely fix
- relabel schedule settings as **Default day start/end time**
- use defaults for new tournament day rows
- make it explicit that tournament day row times drive generation

---

## 12. Schedule generation only creates first games

### Symptoms
- only one game per team / first round appears
- full pool round robin not created

### Check
- inspect `scheduleConfig.generationMode`
- verify Step 6 generation scope selection

### Likely cause
- generation scope set to first round only

### Likely fix
- expose generation scope clearly in UI
- choose between:
  - first pool games only
  - all pool games

---

## 13. Duplicate standings or ghost rows return after fixing manually

### Symptoms
- manual DB cleanup works temporarily
- bad standings rows reappear after a match completes

### Check
- inspect `matches` triggers
- inspect `fn_trigger_standings_on_match()`
- inspect `fn_recompute_standings()`

### Likely cause
- trigger-driven recompute function is reintroducing stale rows

### Likely fix
- patch DB function, not just UI or raw data
- verify recompute function deletes stale rows before recalculation

---

## 14. React hook order / undefined variable crashes

### Symptoms
- `Rendered more hooks than during the previous render`
- `X is not defined`
- component crashes after adding hook/filter

### Check
- look for hooks below conditional returns
- look for undeclared variables used in hooks or JSX
- confirm new hook imports exist

### Likely cause
- hook added after early return
- variable renamed but one usage not updated
- missing hook import

### Likely fix
- move hooks above all early returns
- remove unnecessary hook if simple value is enough
- add missing import / correct variable name

---

## 15. If you are unsure whether the bug is UI, state, or DB

### Use this quick triage

#### If wizard looks wrong before save
Likely:
- UI state bug
- local wizard mapping bug

#### If wizard looks right but public pages are wrong
Likely:
- DB persistence bug
- stale persisted rows
- derived data not recomputed

#### If DB rows are correct but UI is wrong
Likely:
- display logic bug
- filter bug
- timezone formatting bug
- wrong query or grouping logic

---

## Recommended Debug Sequence

When something looks wrong:

1. **Check the UI state**
   - wizard preview
   - expected labels
   - filter selection

2. **Check the DB**
   - source rows
   - relationships
   - stale rows
   - counts

3. **Check derived data**
   - standings tables
   - views
   - trigger/function side effects

4. **Check display formatting**
   - timezone
   - date grouping
   - filter logic

---

## Notes

- Prefer fixing data-source integrity rather than masking symptoms in UI.
- When a bug is found and fixed, add it to `docs/regression-checklist.md`.
- If a bug keeps recurring, promote it into automated coverage later.