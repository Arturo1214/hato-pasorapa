# Archive Report: integral-herd-management-v2

## Change Status

`integral-herd-management-v2` was archived successfully in **hybrid** mode.

**Archived to:** `openspec/changes/archive/2026-04-28-integral-herd-management-v2/`

## Artifact Retrieval and Traceability

Required prior artifacts were resolved in Engram under:

- `sdd/integral-herd-management-v2/proposal` (`observation: 1330`)
- `sdd/integral-herd-management-v2/spec` (`observation: 1332`)
- `sdd/integral-herd-management-v2/design` (`observation: 1331`)
- `sdd/integral-herd-management-v2/tasks` (`observation: 1333`)
- `sdd/integral-herd-management-v2/apply-progress` (`observation: 1335`)
- `sdd/integral-herd-management-v2/verify-report` (`observation: 1337`)

OpenSpec filesystem artifacts used for archival:

- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/proposal.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/design.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/tasks.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/apply-progress.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/verify-report.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/exploration.md`
- `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/**/spec.md`

## Specs Synced

| Domain | Action | Source Delta | Details |
|--------|--------|--------------|---------|
| `herd-lot-offline-sync-v2` | Created | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/herd-lot-offline-sync-v2/spec.md` | Added lot lifecycle + temporal assignment and overlap-rejection requirements. |
| `herd-productivity-ledger-v2` | Created | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/herd-productivity-ledger-v2/spec.md` | Added identity/dedup/validation requirements for productivity ledgers. |
| `herd-cost-ledger-v2` | Created | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/herd-cost-ledger-v2/spec.md` | Added classification/validation requirements for cost ledgers. |
| `herd-descriptive-indicators-projection-v2` | Created | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/herd-descriptive-indicators-projection-v2/spec.md` | Added bounded-window descriptive KPI projection requirements. |
| `admin-reporting-aggregates-v1` | Modified | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/admin-reporting-aggregates-v1/spec.md` | Extended preset/windows rules, lot dimension, and explicit exclusions. |
| `admin-reporting-operational-events-v1` | Modified | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/admin-reporting-operational-events-v1/spec.md` | Added explicit out-of-scope exclusions (no predictive/optimization UI behavior). |
| `sync-entity-resolution-policy-v2` | Modified | `openspec/changes/archive/2026-04-28-integral-herd-management-v2/specs/sync-entity-resolution-policy-v2/spec.md` | Included `HERD_LOT`, `HERD_LOT_ASSIGNMENT`, `HERD_PRODUCTIVITY_LEDGER`, `HERD_COST_LEDGER` in policy matrix. |

### Target main specs updated

- `openspec/specs/herd-lot-offline-sync-v2/spec.md`
- `openspec/specs/herd-productivity-ledger-v2/spec.md`
- `openspec/specs/herd-cost-ledger-v2/spec.md`
- `openspec/specs/herd-descriptive-indicators-projection-v2/spec.md`
- `openspec/specs/admin-reporting-aggregates-v1/spec.md`
- `openspec/specs/admin-reporting-operational-events-v1/spec.md`
- `openspec/specs/sync-entity-resolution-policy-v2/spec.md`

## Verification Summary

- **Completion:** `24/24` tasks complete.
- **Verification result:** `PASS WITH WARNINGS`.
- **Critical issues:** None.
- **Warnings:** Two scenarios remain partial (`Create lot and assign animals offline`, `Explicit exclusion blocks manual resolution`) with non-blocking recommendations logged in verify report.

## Verification Source of Truth

- Engram artifact: `sdd/integral-herd-management-v2/verify-report`
- Archived artifact: `openspec/changes/archive/2026-04-28-integral-herd-management-v2/verify-report.md`

## Archive Integrity Check

- ✅ Change folder archived with date prefix.
- ✅ Archive contains proposal, design, tasks, apply-progress, verify-report, exploration, and specs.
- ✅ Change no longer exists under `openspec/changes/`.
- ✅ Main specs reflect merged deltas.

## Scope retained in specs

- ✅ Lotes/asignaciones, ledger de costos/productividad, indicadores descriptivos locales.
- ✅ Alcance explícito fuera de scope: sin BI predictiva, sin optimización automática, sin integraciones financieras externas.

## Next Step

SDD cycle complete for `integral-herd-management-v2` (proposed → specified → designed → implemented → verified → archived).
