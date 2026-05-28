GitHub issue bodies## Summary
Stabilize the highest-risk day-of tournament operations so directors can recover from mistakes and manage live play without SQL or engineering intervention.

## Why
During OFSAA, several live operational tasks required manual database edits or engineering support:
Done - resuming accidentally finalized games
Done- correcting field/time assignments
Done- handling timezone confusion in schedule/time slot mapping
- updating stream links quickly and consistently

These need to become first-class product workflows.

## Goals
- eliminate SQL-only live recovery steps for common scenarios
- provide safe, audited director-facing recovery tools
- reduce risk during live tournament operations
- make schedule/time/venue changes reliable and timezone-safe

## Child issues
- Add Resume Game / Undo Finalize action in Director Dashboard
- Add safe venue + time slot reassignment UI
- Standardize tournament-local timezone handling across admin and public views
- Add downstream unwind/cleanup flow for resumed games
- Add audit logging for finalize/resume/result correction actions
- Prevent venue/time slot mismatch in admin tools

## Success criteria
A director can recover from common live mistakes and manage core day-of changes without SQL.

## Summary
Add a Director Dashboard action to reopen a completed match that was accidentally finalized.

## Problem
A live game was accidentally ended and had to be manually reopened via SQL. This is an expected real-world tournament-day scenario and needs a supported recovery path.

## Requirements
- add `Resume Game` / `Undo Finalize` action for eligible roles
- when used:
  - set match status back to `in_progress`
  - preserve current score by default
  - clear `winner_id`
- if downstream advancement already happened:
  - show warning
  - support safe downstream unwind/cleanup
- require confirmation before applying
- log the action in an audit trail

## Permissions
- director
- assistant director (if applicable)
- platform/admin roles as needed

## Open questions
- should scorekeepers be able to resume their own matches?
- should there also be an option to restart from 0–0?

## Success criteria
A director can safely reopen an accidentally finalized match without SQL.

## Summary
Provide admin/director UI to move a match to a new field and time slot safely.

## Problem
Field/time changes currently require manual database intervention and can create mismatches between `venue_id` and `time_slot_id`.

## Requirements
- allow directors/admins to reassign a match to:
  - a new venue
  - a new time slot
  - or both together
- ensure venue and time slot remain compatible
- prevent invalid combinations where a time slot belongs to a different venue
- reflect changes immediately in:
  - schedule
  - bracket labels
  - team-facing next game views
  - watch/stream surfaces where relevant
- add confirmation modal before applying changes
- add audit log entry for reassignment actions

## Nice to have
- show current assignment and proposed assignment side by side
- show conflict warnings if destination slot is occupied

## Success criteria
A director can safely move a game without SQL and without creating venue/time slot mismatch issues.

## Summary
Establish a consistent timezone model so tournaments store time safely and display it clearly in tournament-local time.

## Problem
Live scheduling issues revealed confusion between UTC storage and local tournament display, leading to incorrect interpretation of 1:30 PM assignments.

## Requirements
- define tournament-local timezone as a first-class concept
- continue storing canonical timestamps safely (likely UTC)
- display all user-facing times in tournament-local time by default
- ensure admin tools clearly communicate local time vs stored value
- review and fix time formatting across:
  - schedule
  - bracket
  - match cards
  - team pages
  - stream/watch surfaces
  - admin scheduling tools

## Audit scope
- time slot creation/editing
- time slot lookup logic
- schedule rendering
- bracket rendering
- any “today/current/upcoming” logic

## Success criteria
Directors and public users consistently see correct tournament-local times, and admin tools no longer create timezone confusion.

## Summary
Create a centralized, reliable workflow for assigning and updating stream links during live tournaments.

## Why
Updating YouTube links during OFSAA was too manual and fragile. Stream assignments should be easy to update and should propagate consistently across all public-facing surfaces.

## Goals
- support venue-level default stream links
- support match-level overrides
- validate stream URLs
- reflect updates everywhere automatically
- reduce manual scattered edits

## Child issues
- Build centralized venue-level stream link editor
- Build match-level stream override UI
- Validate YouTube URLs on input
- Normalize stored stream URLs/formats
- Reflect stream links consistently on watch page, schedule, and match views

## Success criteria
A director can update a stream quickly and trust that all public views reflect the change.

## Summary
Add an admin/director UI for assigning a default stream link to each venue/field.

## Problem
Most live stream workflows are venue-based, but updating links is too manual and not centralized.

## Requirements
- create a venue-level stream editor
- for each venue, allow:
  - current stream URL
  - label/name if needed
  - live / not live status
  - open/test link action
- validate YouTube URLs on save
- make venue stream assignments flow into:
  - schedule
  - watch page
  - match views
  - team-facing views where applicable

## Nice to have
- show which upcoming matches will inherit the venue stream
- support featured court/field highlighting

## Success criteria
Directors can manage streams from one place and venue-level updates propagate automatically.

## Summary
Audit the codebase for OFSAA-specific, Ultimate-specific, and one-tournament assumptions, then refactor toward reusable platform behavior.

