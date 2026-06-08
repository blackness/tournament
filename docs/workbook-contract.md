# AthleteOS Workbook Contract

This document defines the workbook sheets supported by AthleteOS, their intended meaning, and how they participate in import/export flows.

## Purpose
AthleteOS workbook support is intended to help directors:
- define tournament structure
- bulk edit setup data
- export and refine generated schedules
- re-import data into the wizard safely

This contract should be treated as the source of truth for workbook sheet behavior.

---

# Workbook Philosophy

## Current v1 role
The workbook is primarily a **wizard-assisted import/export tool**, not a full direct DB admin interface.

Typical flow:
1. export workbook from wizard
2. edit workbook in Excel
3. upload workbook
4. apply to wizard state
5. save relevant wizard step(s) to persist to DB

## Important rule
Workbook upload often updates wizard state first.  
Do not assume workbook upload instantly persists everything to DB.

---

# Example Rows

Many editable sheets may include an example row.

## Marker column
```txt
example_row