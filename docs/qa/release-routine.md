# AthleteOS Release Routine

Use this routine to decide what QA to run:
- after a bug fix
- before merging meaningful changes
- before shipping / deploying

This keeps QA practical and repeatable without always running the full regression checklist.

---

## 1. After a Bug Fix

### Goal
Confirm the bug is fixed and protected from regressions.

### Routine
- [ ] Reproduce the bug first (if possible)
- [ ] Apply the fix
- [ ] Re-test the exact bug scenario
- [ ] Add or update a regression item in `docs/regression-checklist.md`
- [ ] If the bug involved DB integrity, run the relevant SQL checks from `docs/qa/sql-checks.md`
- [ ] If the bug affected a core workflow, run the Golden Path Smoke Test or the relevant section of it

### Examples
#### If you fix:
- hidden tournament visibility  
  → re-test Step 1 visibility + public list + direct slug preview

- schedule persistence  
  → re-test Step 6/8 + DB `matches` / `time_slots` + public schedule page

- standings corruption  
  → re-test pool changes + recompute standings + standings page + SQL integrity queries

---

## 2. Before Merging a Meaningful Change

### Goal
Catch regressions related to the specific feature area you changed.

### Routine
1. Identify what you touched
2. Run the matching section(s) from `docs/regression-checklist.md`
3. If the change was broad or structural, also run the Golden Path Smoke Test

### Mapping Guide

#### Step 1 / visibility / tournament basics changes
Run:
- [ ] Tournament creation + visibility
- [ ] Public list visibility checks
- [ ] Director preview checks

#### Workbook import/export changes
Run:
- [ ] Workbook sample/template flow
- [ ] Workbook round-trip
- [ ] Destructive sync checks if deletes are involved

#### Step 4 venues changes
Run:
- [ ] Destructive sync
- [ ] Venue QR slug integrity checks
- [ ] Workbook fields/schedule consistency checks

#### Step 5 teams/pools changes
Run:
- [ ] Team + pool integrity
- [ ] Destructive sync
- [ ] Standings
- [ ] SQL pool assignment checks

#### Step 6 schedule generation changes
Run:
- [ ] Schedule generation
- [ ] Schedule time correctness
- [ ] Public schedule filters
- [ ] Publish persistence checks

#### Step 8 publish/save changes
Run:
- [ ] Schedule persistence / publish
- [ ] Public page verification
- [ ] Edit-mode reload integrity

#### Public schedule page changes
Run:
- [ ] Public schedule filters
- [ ] Schedule time correctness
- [ ] Field filter checks

#### Standings logic changes
Run:
- [ ] Standings
- [ ] Team + pool integrity
- [ ] SQL `pool_standings` checks

---

## 3. Before Shipping / Deploying

### Goal
Get strong confidence that the tournament system still works end-to-end.

### Minimum required
- [ ] Run `docs/qa/golden-path.md`

### Recommended if anything structural changed
Also run the relevant deep sections from `docs/regression-checklist.md`.

### Mandatory additional checks if touched:
#### Visibility / public access
- [ ] Hidden tournament cannot be seen publicly
- [ ] Director can still preview hidden tournament
- [ ] Public list respects `is_public`

#### Schedule persistence
- [ ] `matches` rows are created in DB
- [ ] `time_slots` rows are created in DB
- [ ] Public schedule shows expected games

#### Pools / standings
- [ ] `tournament_teams.pool_id` is correct
- [ ] no cross-pool bad rows exist in `pool_standings`
- [ ] standings page shows correct teams only

---

## 4. If the Change Feels “Scary”

### Definition
A scary change is one that affects:
- persistence
- identity mapping
- destructive deletes
- schedule generation
- standings
- public visibility
- workbook round-trip
- DB triggers/functions

### Routine
- [ ] Run the Golden Path Smoke Test
- [ ] Run at least 2-3 targeted deep sections from `docs/regression-checklist.md`
- [ ] Run relevant SQL checks from `docs/qa/sql-checks.md`
- [ ] Spot-check at least one public page and one edit-mode page

---

## 5. Lightweight Daily Development Routine

### Goal
Stay fast without skipping QA.

When finishing a coding session:
- [ ] Ask: “What did I touch?”
- [ ] Run only the relevant regression section(s)
- [ ] If the change touched persistence or public UX, run the Golden Path Smoke Test if time allows

### Good default
If unsure, run:
- [ ] Golden Path Smoke Test
- [ ] SQL integrity spot checks for the affected tournament

---

## 6. Suggested Escalation Path

### Level 1 — Small UI tweak
Run:
- [ ] local manual check of touched screen
- [ ] one targeted checklist section

### Level 2 — Workflow change
Run:
- [ ] targeted checklist sections
- [ ] smoke test if shared workflow affected

### Level 3 — Structural/persistence change
Run:
- [ ] Golden Path Smoke Test
- [ ] targeted checklist sections
- [ ] SQL checks

### Level 4 — Pre-release / pre-deploy
Run:
- [ ] Golden Path Smoke Test
- [ ] all relevant deep sections
- [ ] integrity spot checks

---

## 7. What to Add to Docs After a New Bug

When a new bug is found:
- [ ] Add a regression item to `docs/regression-checklist.md`
- [ ] If it is a recurring or infrastructure issue, add a troubleshooting note to `docs/qa/debug-playbook.md`
- [ ] If it needs DB verification, add the query to `docs/qa/sql-checks.md`
- [ ] If it affects core flow, include it in `docs/qa/golden-path.md`

This keeps the docs alive and increasingly useful.

---

## 8. Long-Term Use

These QA docs should become:
- your manual release process
- your automation blueprint
- your bug memory
- your onboarding guide for future collaborators or AI agents

### Future automation path
Convert in this order:
1. `docs/qa/golden-path.md`
2. high-value regression sections from `docs/regression-checklist.md`
3. selected SQL validations into automated assertions

---

## Quick Default Rule

If you only remember one thing:

### After bug fix
- re-test the bug
- add regression coverage

### Before merge
- run relevant checklist sections

### Before ship
- run Golden Path Smoke Test
- plus relevant SQL/data integrity checks