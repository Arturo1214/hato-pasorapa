# Archive Report: sync-observability-v2

## Change

- Name: `sync-observability-v2`
- Mode: `hybrid`
- Archived to: `openspec/changes/archive/2026-04-28-sync-observability-v2/`

## Evidence (artifact IDs)

- `sdd/sync-observability-v2/explore`: `#1270`
- `sdd/sync-observability-v2/proposal`: `#1271`
- `sdd/sync-observability-v2/spec`: `#1272`
- `sdd/sync-observability-v2/design`: `#1273`
- `sdd/sync-observability-v2/tasks`: `#1274`
- `sdd/sync-observability-v2/apply-progress`: `#1275`
- `sdd/sync-observability-v2/verify-report`: `#1278`

## Verification result

- Final verification: **PASS WITH WARNINGS**
- No critical blockers.

## Scope explicitly confirmed

### In scope
- Diccionario único de métricas V2 (runtime + histórico) entre FE/BE.
- Runtime FE de observabilidad (snapshot por ciclo, cola/outbox, errores y salud por entidad).
- Histórico agregado BE por ventana fija `24h` y `7d`.
- Endpoint operativo `GET /api/sync/observability`.
- UI operativa en `/admin/sync-observability`.
- Persistencia agregada de métricas en `sync_operation_receipts` + `sync_conflict_audit_ledger`.

### Explicitly out of scope
- Observabilidad enterprise/APM/monitoring externo.
- Alerting enterprise (PagerDuty/Slack/email).
- Rediseño de protocolo `/api/sync`.

## Specs sync

### Domain: `sync-observability-runtime-history-v2`

- Action: **Created** (main spec did not exist)
- Source delta: `openspec/changes/sync-observability-v2/specs/sync-observability-runtime-history-v2/spec.md`
- Target main spec: `openspec/specs/sync-observability-runtime-history-v2/spec.md`
- Requirement sections carried: 6 (Runtime snapshot, queue state, errors/conflicts, entity status, historical aggregates, non-goals)

## Archive contents moved

- `exploration.md`
- `proposal.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`
- `specs/` (including `sync-observability-runtime-history-v2/spec.md`)

## Filesystem verification

- Active change folder removed: `openspec/changes/sync-observability-v2/` no longer exists.
- Archive present: `openspec/changes/archive/2026-04-28-sync-observability-v2/`
- Main spec updated: `openspec/specs/sync-observability-runtime-history-v2/spec.md`

## Notes

- Operación de warning relevante para operación: ejecución de `./mvnw` requiere Java 21 explícito (`JAVA_HOME`) para evitar incompatibilidad con classfiles en el entorno CI.
- Build FE reportó warning de `bundle budget` sin impacto funcional.
