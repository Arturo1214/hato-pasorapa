# Delta for calendar-offline-schedule-v1

## MODIFIED Requirements

### Requirement: Local schedule projection from existing snapshots

(Previously: Derives from ANIMAL_HEALTH_EVENT, ANIMAL_REPRODUCTION_EVENT, ANIMAL_EVENT, ANIMAL snapshots)

The system MUST derive agenda items locally from `ANIMAL_HEALTH_EVENT` (specifically FIELD_VET_VISIT with nextControlAt), `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_EVENT`, and `ANIMAL` snapshots already stored offline, without creating new backend entities. GLOBAL visits with nextControlAt MUST also be projected as agenda items.

#### Scenario: Agenda incluye control global

- GIVEN a GLOBAL FIELD_VET_VISIT with nextControlAt=2026-05-20
- WHEN the agenda is projected
- THEN the item appears with label "Control Veterinario - Campanha"
- AND is associated with the visitId and modo=GLOBAL

#### Scenario: Agenda incluye control específica

- GIVEN an ESPECIFICA FIELD_VET_VISIT with nextControlAt=2026-05-20 linked to animalUuid=A
- WHEN the agenda is projected
- THEN the item appears with label "Control Veterinario" and animal reference

### Requirement: Timeline windows by day/week/month

(Previously: Deterministic views for day, week, month)

The system MUST provide deterministic timeline views for day, week, and month windows, and SHALL return the same ordering for equal input state. Items without a valid nextControlAt MUST be excluded from agenda views.

#### Scenario: Emparejar items sin fecha

- GIVEN a FIELD_VET_VISIT without nextControlAt
- WHEN the agenda is projected
- THEN the event is excluded from all timeline windows

## ADDED Requirements

### Requirement: Vet visit agenda classification by mode

The system SHOULD classify agenda items by visit mode (GLOBAL vs ESPECIFICA) to enable distinct UI treatment in calendar views, and SHALL expose the mode flag on agenda item projections.

#### Scenario: Badge para visita global

- GIVEN a GLOBAL visit agenda item
- WHEN the calendar cell is rendered
- THEN the UI applies a distinct indicator for campaign items