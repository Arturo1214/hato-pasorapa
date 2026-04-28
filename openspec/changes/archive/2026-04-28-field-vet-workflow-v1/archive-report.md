# Change Archived

**Change**: field-vet-workflow-v1
**Mode**: hybrid
**Archived to**: `openspec/changes/archive/2026-04-28-field-vet-workflow-v1/`

## Specs Synced

| Domain | Action | Details |
|---|---|---|
| `field-vet-visit-workflow-v1` | Created | New full spec added for V1 field vet visit flow with visit offline/idempotent flow, checklist + clinical note, protocol lifecycle states, basic follow-up listing, and explicit V1 exclusions. |
| `animal-health-event-ledger-v1` | Updated | Added `FIELD_VET_VISIT` typed metadata contract, added visit-based filtering requirement, and expanded scope exclusions to include billing/costing and complex prescription-rule payloads. |
| `animal-health-treatment-follow-up-v1` | Updated | Added protocol-derived follow-up requirement (`STARTED/FOLLOW_UP` => `ACTIVE`, `CLOSED` => `CLOSED`) and updated per-animal timeline requirement to include vet-visit protocol states + optional visit filtering. |

### Source of Truth Updated

- `openspec/specs/field-vet-visit-workflow-v1/spec.md`
- `openspec/specs/animal-health-event-ledger-v1/spec.md`
- `openspec/specs/animal-health-treatment-follow-up-v1/spec.md`

## Archive Contents

- exploration.md ✅
- proposal.md ✅
- specs/ ✅ (`field-vet-visit-workflow-v1`, `animal-health-event-ledger-v1`, `animal-health-treatment-follow-up-v1`)
- design.md ✅
- tasks.md ✅
- apply-progress.md ✅
- verify-report.md ✅ (`PASS WITH WARNINGS`, no CRITICAL)
- archive-report.md ✅

## V1 Scope Assertions

- Visitas veterinarias de campo quedaron cubiertas por contrato (registro, checklist, nota clínica y protocolo).
- `visitId` se modela separado de `operationId` y se usa para filtro/proyección por visita.
- La UI quedó desacoplada a feature dedicada (`vet-visits`).
- Facturación/costos, analítica avanzada, prescripción compleja y multimedia permanecen explícitamente fuera de alcance en las specs.

## Verification Notes

- Source verification: `openspec/changes/archive/2026-04-28-field-vet-workflow-v1/verify-report.md`
- Final verdict: `PASS WITH WARNINGS` (coverage tooling limitations and one parcialmente mapeado en especificación de `occurredAt` inválido)
- Critical blockers: `0`

## Archive Integrity Check

- ✅ OpenSpec main specs were updated before moving the change folder.
- ✅ Active directory `openspec/changes/field-vet-workflow-v1` no longer exists.
- ✅ Archive trail preserved under `openspec/changes/archive/2026-04-28-field-vet-workflow-v1/`.
