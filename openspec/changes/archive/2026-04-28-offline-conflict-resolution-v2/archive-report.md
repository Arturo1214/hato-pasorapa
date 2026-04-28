# Change Archived

**Change**: offline-conflict-resolution-v2
**Archived to**: `openspec/changes/archive/2026-04-28-offline-conflict-resolution-v2/`

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `offline-conflict-resolution-v2` | Created | Contrato transversal de diff visual, acciones manuales y reintento (`accept_server|retry_local|discard_local`) para conflictos de `/api/sync` con idempotencia por `operationId`. |
| `sync-entity-resolution-policy-v2` | Created | Política explícita por entidad/opType como source-of-truth (acciones permitidas, hints, exclusiones y elegibilidad de retry). |
| `sync-conflict-audit-ledger-v2` | Created | Ledger consultable y append-only de conflictos/decisiones humanas (`operationId`, actor, timestamp, reason, decision, result). |
| `animal-image-offline-sync-v1` | Modified | Requisito de reconciliación actualizado para incorporar exclusiones de resolución manual y compatibilidad con flujo de conflicto V2. |
| `animal-health-offline-sync-v1` | Modified | Requisito de idempotencia actualizado para exigir resolución válida por política antes de reintento y preservar contrato de `operationId`. |
| `animal-reproduction-offline-sync-v1` | Modified | Requisito de idempotencia actualizado para incluir outcomes de conflicto (`accept_server|retry_local|discard_local`) en replay bloqueado. |
| `animal-event-offline-sync-v1` | Modified | Requisito de replay actualizado para emitir metadata de conflicto en `CONFLICT`. |

## Scope and Behavior Captured
- ✅ **In scope explícito**: policy source-of-truth por entidad/opType, diff visual por operación (`local` vs `server`), acciones manuales `accept_server|retry_local|discard_local`, auditoría append-only y compatibilidad con `/api/sync`.
- ✅ **Compatibilidad V1 preservada**: resolución manual habilitada sin romper contrato base de `/api/sync` (incluye `manual_refresh`/flujo previo cuando no aplica V2).
- ❌ **Fuera de scope retenido**: merge inteligente por IA, colaboración en tiempo real, edición previa al `retry_local`.

## Archive Contents
- exploration.md ✅
- proposal.md ✅
- specs/ ✅ (7 specs)
- design.md ✅
- tasks.md ✅ (29/29 tasks complete)
- apply-progress.md ✅
- verify-report.md ✅ (`PASS WITH WARNINGS`, no CRITICAL)
- archive-report.md ✅

## Source of Truth Updated
- `openspec/specs/offline-conflict-resolution-v2/spec.md`
- `openspec/specs/sync-entity-resolution-policy-v2/spec.md`
- `openspec/specs/sync-conflict-audit-ledger-v2/spec.md`
- `openspec/specs/animal-image-offline-sync-v1/spec.md`
- `openspec/specs/animal-health-offline-sync-v1/spec.md`
- `openspec/specs/animal-reproduction-offline-sync-v1/spec.md`
- `openspec/specs/animal-event-offline-sync-v1/spec.md`

## Artifact Retrieval and Traceability

- Engram artifacts were searched by topic key but were not found in this workspace:
  - `sdd/offline-conflict-resolution-v2/explore`
  - `sdd/offline-conflict-resolution-v2/proposal`
  - `sdd/offline-conflict-resolution-v2/spec`
  - `sdd/offline-conflict-resolution-v2/design`
  - `sdd/offline-conflict-resolution-v2/tasks`
  - `sdd/offline-conflict-resolution-v2/apply-progress`
  - `sdd/offline-conflict-resolution-v2/verify-report`
- Filesystem artifacts were read and moved from `openspec/changes/offline-conflict-resolution-v2/` to `openspec/changes/archive/2026-04-28-offline-conflict-resolution-v2/` before archival.

## Verification Status
- Resultado: `PASS WITH WARNINGS` (sin issues críticos).
- Warnings: cobertura FE con `@vitest/coverage-v8` faltante (no funcional).

## Archive Integrity Check
- ✅ Main specs updated in `/openspec/specs`.
- ✅ Change folder moved to `openspec/changes/archive/2026-04-28-offline-conflict-resolution-v2/`.
- ✅ Active `openspec/changes/offline-conflict-resolution-v2/` removed.
- ✅ Artifact trail preserved.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
