# Delta for admin-reporting-operational-events-v1

## MODIFIED Requirements

### Requirement: Operational event counts by bounded window

(Previously: derive from local snapshots with 7d/30d windows)

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

### Requirement: Health activity supports Excel export

The system SHALL allow the Actividad Sanitaria report dataset to be exported via the FE Excel export button. The export MUST include all filtered rows with Spanish column headers.

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