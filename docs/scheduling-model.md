# AthleteOS Scheduling Model

## Purpose

AthleteOS scheduling must support real tournament operations, not just idealized auto-generation.

The system should help directors generate a strong default schedule, but directors must retain control over:
- who plays who
- when games happen
- where games happen
- how the tournament adjusts as the event unfolds

The scheduling model must support both:
- pre-tournament planning
- live tournament operations

---

## Core Principles

### 1. Match-first scheduling
Matches are the primary objects that directors manage.

The system may use slots, schedule windows, or generated placements behind the scenes, but directors think in terms of:
- games
- opponents
- time
- venue

### 2. Slot-assisted, not slot-constrained
Predicted or generated time slots are useful and important, but they are not strict limitations.

Directors must be able to:
- schedule games at arbitrary times
- move games off the generated grid
- override venue and time at any point

### 3. Schedule shells should exist even when participants are unresolved
All games should have a scheduled date/time/venue whenever possible, even if teams are not yet known.

This is especially important for:
- crossover games
- playoff games
- classification games

Games may be:
- scheduled and resolved
- scheduled and projected
- scheduled and unresolved

Unresolved participants should not prevent a game from being placed on the schedule.

### 4. No auto-delete
The system must never automatically delete games.

AthleteOS may:
- generate games
- update projected participants
- resolve actual participants into scheduled games

But only a director may delete a game.

### 5. Consistency and predictability
Schedule generation must be stable, explainable, and repeatable.

Directors build trust when:
- the generator behaves consistently
- schedule logic is understandable
- reruns do not create surprising results

Predictability is a product requirement.

### 6. Director override is a first-class feature
Generated schedules are suggestions and defaults, not final authority.

Directors must be able to override:
- pool matchups
- game time
- game venue
- playoff placements
- specific game assignments

---

## Scheduling Layers

AthleteOS scheduling has three related layers:

### 1. Structure layer
Defines the tournament framework:
- divisions
- pools
- advancement/playoff model
- crossover logic
- classification structure

### 2. Matchup layer
Defines who plays who:
- pool play pairings
- crossover pairings
- playoff source logic
- manually customized matchups

### 3. Schedule layer
Defines when and where games happen:
- date
- start time
- end time
- venue

These layers must be editable independently where appropriate.

---

## Pool Scheduling Requirements

Pool scheduling flexibility is a major priority.

### Directors need control over who plays who
Pool matchups must not be treated as fully fixed by the generator.

AthleteOS should support:
- default matchup generation
- manual matchup editing
- post-generation matchup adjustments

### Pool matchup generation
The system may generate standard default pairings for:
- round robin pools
- custom partial round robin pools
- pool formats with known templates

### Pool matchup editing
Directors should be able to:
- review generated pool matchups
- change who plays who
- swap opponents
- customize pool game pairings
- preserve desired matchups before scheduling times/venues

This control is necessary for:
- fairness preferences
- seeding philosophy
- avoiding repeat/rivalry matchups
- showcase game placement
- local competition rules

### Matchup edits must persist
If a director customizes pool matchups, schedule regeneration must not silently replace those matchups unless the director explicitly chooses to regenerate matchups.

---

## Initial Schedule Generation

### Primary use case
The main schedule generator is used primarily before the tournament starts.

Its job is to:
- create a complete, usable tournament schedule
- place games consistently and predictably
- give directors a strong starting point
- remain easy to manipulate afterward

### Default goal
The generator should aim to place all games into the schedule.

There should ideally be no unscheduled games.

If a game does not yet have known participants, it should still be scheduled as a shell game with:
- date
- time
- venue
- projected source labels or projected teams

### Generated schedule output
A generated game should ideally include:
- match identity
- division/pool/bracket context
- date
- start time
- end time
- venue
- actual teams if known
- projected teams or source labels if unresolved

---

## Playoff Scheduling Model

### Playoff generation should behave like schedule generation
Playoff scheduling must be:
- consistent
- predictable
- visible in advance
- editable by directors

### Scheduled playoff shells
Playoff games should be scheduled in advance whenever possible, even if participants are not yet known.

These games should still have:
- date
- time
- venue
- bracket position
- feeder/source logic

### Projected teams
Before participants are finalized, AthleteOS should show:
- projected teams based on current standings where meaningful
- source labels where needed
- actual teams once resolved

### Automatic participant resolution
As results and standings update during the tournament:
- actual teams should flow into their scheduled playoff/crossover/classification games
- existing game shells should remain intact
- time/venue assignments should remain unless a director changes them

### No auto-delete in playoffs
Bracket updates must not auto-delete games.
Only directors may delete games manually.

---

## Manual Game Editing

### Unified model for all games
All games should use the same scheduling/editing model, including:
- pool games
- playoff games
- crossover games
- classification games
- manually created games

### Primary editing surface
The existing schedule view should remain the main editing interface.

### Inline editing
Schedule rows should support inline editing with:
- teams/opponents
- date
- start time
- end time
- venue

Each row should include:
- Save
- Cancel/Revert

