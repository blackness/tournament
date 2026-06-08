# AthleteOS Data Shapes

This document defines the important data shapes used across AthleteOS.

## Purpose
AthleteOS uses multiple shape layers:

1. **Wizard/store state**  
   Usually camelCase, optimized for React/Zustand UI usage.

2. **Workbook normalized rows**  
   Usually snake_case, optimized for workbook validation/import.

3. **Database rows**  
   Usually snake_case, matching Supabase/Postgres tables.

A major source of bugs has been accidental mixing of these layers.  
When implementing features, always confirm which shape layer is being used.

---

# General Mapping Rule

## Wizard/store
- camelCase
- local IDs allowed
- UI-friendly
- may include temporary/generated values

## Workbook normalized
- snake_case
- validation-friendly
- often sheet-row based
- derived from uploaded workbook tabs

## DB
- snake_case
- persistent IDs
- strict constraints
- tied to RLS and relational integrity

---

# 1. Tournament Basics

## Wizard/store shape
```js
{
  tournamentId,
  name,
  slug,
  description,
  startDate,
  endDate,
  timezone,
  venueName,
  venueAddress,
  isPublic,
  primaryColor,
  logoUrl,
  tiebreakerOrder,
  sotgEnabled,
  sportTemplateId,
  sportSlug,
  sportConfig,
  enabledStatIds,
}