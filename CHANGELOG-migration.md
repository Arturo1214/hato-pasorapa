# Migration Changelog

## 2026-05-13 — animal-event-log-consolidation-v1 Phase 3.5

- Finalized the development-time migration for animal event log consolidation.
- `020-animal-event-log-consolidation-v1.yaml` now copies legacy `animal_events`, `animal_health_events`, and `animal_reproduction_events` rows into `animal_event_logs` with `GENERAL`, `HEALTH`, and `REPRODUCTION` categories.
- Added temporary compatibility views: `animal_events_view`, `animal_health_events_view`, and `animal_reproduction_events_view`.
- Regression coverage verifies migrated row counts and view projections are equivalent to category-filtered unified log queries.
- Phase 4 cleanup is intentionally deferred until remaining service/repository references to legacy tables are removed safely.