### Read-only context
Each editable row or game editor should show context such as:
- match code
- round label
- division
- warnings/conflicts

---

## Time Editing Rules

### Start time behavior
When a director changes start time:
- end time should be auto-calculated from game duration
- director may manually edit end time afterward

### End time behavior
If a director manually changes end time:
- that change is a one-game override only
- it does not change tournament or division defaults

### Venue changes
When a director changes venue:
- preserve the same time by default
- warn if conflicts result

### One-game changes do not cascade automatically
Changing one game must not automatically move later games unless the director explicitly requests a broader operation.

---

## Conflict Model

### Conflict philosophy
Conflicts should be warning-first, not blocking by default.

Directors must be able to make operational decisions while still being informed of potential issues.

### Strong warning conflicts
These are priority scheduling conflicts:
- venue overlap
- team overlap
- playoff dependency conflict
- division sequencing conflict

### Soft advisory conflicts
These are useful but lower-severity warnings:
- insufficient rest

### Post-save conflict behavior
After a manual game edit:
- save the game
- detect new conflicts introduced by the edit
- show a banner or popup with a short list of new conflicts
- do not interrupt when no new conflicts were introduced

---

## Edit Tracking and Highlighting

When a game is edited, the system should highlight which fields changed, such as:
- time
- venue
- teams
- multiple fields

Comparison should support:
- differences from the generated baseline
- differences from the most recent saved version

This helps directors understand what has been customized.

---

## Bulk Time Adjustment

### Purpose
Tournament directors need bulk schedule shift tools for real operational use.

Examples:
- tournament is running 15 minutes behind
- selected games need to move together
- future schedule needs a global adjustment

### Required v1 bulk scopes
AthleteOS must support:
- all games
- selected games

### “All games” default meaning
“All games” should mean:
- future schedulable games
- excluding completed and live/in-progress games by default

### Selected games
Selected games should be chosen using checkboxes in a list/table view.

### Shift behavior
Bulk shift should move:
- start time
- end time

by the same amount.

### Bulk conflict preview
Before applying a bulk shift:
- preview resulting conflicts
- allow director to:
  - apply anyway
  - cancel
  - skip conflicted games

When skipping conflicted games, allow the director to choose whether “conflicted” means:
- strong conflicts only
- strong conflicts plus soft advisories

---

## Slots and Capacity Model

### Slots are helpers
Generated time slots are useful for:
- default schedule generation
- showing likely availability
- playoff round placement
- visual schedule scaffolding

But they are not strict constraints.

### Arbitrary scheduling must be supported
Directors must be able to schedule a game at any valid time, such as:
- 10:10 AM
- 11:25 AM
- any other custom time

The implementation may:
- create custom slot records
- store time directly on schedule entities
- use another internal representation

But the user experience must remain flexible.

### Time/venue assignment is more important than slot purity
The system should prioritize:
- making the schedule operationally useful
- supporting manual overrides
- preserving clarity for directors

---

## Regeneration Expectations

### Stability matters
Regeneration must be predictable and safe.

### No silent destruction
Regeneration must not:
- auto-delete games
- silently remove manually scheduled shells
- silently wipe director edits

### Director-controlled regeneration behavior
Over time, AthleteOS should support controlled rerun modes such as:
- regenerate schedule placements
- regenerate projected teams
- preserve manual edits where possible
- regenerate only selected parts of the tournament

The exact modes may evolve, but regeneration must remain explainable and director-controlled.

---

## Scheduled vs Projected vs Resolved Games

AthleteOS should distinguish between:

### Scheduled and resolved
Game has:
- date
- time
- venue
- actual teams assigned

### Scheduled and projected
Game has:
- date
- time
- venue
- projected teams based on current standings or seeding

### Scheduled and unresolved
Game has:
- date
- time
- venue
- source logic but no current participant resolution yet

The schedule should still show these games in all three states.

---

## UX Expectations

AthleteOS scheduling should feel:
- intuitive
- flexible
- safe
- predictable
- editable at any time

Directors should feel that:
- the system gives them a strong default schedule
- they can easily manipulate it
- they can trust the generator
- the system supports real-world tournament changes

---

## v1 Priorities

### High priority
- complete pre-tournament schedule generation
- flexible pool matchup control
- editable schedule rows
- playoff shell scheduling
- projected playoff team display
- automatic participant resolution into scheduled playoff games
- strong conflict warnings
- bulk time shift for all/selected games
- no auto-delete behavior

### Medium priority
- richer regeneration modes
- better explanation of generated decisions
- more advanced capacity visualization
- improved conflict summaries
- deeper playoff scheduling controls

### Later enhancements
- drag-and-drop scheduling
- venue/day scoped bulk actions
- richer matchup editors
- schedule quality scoring
- more advanced fairness heuristics

---

## Summary

AthleteOS scheduling is not just a slot generator.

It is a tournament operations system that must support:
- editable matchup design
- predictable schedule generation
- scheduled playoff shells
- projected-to-actual participant flow
- manual override at any point
- safe conflict visibility
- flexible live adjustment during the event

The system should generate confidently, preserve structure safely, and always leave the final operational control with the director.