## Why
A significant amount of work was optimized for one live tournament. That was appropriate for delivery, but it creates scaling risk if hardcoded assumptions remain in shared code.

## Goals
- identify tournament-specific logic in code and UI
- identify sport-specific assumptions in reusable components
- extract template/config-driven behavior
- reduce hidden match-code-specific logic
- make platform behavior scalable and explicit

## Child issues
- Audit all files for tournament-specific hardcoded logic
- Audit all files for sport-specific hardcoded logic
- Audit all files for match-code-specific UI behavior
- Remove deprecated/duplicate route/component paths
- Refactor shared UI to consume template-driven labels and rules

## Success criteria
The platform no longer depends on hidden OFSAA-specific assumptions in shared logic.

## Summary
Perform a codebase-wide audit to find tournament-specific assumptions that should be refactored or isolated.

## Problem
We have done a lot of one-tournament-specific work. We need to identify anything in the codebase that is still hardcoded for OFSAA, Ultimate, or one specific bracket format.

## Audit targets
- hardcoded tournament names/slugs
- hardcoded division labels
- hardcoded match-code logic
- hardcoded round names or placement names
- OFSAA-specific copy in shared components
- Ultimate-specific assumptions in generalized flows
- one-off route/component behavior

## Output
Classify findings into:
- safe generic
- template-specific but acceptable
- should be abstracted
- should be removed
- unclear / needs design decision

## Deliverable
A written audit report or checklist with file paths and recommended action for each finding.

## Success criteria
We have a clear map of what must be refactored before scaling to more tournaments.

## Summary
Build simulation and validation tools so directors can test wizard-generated tournaments before game day.

## Why
Bracket/path testing currently requires manual score entry, manual verification, and SQL reset. This is too fragile and too dependent on engineering support.

## Goals
- full tournament simulation
- one-click reset
- step-by-step simulation mode
- structural validation for generated tournaments
- clear verification guidance after each simulated step

## Child issues
- Build step-by-step simulation runner
- Build full tournament simulation mode
- Add one-click reset after simulation
- Add structural validator for generated tournaments
- Add simulation validation summary UI

## Success criteria
A director can create a tournament, simulate it, visually verify key outputs, and reset it without engineering help.

## Summary
Add a guided simulation mode that completes one wave/round/time slot at a time and pauses for director verification.

## Problem
Directors do not just need a final-state simulation. They need to validate tournament progression as it unfolds:
- completed games in schedule
- standings updates
- bracket population
- next-game visibility
- medal/placement progression

## Requirements
- support “Complete next wave”
- optionally support:
  - complete next round
  - complete next time slot
- after each step, pause and show verification checklist:
  - check standings
  - check completed games in schedule
  - check bracket if relevant
  - check team/my team pages
- allow continue / reset / report issue
- support scenario modes later:
  - chalk
  - random
  - custom winners

## Nice to have
- show what changed in this simulation step
- show newly completed matches and newly populated downstream matches

## Success criteria
A director can validate a tournament progressively, the same way it will unfold live.
=========================================================

SCHEDULE

# [EPIC] Incremental Wizard Generation & Recovery

## Summary
Support staged tournament generation so directors can create games one at a time, one round at a time, or all at once, then verify, stop, resume, or selectively delete generated outputs.

## Why
Tournament generation should not be a one-shot, all-or-nothing workflow. Directors need to build confidence gradually, verify output as they go, and recover safely if something is wrong.

## Child issues
- Add wizard generation mode selector: one game / one round / all
- Add post-generation step review screen
- Support stopping generation and resuming later
- Add delete all generated games action
- Add delete selected generated games action
- Add delete last generated batch action
- Add generation batch/session metadata to generated matches
- Add resume generation from interruption point
- Surface what was created in the most recent generation step
- Add safety confirmation before deleting generated output

## Success criteria
Directors can generate incrementally, verify incrementally, stop and resume safely, and delete generated outputs without engineering intervention.


# [EPIC] Tournament-Specific Day 2 Schedule Generation

## Summary
Move tournament-specific Day 2 timing and layout concerns into the wizard/template layer so the correct schedule skeleton is generated up front.

## Why
Tournament-specific Day 2 structures, including custom times and field patterns, should be part of the template/wizard instead of requiring live manual fixes.

## Child issues
- Add support for custom day-specific time slot templates
- Add support for non-uniform slot intervals by day
- Make Day 2 slot generation template-driven
- Make Day 2 field assignment patterns template-driven
- Encode crossover and Day 2 schedule structure in template config
- Add wizard review screen for generated Day 2 slots and assignments
- Add validation for missing required Day 2 time slots
- Add support for template-specific initial field/time mapping rules

## Success criteria
Wizard-generated Day 2 schedules reflect the intended tournament-specific timing and venue structure before live edits begin.


# [EPIC] Schedule Check Mode

## Summary
Create a guided review workflow that lets directors verify schedules one game at a time, track progress, flag issues, and fix incorrect games directly.

