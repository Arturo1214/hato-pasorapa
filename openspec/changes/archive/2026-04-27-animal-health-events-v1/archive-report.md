# Archive Report: animal-health-events-v1

## Change Status

`animal-health-events-v1` was archived successfully in **hybrid** mode.

**Archived to:** `openspec/changes/archive/2026-04-27-animal-health-events-v1/`

## Artifact Retrieval and Traceability

- Engram artifacts were not found for the required prior change phases under these topic keys:
  - `sdd/animal-health-events-v1/explore`
  - `sdd/animal-health-events-v1/proposal`
  - `sdd/animal-health-events-v1/spec`
  - `sdd/animal-health-events-v1/design`
  - `sdd/animal-health-events-v1/tasks`
  - `sdd/animal-health-events-v1/apply-progress`
  - `sdd/animal-health-events-v1/verify-report`
- The change was archived from filesystem artifacts in `openspec/changes/animal-health-events-v1/` before the folder was moved.

## Specs Synced

| Domain | Action | Source Delta | Details |
|--------|--------|--------------|---------|
| `animal-health-treatment-follow-up-v1` | Created | `openspec/changes/archive/2026-04-27-animal-health-events-v1/specs/animal-health-treatment-follow-up-v1/spec.md` | Follow-up/treatment lifecycle requirements added as new main spec |
| `animal-health-offline-sync-v1` | Created | `openspec/changes/archive/2026-04-27-animal-health-events-v1/specs/animal-health-offline-sync-v1/spec.md` | Offline-first + idempotence + incremental pull requirements added as new main spec |
| `animal-health-event-ledger-v1` | Created | `openspec/changes/archive/2026-04-27-animal-health-events-v1/specs/animal-health-event-ledger-v1/spec.md` | Separate sanitary ledger requirements added as new main spec |

### Target main specs updated

- `openspec/specs/animal-health-treatment-follow-up-v1/spec.md`
- `openspec/specs/animal-health-offline-sync-v1/spec.md`
- `openspec/specs/animal-health-event-ledger-v1/spec.md`

## Verification Summary

- **Completion:** 24/24 tasks complete.
- **Verification result:** PASS WITH WARNINGS.
- **Critical issues:** None.
- **Warning:** reconnect scenario for sanitario has partial coverage (`should trigger one sync on startup and another on reconnect when connectivity returns` exists, but not explicitly asserting outbox `ANIMAL_HEALTH_EVENT` push), non-blocking per scope.

## Scope captured in archived specs

- ✅ Agregado sanitario **separado** (`animal_health_events`, `ANIMAL_HEALTH_EVENT`), sin mezclar con `animal_events` operativo.
- ✅ `metadata` sanitaria **tipada** con reglas explícitas por tipo V1.
- ✅ Comportamiento **append-only** (create/list, sin update en V1), operación idempotente por `operationId`.
- ✅ **Seguimiento básico** de tratamiento con `TREATMENT_STARTED/FOLLOW_UP/CLOSED` y estado derivado.
- ✅ Flujo **offline-first** (queue-first, push/pull incremental, cursor, idempotencia).

## Explicit Out of Scope retained in this change

- ❌ Reproducción (`celo/servicio/preñez/parto/genética`) no forma parte del V1.
- ❌ Imágenes y otros adjuntos clínicos no soportados.
- ❌ Event sourcing total del agregado animal: no reconstrucción integral del agregado en este cambio.

## Archive Integrity Check

- ✅ Change folder moved to `openspec/changes/archive/2026-04-27-animal-health-events-v1/`
- ✅ Archive contains: proposal, design, tasks, apply-progress, verify-report, specs.
- ✅ Active change folder removed from `openspec/changes/`.
- ✅ Main specs updated with synchronized deltas.

## Next Step

SDD cycle complete for `animal-health-events-v1` (proposed → specified → designed → implemented → verified → archived).
