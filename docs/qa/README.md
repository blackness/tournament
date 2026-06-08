# AthleteOS QA Docs

This folder contains the working QA system for AthleteOS.

Use these docs to:
- test changes efficiently during development
- run release checks before shipping
- debug tournament workflow issues
- capture regressions after bug fixes
- prepare future automated end-to-end testing

---

## QA Document Map

### 1. `golden-path.md`
Use this for the fastest end-to-end smoke test.

Best for:
- before major merges
- before releases
- after structural changes
- quick confidence checks

Covers:
- hidden/public tournament flow
- workbook import
- schedule generation
- publish
- public visibility
- standings sanity

---

### 2. `../regression-checklist.md`
Use this for deeper targeted regression coverage.

Best for:
- feature-specific testing
- post-fix regression protection
- broader QA passes before risky releases

Covers:
- wizard setup
- workbook round-trip
- destructive sync
- pool integrity
- schedule generation
- publish persistence
- public filters
- standings
- edit-mode reload
- DB/data integrity

---

### 3. `sql-checks.md`
Use this for direct database validation.

Best for:
- persistence bugs
- stale row debugging
- standings verification
- schedule verification
- delete/rebuild checks

Covers:
- tournament/division/team/pool queries
- match/time slot checks
- standings checks
- cross-pool ghost-row checks
- trigger/function inspection

---

### 4. `debug-playbook.md`
Use this when something looks wrong and you want the fastest diagnostic path.

Best for:
- “I see X, what should I check?”
- narrowing whether a bug is in UI, state, DB, or derived data

Covers:
- workbook issues
- stale deletes
- schedule visibility issues
- timezone issues
- public schedule filters
- standings corruption
- pool reassignment confusion

---

### 5. `release-routine.md`
Use this to decide how much QA to run depending on the type of change.

Best for:
- after bug fixes
- before merging
- before shipping
- choosing the right test depth

Covers:
- bug-fix routine
- merge routine
- release routine
- scary-change routine
- documentation update habits

---

## Suggested Usage

### During development
1. Identify what you changed
2. Open `release-routine.md`
3. Run the relevant section(s) from `../regression-checklist.md`
4. If needed, use `sql-checks.md` for direct DB verification

---

### After fixing a bug
1. Reproduce the bug
2. Fix it
3. Re-test it
4. Add a regression item to `../regression-checklist.md`
5. Add a debug note to `debug-playbook.md` if useful
6. Add SQL checks to `sql-checks.md` if useful

---

### Before shipping
1. Run `golden-path.md`
2. Run any relevant deep sections from `../regression-checklist.md`
3. Run DB validation from `sql-checks.md` for risky persistence changes

---

## Recommended Default Flow

If you are unsure what to do:

### Small UI change
- run the touched page manually
- run one relevant regression section

### Workflow change
- run the relevant regression sections
- consider `golden-path.md`

### Persistence / scheduling / standings / visibility change
- run `golden-path.md`
- run targeted regression sections
- run relevant SQL checks

### Pre-release
- run `golden-path.md`
- run targeted deep regression sections
- run DB integrity spot checks

---

## Long-Term Plan

These docs are also the blueprint for automation.

Recommended automation order:
1. `golden-path.md`
2. highest-value sections from `../regression-checklist.md`
3. selected SQL validations as automated assertions

Likely future destination:
- Playwright end-to-end tests
- reusable test fixtures
- scheduled regression runs

---

## Maintenance Rule

When a real bug is found:
- add it to the regression checklist
- add troubleshooting guidance if needed
- add SQL verification if needed

This keeps the QA system alive and increasingly valuable over time.