## Why
Schedules may come from many places and still require verification even if structurally valid. Directors need a deliberate schedule-checking workflow to build trust.

## Child issues
- Add Check Schedule entry point in director workflow
- Add start-point selector for schedule check flow
- Build guided game-by-game schedule review screen
- Add actions: Correct / Change / Skip / Flag for later
- Add progress tracking for checked / unchecked / flagged games
- Add quick schedule change flow from review mode
- Add open full schedule editor escape hatch from guided review
- Persist schedule review state
- Add resume from first unchecked game action
- Add summary screen for schedule review progress

## Success criteria
A director can step through a schedule game by game, verify or fix each item, track progress, and return later without losing review state.


# [EPIC] Change Schedule Mode

## Summary
Provide a dedicated schedule editing workspace where directors can make many schedule changes before saving.

## Why
Real-world schedule changes are often multi-step and cannot be handled efficiently one game at a time. Directors need a draft editing workflow for schedule changes.

## Child issues
- Add Change Schedule entry point
- Add editable draft schedule state before save
- Allow moving games across fields and times in draft mode
- Allow editing field and time together
- Allow editing started games with warning
- Allow adding new time slots in schedule editor
- Allow deleting time slots in schedule editor
- Allow editing time slot details
- Add save changes flow for batched schedule edits
- Add unsaved changes warning on exit

## Success criteria
A director can make multiple schedule changes in one editing session and review/save them together.


# [EPIC] Schedule Overview & Large-Scale Editing

## Summary
Provide a bigger-picture schedule view so directors can inspect and fix structural schedule issues more efficiently.

## Why
Guided checking is useful, but directors also need a high-level view to identify broad issues, overloaded fields, unusual gaps, and layout problems quickly.

## Child issues
- Build field × time schedule grid view
- Add day filter to schedule overview
- Add visual indicators for missing assignments
- Add visual indicators for conflicts
- Support quick open/edit from overview grid
- Investigate drag-and-drop schedule reassignment
- Add structural overview for Day 2 layout
- Add fast navigation between overview and guided check

## Success criteria
Directors can quickly understand overall schedule structure and make large-scale corrections more efficiently.


# [EPIC] Schedule Conflict Detection & Save Review

## Summary
Detect schedule problems before save, distinguish warnings from hard errors, and allow directors to save with warnings when operationally necessary.

## Why
Some schedule problems should block save because they would create invalid state, while others should be surfaced as warnings that directors can override.

## Child issues
- Detect field double-booking conflicts
- Detect team double-booking conflicts
- Detect missing field/time assignments
- Detect unusual or insufficient rest warnings
- Classify save blockers vs warnings
- Build pre-save conflict summary modal
- Add Save Anyway option for warning-only conflicts
- Add Keep Editing option after conflict review
- Add server-side validation for hard schedule integrity errors
- Add conflict highlighting in schedule editor

## Success criteria
Directors are warned about schedule conflicts before saving and can choose whether to continue editing or save anyway when appropriate.


# [EPIC] Schedule Review State & Auditability

## Summary
Track what has been checked, changed, flagged, or regenerated so directors can build confidence and return to work later.

## Why
Schedule verification and editing need persistence, accountability, and progress tracking so directors know what has been reviewed and what still needs attention.

## Child issues
- Define schedule review data model
- Track checked / unchecked / flagged state per game
- Track who checked each game and when
- Track schedule changes made during review flow
- Add review progress summary per tournament/day
- Add review reset / restart action
- Add audit logging for schedule change batches
- Add audit logging for generated/deleted batches

## Success criteria
Schedule review and change activity is trackable, resumable, and auditable.


# Suggested First Issues to Create

1. Add wizard generation mode selector: one game / one round / all
2. Add support for custom day-specific time slot templates
3. Add Check Schedule entry point in director workflow
4. Build guided game-by-game schedule review screen
5. Add Change Schedule entry point
6. Add editable draft schedule state before save
7. Detect field double-booking conflicts
8. Build pre-save conflict summary modal
9. Add delete last generated batch action
10. Add open full schedule editor escape hatch from guided review


# Suggested Labels

## Type
- type:epic
- type:feature
- type:ux
- type:refactor

## Priority
- priority:p0
- priority:p1
- priority:p2

## Area
- area:wizard
- area:schedule
- area:review
- area:templates
- area:director-dashboard
- area:ops
- area:validation

## Epic labels
- epic:wizard-generation
- epic:day2-generation
- epic:schedule-check
- epic:schedule-editing
- epic:schedule-conflicts


# Suggested Milestones

## Post-OFSAA Sprint — Schedule Foundations
- wizard generation modes
- Day 2 slot template support
- change schedule mode foundation

## Post-OFSAA Sprint — Schedule Review & Conflict Detection
- schedule check mode
- conflict detection
- save review modal

## Post-OFSAA Sprint — Recovery & Large-Scale Editing
- delete generated batches
- resume generation
- overview/grid editing