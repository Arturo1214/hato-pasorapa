# admin-reporting-operational-events-v1 Specification

## Purpose

Definir reportes operativos básicos V1 sobre eventos de animales, sin capacidades BI avanzadas.

## Requirements

### Requirement: Operational event counts by bounded window

The system MUST fetch operational event reports from `/api/admin/reports/health-activity` and SHALL return counts grouped by event type, filtered by date range. The BE MUST query `ANIMAL_HEALTH_EVENT` via Panache and return structured DTOs.

#### Scenario: Health activity report for date range

- GIVEN an ADMIN requests Actividad Sanitaria with `startDate=2025-01-01` and `endDate=2025-01-31`
- WHEN the request reaches `/api/admin/reports/health-activity?startDate=2025-01-01&endDate=2025-01-31`
- THEN the response contains health events within that range
- AND each event includes: date, type, animal ID, ganadero, lote, notes, status, nextDate, actor (if available)

#### Scenario: Health activity with no events in range

- GIVEN there are no health events between start and end dates
- WHEN the ADMIN requests the report
- THEN the response is an empty array
- AND no error is returned

(Previously: counts derived from local snapshots)

### Requirement: Basic recent activity list

The system SHALL expose a basic recent activity view sourced from BE endpoints (`/api/admin/reports/health-activity`) and ordered from newest to oldest.

#### Scenario: Recent activity sorted descending

- GIVEN multiple health events with distinct timestamps
- WHEN recent activity is rendered
- THEN the first item is the newest event
- AND ordering remains deterministic for equal timestamps

### Requirement: Explicit V1 exclusions for operational reporting

The operational reporting scope MUST NOT include drill-down libre, configurable dashboards, PDF exports, scheduled reports, predictive analytics, optimization recommendations, or automatic decision suggestions in V1. It MUST NOT trigger automatic execution of actions and SHALL keep decision outcomes manual and explainable. Excel export via FE client-side library is the only export capability in V1.

#### Scenario: User attempts excluded capability

- GIVEN an admin attempts an excluded reporting feature
- WHEN the action is evaluated in V1
- THEN the feature is unavailable in this capability
- AND no advanced reporting artifact is generated

#### Scenario: User attempts optimization-oriented view

- GIVEN an admin requests recommendation or optimization outputs
- WHEN scope validation runs
- THEN the request is rejected as out-of-scope

#### Scenario: User attempts automatic action execution

- GIVEN an admin attempts "auto-apply" from an insight
- WHEN action policy is evaluated
- THEN execution is blocked in V1
- AND the UI requires a manual follow-up decision

### Requirement: Health activity supports Excel export

The system SHALL allow the Actividad Sanitaria report dataset to be exported via the FE Excel export button with Spanish column headers.

#### Scenario: Export Actividad Sanitaria to XLSX

- GIVEN an ADMIN has loaded Actividad Sanitaria with filtered results
- WHEN the ADMIN clicks "Exportar Excel"
- THEN a file `Reporte_ActividadSanitaria_YYYYMMDD.xlsx` is downloaded
- AND it contains columns: Fecha, Tipo, Animal, Ganadero, Lote, Notas, Estado, Próxima Fecha, Actor

(Previously: no Excel export capability)

### Requirement: Remove local event snapshot dependency

The system MUST NOT source operational event data from local `ANIMAL_EVENT`, `ANIMAL_REPRODUCTION_EVENT` snapshots in V1. All event reports MUST come from BE endpoints.

#### Scenario: No local event snapshot used for reports

- GIVEN an ADMIN is on the Actividad Sanitaria report
- WHEN the data loads
- THEN the report data comes from `/api/admin/reports/health-activity`
- AND no IndexedDB event snapshots are queried

(Previously: reports derived from local snapshots)
