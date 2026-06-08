# AthleteOS Golden Path Smoke Test

Use this as the fastest end-to-end regression check after meaningful changes.

## Goal
Confirm the core tournament workflow still works:
- create
- hide/public toggle
- workbook import
- schedule generation
- publish
- public visibility
- standings integrity

---

## Golden Path Flow

### 1. Create hidden tournament
- [ ] Create a new tournament
- [ ] Fill in Step 1 basics
- [ ] Set **Visible to the public** = off
- [ ] Save and continue

### 2. Import workbook
- [ ] Upload a known-good sample workbook
- [ ] Confirm workbook summary appears
- [ ] Confirm expected divisions / teams / pools / venues / tournament days loaded

### 3. Check teams and pools
- [ ] Go to Step 5
- [ ] Confirm teams are present
- [ ] Confirm pool assignments look correct
- [ ] If needed, move one team between pools and save later to verify persistence

### 4. Generate schedule
- [ ] Go to Step 6
- [ ] Confirm tournament days are set
- [ ] Choose generation scope:
  - [ ] First pool games only **or**
  - [ ] All pool games
- [ ] Generate schedule
- [ ] Confirm games appear in Step 6 preview
- [ ] Confirm preview times look correct

### 5. Publish
- [ ] Continue to Step 8
- [ ] Publish tournament
- [ ] Confirm publish succeeds

### 6. Hidden visibility behavior
- [ ] As director, direct slug page `/t/:slug` loads
- [ ] As public/logged-out user, direct slug page is hidden / not found
- [ ] Hidden tournament does **not** appear in public tournament list

### 7. Turn public on
- [ ] Return to Step 1 edit mode
- [ ] Toggle **Visible to the public** on
- [ ] Save

### 8. Public checks
- [ ] Tournament now appears in public tournament list
- [ ] Public home page loads
- [ ] Public schedule page loads
- [ ] Public schedule shows generated games
- [ ] Day filters work correctly
- [ ] Field filter works correctly

### 9. Standings integrity
- [ ] Complete or verify completed pool matches if needed
- [ ] Standings page loads
- [ ] Each pool only shows the correct teams
- [ ] Games played values are correct
- [ ] No ghost / cross-pool standings rows appear

### 10. Pool reassignment sanity check
- [ ] Move one team to another pool in Step 5
- [ ] Save
- [ ] Confirm `tournament_teams.pool_id` changes correctly
- [ ] Confirm standings remain clean after recompute

---

## Pass Criteria

The smoke test passes if:

- [ ] Tournament can be created and edited
- [ ] Hidden/public visibility behaves correctly
- [ ] Workbook import works
- [ ] Schedule generates successfully
- [ ] Schedule persists after publish
- [ ] Public pages reflect saved data
- [ ] Standings remain accurate
- [ ] No stale / ghost data appears after pool changes

---

## Suggested Fixtures

Use one reliable known-good fixture for repeatability.

Recommended:
- 8-team / 2-pool sample workbook
- or another stable small-format workbook already verified

---

## Notes

- If any bug is found during this flow, add it to `docs/regression-checklist.md`.
- Use this smoke test before major merges or releases.
- This document is the best first candidate for Playwright automation later.