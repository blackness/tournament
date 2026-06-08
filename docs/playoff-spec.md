# Step 7 Spec: Advancement & Playoffs

## Purpose
Convert completed pool play into a valid playoff/classification structure for each division.

Step 7 should:
- detect the division’s current structure
- recommend valid playoff presets
- let the director choose an advancement path
- preview qualifiers, seeds, and bracket structure
- save a deterministic playoff configuration
- optionally generate the first playoff matches / full bracket structure

---

## High-level UX goal
The director should **not** need to invent a bracket manually.

Instead, the wizard should say:

> “We detected 2 pools of 4. Here are the valid advancement/playoff options. This is the recommended one.”

---

## Position in wizard
### Proposed flow
1. Step 1 — Basics
2. Step 2 — Sport
3. Step 3 — Divisions
4. Step 4 — Venues
5. Step 5 — Teams & Pools
6. Step 6 — Schedule / Tournament Days
7. **Step 7 — Advancement & Playoffs**
8. Step 8 — Constraints / Final checks (or merge constraints elsewhere)
9. Step 9 — Preview & Publish

If constraints are lightweight, they may be merged and Preview may remain the final step.

---

## Core design principles

### 1. Preset-first
Directors choose from valid preset paths, not raw bracket wiring.

### 2. Format-aware
The wizard knows:
- division format type
- number of pools
- teams per pool
- total team count

and only offers eligible options.

### 3. Deterministic
Bracket generation must be deterministic and auditable.

### 4. Preview before generate
Always show:
- qualifiers
- seeds
- first-round matchups
- placement bands

before saving/generating.

### 5. Separate “playoff logic” from “schedule timing”
Step 6 owns calendar/slot infrastructure.  
Step 7 owns qualification, seeding, and bracket structure.

---

## Inputs into Step 7
Per division, Step 7 should have access to:

- division metadata
- format type
- tournament team list
- pools for the division
- current pool assignments
- completed pool standings
- tiebreaker ordering
- generated / persisted matches if relevant
- tournament days and available scheduling context
- existing bracket structure if already generated

---

## Output of Step 7
Per division, Step 7 should save:

### A. Playoff configuration
A normalized config describing the chosen advancement path.

### B. Generated playoff structure
Bracket match definitions with:
- source references
- progression links
- placement ranges
- bracket types
- optionally first scheduled playoff matches

---

## Step 7 user flow

### 1. Division context
For each division, show a summary:

Example:
- Division name
- Team count
- Pool count
- Pool sizes
- Format type
- Pool play complete / not complete

Example copy:
> **Senior Open**  
> Detected: 8 teams • 2 pools • 4 teams per pool • Pool play complete

If pool play is not complete:
- allow setup but warn that final seeding may still change
- optionally prevent playoff generation until standings are locked

---

### 2. Advancement intent questions
Step 7 should first ask intent, not bracket jargon.

#### Question A
**How many teams should advance to championship play?**
Options depend on format:
- Top 1 from each pool
- Top 2 from each pool
- Top 4 from each pool
- All teams in a classification structure
- Custom preset path (advanced)

#### Question B
**What level of placement/classification do you want?**
Options:
- Championship only
- Championship + bronze
- Championship + consolation
- Full classification

These two answers narrow the preset options.

---

### 3. Recommended preset cards
Show a small set of eligible preset cards.

Each card should include:
- title
- short description
- recommended badge if applicable
- number of championship teams
- whether bronze exists
- whether consolation exists
- whether all teams are placed
- number of playoff games generated
- example first-round matchups

#### Card example
**Top 2 per pool → Semifinals + Bronze**  
Recommended  
- 4 championship teams  
- Includes bronze game  
- Non-qualifiers finish by pool ranking  
- Matchups: A1 vs B2, B1 vs A2

Button:
- **Use this playoff plan**

---

### 4. Advanced settings (collapsible)
Most directors won’t need this, but it should exist.

#### A. Seeding method
- Pool finish only
- Cross-pool ranking by tiebreakers
- Preset-defined / locked
- Avoid immediate rematches where possible

#### B. Bracket generation scope
- Generate first playoff round only
- Generate full bracket structure with TBD future participants
- Generate all currently schedulable playoff games

#### C. Placement behavior
- Championship only
- Bronze game included
- Consolation bracket included
- Full placement classification

#### D. Constraint handling
- Allow same-pool rematches if structurally required
- Avoid same-pool rematches in first playoff round if possible
- Preserve pool winners on opposite sides of bracket if possible

---

### 5. Preview
Once a preset is chosen, show a preview.

#### A. Qualified teams
Example:
- A1 Thunderhawks
- A2 Phantom Disc
- B1 Night Owls
- B2 Storm Chasers

#### B. Seeding order
Example:
- Seed 1: A1 Thunderhawks
- Seed 2: B1 Night Owls
- Seed 3: A2 Phantom Disc
- Seed 4: B2 Storm Chasers

#### C. First-round playoff games
Example:
- SF1: Seed 1 vs Seed 4
- SF2: Seed 2 vs Seed 3

or:
- QF1: A1 vs B4
- QF2: B2 vs A3

#### D. Progression structure
Show:
- winners to...
- losers to...
- placement bands

#### E. Placement summary
Example:
- Championship bracket determines 1st–4th
- Pool non-qualifiers finish 5th–8th by pool result

or:
- Consolation bracket determines 5th–8th

---

### 6. Save / Generate actions
Buttons:
- Save playoff setup
- Generate playoff structure
- Generate and schedule playoff round 1
- Reset playoff setup for this division

---

## Recommended preset system

### Preset definition shape
Each preset should declare:
- eligibility rules
- advancement logic
- seeding logic
- bracket structure
- placement model
- generation defaults

Example conceptual shape:

```js
{
  key: 'TOP_2_PER_POOL_TO_SEMIS_BRONZE',
  label: 'Top 2 per pool → Semifinals + Bronze',
  eligibleWhen: {
    poolCount: 2,
    minTeamsPerPool: 2,
  },
  championshipTeams: 4,
  bronzeGame: true,
  consolationMode: 'none',
  classificationMode: 'none',
  seedingMethod: 'POOL_FINISH_CROSSOVER',
  firstRoundBuilder: ...,
  structureBuilder: ...,
}