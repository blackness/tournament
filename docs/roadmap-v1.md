# AthleteOS v1 Roadmap

## Purpose
This document defines the practical v1 roadmap for AthleteOS.

It exists to keep implementation focused on:
- finishing and stabilizing core tournament workflows
- protecting important existing behavior
- avoiding premature v2 expansion
- making safe, production-minded decisions

This document should guide both human contributors and AI coding agents.

---

# v1 Mission

AthleteOS v1 should reliably support directors in:

1. creating a tournament
2. defining divisions, pools, teams, venues, and tournament days
3. generating a workable schedule
4. exporting workbook data
5. importing workbook changes back into the wizard
6. saving data safely to the database
7. running common tournament formats without fragile custom intervention

The goal is not maximum theoretical flexibility.  
The goal is a stable, practical tournament operations system.

---

# Primary v1 Priority

## Finish v1 before building v2
The main product rule is:

> v1 should be finished and stabilized before deeper investment in v2 ideas like aiWizard.

### v1 finish line includes
- stabilizing compatibility
- protecting the core wizard flow
- finishing needed format support
- making production-safe decisions
- establishing reliable workbook-assisted workflows

### v2 direction
`aiWizard` is a v2 effort and should build on a stable v1 foundation.

---

# Protected Core Flows

These flows should be treated as high-priority and should not be broken casually.

## 1. Wizard tournament creation flow
Director can:
- create tournament basics
- define sport
- define divisions
- define venues
- define teams and pools
- define tournament days
- generate schedule
- preview/save

## 2. Wizard edit flow
Director can load an existing tournament, edit it safely, and preserve valid saved data.

## 3. Workbook-assisted setup flow
Director can:
- export workbook
- edit workbook in Excel
- upload workbook
- apply workbook data into wizard state
- continue through relevant steps to persist changes

## 4. Schedule generation flow
Director can generate a schedule in Step 6 using:
- divisions
- teams
- pools
- venues
- tournament days
- schedule settings

## 5. Schedule export flow
Director can export generated schedule rows into workbook `Schedules`.

## 6. Schedule round-trip direction
Director should eventually be able to:
- generate schedule
- export workbook
- edit `Schedules`
- upload workbook
- apply schedule edits back to wizard state safely

This is a major v1-value path and should be protected.

---

# Current v1 Priorities

## Priority 1 — Wizard stability
Keep the wizard reliable and predictable.

### Important expectations
- step flows should remain understandable
- local wizard state should be consistent
- save behavior should not become more confusing
- edit mode should hydrate correctly from DB

### Specific areas
- tournament basics
- divisions
- venues
- teams/pools
- tournament days
- schedule state

---

## Priority 2 — Workbook import/export reliability
Workbook workflows are high value and should be made stable.

### Required capabilities
- workbook generation from current wizard state
- workbook upload parsing
- workbook validation
- workbook apply to wizard state
- clear success/error summary messaging

### Important workbook entities
- Tournament
- Divisions
- Pools
- Teams
- Fields
- TournamentDays
- Rosters
- Schedules

### Important rule
A workbook feature is not complete unless parser, validation, normalization, apply mapping, and export are all aligned.

---

## Priority 3 — Schedule round-trip support
This is one of the highest-value workflow improvements.

### v1 target
- generate schedule in Step 6
- export generated schedule rows to `Schedules`
- edit schedule in Excel
- upload workbook
- validate `Schedules`
- apply schedule changes back into wizard state
- re-run conflict validation

### v1 stretch target
Persist workbook-applied schedule edits back to DB safely.

### Out of scope for now unless explicitly implemented
- rebuilding full tournament schedule from workbook alone
- editing participants/structure in `Schedules`
- arbitrary match creation from workbook rows

---

## Priority 4 — Common format support
Optimize around common tournament structures first.

### High-priority clean formats
- 6 teams -> 2 pools of 3 -> semifinals
- 8 teams -> 2 pools of 4 -> semifinals
- 8 teams -> 2 pools of 4 -> quarterfinals
- 10 teams -> 2 pools of 5 -> semifinals
- 12 teams -> 4 pools of 3 -> quarterfinals
- 16 teams -> 4 pools of 4 -> quarterfinals
- single elimination + bronze

These are common, understandable, and good UX anchors.

---

## Priority 5 — Sample workbook presets
For each supported format family, provide realistic sample workbooks directors can modify.

### Current direction
Use code-generated presets rather than hand-maintained static `.xlsx` files.

### Early target presets
- `POOL_TO_BRACKET_8`
- `POOL_TO_BRACKET_16`

### Future target presets
- 6-team pool to semis
- 10-team pool to semis
- 12-team quarterfinal formats
- single elimination + bronze
- OFSAA full classification
- double elimination

---

## Priority 6 — Persistence safety
DB writes and edit flows must be safe.

### Important concerns
- RLS policies must be correct
- deleted tournaments must not be silently reused
- child-table persistence should align with parent tournament ownership
- step saves should not accidentally delete or corrupt linked data

### Tables that need careful consistency
- tournaments
- divisions
- venues
- pools
- tournament_teams
- tournament_days
- time_slots
- matches

---

# Important Current Product Decisions

## 1. Tournament days live in Step 6
In the wizard, tournament days belong in Step 6.

In the workbook, they belong in the `TournamentDays` sheet.

