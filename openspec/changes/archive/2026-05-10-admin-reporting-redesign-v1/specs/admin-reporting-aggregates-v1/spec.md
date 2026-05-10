# Delta for admin-reporting-aggregates-v1

## MODIFIED Requirements

### Requirement: Local aggregated metrics contract

(Previously: compute admin aggregates from local snapshots only)

The system MUST fetch admin aggregates from BE endpoints under `/api/admin/reports/*` and SHALL expose at least total users, totalники, total animals, and animales activos. Aggregates are derived server-side from `GANADERO`, `ANIMAL`, and related domain entities via Panache repositories.

#### Scenario: Aggregates fetched from server endpoint

- GIVEN an ADMIN opens the reporting page
- WHEN the BE is reachable
- THEN aggregate data is fetched from `/api/admin/reports/aggregates`
- AND displayed in the report summary area

#### Scenario: Aggregates unavailable (offline)

- GIVEN an ADMIN opens the reporting page with no backend connectivity
- WHEN the BE is unreachable
- THEN an error state is shown in the summary area
- AND no stale data is displayed from local cache

(Previously: aggregates computed locally from offline snapshots)

### Requirement: Bounded windows and predefined V1 filters

(Previously: predefined `7d`, `30d`, `90d` windows with ad-hoc filter rejection)

The system MUST support server-side bounded windows (`7d`, `30d`, `90d`) passed as query parameters to report endpoints. The BE validates window parameters and returns data only for the requested window. The FE MUST NOT compute aggregations client-side.

#### Scenario: Report uses 7d bounded window

- GIVEN an ADMIN requests Inventario por Ganadero with window `7d`
- WHEN the request reaches `/api/admin/reports/inventory-by-ganadero?window=7d`
- THEN only animals with activity in the last 7 days are included
- AND the response includes a `window` field indicating `7d`

#### Scenario: Invalid window parameter rejected by BE

- GIVEN an ADMIN requests a report with window `invalid`
- WHEN the BE evaluates the window parameter
- THEN the response is HTTP 400 with a validation error
- AND no report data is returned

(Previously: ad-hoc filters rejected client-side)

### Requirement: Remove local-only aggregate computation

The system MUST NOT compute aggregate metrics client-side from local offline snapshots in V1. All aggregate data MUST originate from `/api/admin/reports/*` endpoints.

#### Scenario: No local snapshot aggregation in reporting

- GIVEN an ADMIN is on the reporting page
- WHEN the page renders
- THEN no aggregate is computed from IndexedDB snapshots
- AND all displayed totals come from the BE JSON response

(Previously: V1 aggregates computed from local snapshots)