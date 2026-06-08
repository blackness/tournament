# AthleteOS AI Context

## Product Overview
AthleteOS is a tournament operations platform focused on helping directors create, manage, schedule, and run sports tournaments. The current primary workflow is a multi-step tournament wizard backed by Zustand state, Supabase persistence, and workbook import/export support.

The system supports tournament structure setup, team/pool/division management, scheduling, and workbook-assisted editing. Workbook support is intended to reduce friction for directors who prefer spreadsheet workflows.

---

## Current Product Phase
The project is currently focused on **v1 completion and stabilization**, not v2 expansion.

### v1 priority rule
Finish and stabilize v1 before investing heavily in v2 ideas.

### v1 finish line includes
- stabilizing compatibility
- protecting core wizard flow
- finishing needed format support
- making production-safe decisions

### v2 direction
`aiWizard` is considered a v2 effort and should build on a reliable v1 foundation of:
- format templates
- structure generators
- schedule generation
- workbook support

---

## Core Product Principles

### 1. Stability over elegance
Prefer safe, understandable, production-friendly implementations over ambitious but brittle abstractions.

### 2. Workbook-assisted setup is high value
A major product value is:
- generate in AthleteOS
- export to workbook
- edit in Excel
- re-import into AthleteOS

This is especially important for schedule workflows.

### 3. Not every format needs full visual bracket support
A format can still be supported if:
- structure can be represented
- schedule can be generated or imported
- workbook import/export works
- operations are supported

Full visual bracket rendering is not required for all supported formats.

### 4. Normal tournament workflows first
Most tournaments use:
- pool play
- then a simple playoff bracket
- usually quarterfinals / semifinals / finals
- maybe bronze

Optimize v1 around common, clean tournament patterns before advanced classification-heavy formats.

### 5. Advanced classification formats are still important
Formats like OFSAA full classification matter operationally, but should not define the default bracket UX for the whole product.

---

## Wizard Architecture

## Wizard steps
1. Tournament basics
2. Sport
3. Divisions
4. Venues
5. Teams / pools
6. Schedule / tournament days
7. Constraints
8. Preview

### Important note
Tournament days belong in **Step 6** in the wizard.

### Save model
Current wizard behavior is primarily **step-scoped persistence**:
- state is edited locally in Zustand
- relevant data is usually persisted when continuing through a step

This is important. Workbook upload usually populates wizard state first, and DB persistence may happen later when the relevant step saves.

Do not assume workbook upload immediately persists all imported data to DB.

---

## Data Shape Rules

### Critical rule
Be careful with shape differences between:

- wizard/store state: usually camelCase
- workbook normalized rows: usually snake_case
- DB rows: usually snake_case

### Example: tournament days
#### Wizard/store shape
```js
{
  id,
  dayIndex,
  eventDate,
  startTime,
  endTime,
  label,
}