These are not contradictory:
- wizard is organized by workflow
- workbook is organized by data entities

## 2. `Schedules` is more important than `ScheduleDraft`
`Schedules` is the real schedule round-trip sheet.

`ScheduleDraft` is helper/scaffold-oriented and may be deprecated or removed later.

## 3. Workbook upload usually updates wizard state first
Persistence to DB often happens later via the relevant wizard step.

Do not assume upload immediately writes everything to DB.

## 4. Common brackets first
Quarterfinals / semifinals / finals are the clean core bracket target.

Full classification-heavy structures should not define the default tournament UX.

## 5. OFSAA is important but not the default model
OFSAA full classification remains important for operational support, but should not drive default design for most tournaments.

---

# Known Current Limitations

These limitations are understood and acceptable in v1 unless specifically addressed.

## 1. Save model is not full autosave
Wizard data is often persisted step-by-step, not automatically on every change.

## 2. Workbook upload is not full direct DB sync
Workbook upload usually populates wizard state first.

## 3. Schedule workbook import is still evolving
Validation and apply flows are being improved, but full DB-backed round-trip may still be incomplete.

## 4. Not every format has full visual bracket support
Operational support can exist without full polished bracket rendering.

## 5. Advanced classification formats are more complex
Formats like OFSAA and double elimination may be operationally supported before they are fully elegant in UI.

## 6. ScheduleDraft vs Schedules can be confusing
This is a known UX issue and should be simplified over time.

---

# Explicit v1 Non-Goals

These are useful ideas, but should not distract from v1 completion unless intentionally prioritized.

## Non-goal 1 — Full aiWizard autonomy
AI-assisted wizarding is v2.

## Non-goal 2 — Perfect support for every weird format
Support common patterns first and advanced edge cases second.

## Non-goal 3 — Full bracket visualization for all formats
Some formats may remain schedule-first or partially visualized.

## Non-goal 4 — Overengineered autosave
A full auto-save architecture can come later; for now, predictable save behavior is more important.

## Non-goal 5 — Complex workbook-driven structure mutation
Workbook schedule sheets should not become arbitrary match-graph editors in v1.

---

# Current Technical Risk Areas

These are areas where bugs have already appeared or are likely.

## 1. CamelCase vs snake_case mismatches
Especially between:
- wizard state
- workbook normalized rows
- DB rows

## 2. Config normalization dropping fields
When adding workbook generator config fields, normalization must preserve them.

This already affected:
- `tournamentDays`
- `schedules`

## 3. Schedule input shape mismatches
The scheduler is sensitive to:
- `tournamentDays` vs `scheduleDays`
- nested `scheduleConfig`
- `team.poolId` vs `poolAssignments`
- `pool.teams` vs flat team arrays

## 4. RLS policy drift
Some child tables may fail writes unless policies are consistent with tournament ownership.

## 5. Edit-mode hydration gaps
A feature is not done if it saves to DB but does not reload into the wizard correctly.

---

# “Do Not Break” Rules

When making changes, do not casually break:

## Rule 1
Existing wizard create/edit flows.

## Rule 2
Workbook import/export for currently working sheets.

## Rule 3
Schedule generation for common pool-based formats.

## Rule 4
Tournament day save/load behavior.

## Rule 5
Current step-based save model unless intentionally redesigned.

## Rule 6
Current supported format behavior unless explicitly refactoring and retesting.

---

# Preferred Implementation Style for v1

## Prefer
- small explicit patches
- preserving existing contracts
- visible summaries and clear UX messaging
- end-to-end completion of features
- pragmatic fallbacks

## Avoid
- broad speculative rewrites
- introducing new shapes without documentation
- silently changing workbook contracts
- mixing draft sheets and authoritative sheets without clarity
- starting v2 abstractions before v1 is stable

---

# Acceptance Criteria Mindset

A feature is only “done” when the relevant path is complete.

## For workbook features
Check:
- parser
- structure validation
- sheet validation
- normalized result
- workbook apply mapping
- export generation
- summary messaging

## For DB-backed wizard features
Check:
- UI state
- save path
- DB constraints
- RLS
- edit-mode reload

## For scheduling features
Check:
- generation
- preview
- conflicts
- export
- upload/apply
- DB persistence if in scope

---

# Near-Term Next Priorities

These are good practical next steps after current progress.

## 1. Clean up schedule workbook UX
- reduce `ScheduleDraft` confusion
- make `Schedules` clearly authoritative

## 2. Finish schedule upload/apply path
- validate `Schedules`
- apply to generated schedule state
- re-run conflicts
- improve Step 6 visibility

## 3. Improve Step 6 schedule visibility
- preview table
- clearer confirmation of workbook-applied changes

## 4. Persist workbook-applied schedule edits to DB
Only after wizard-state application is stable.

## 5. Continue sample workbook preset expansion
Start with clean common formats.

---

# Future v2 Direction (for context only)
These are not current v1 priorities, but explain where the product may evolve later.

- aiWizard
- dedicated schedule workbook
- broader auto-save
- richer schedule conflict tools
- stronger bracket rendering for complex formats
- more autonomous import/sync behavior

These should build on a stable v1 base.

---

# Final v1 Decision Rule
When in doubt, ask:

> Does this make common tournament setup and schedule workflows more reliable without destabilizing the wizard?

If yes, it is probably good v1 work.  
If not, it is probably v2 or should be deferred.