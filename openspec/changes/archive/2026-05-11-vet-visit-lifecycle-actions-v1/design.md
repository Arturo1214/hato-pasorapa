# Design: Vet Visit Lifecycle Actions V1

## Technical Approach

Implement the lifecycle as action-specific Angular Material dialogs over the existing admin list and keep persistence through `AnimalsHealthEventsService.createEvent()`. Backend keeps the current `FIELD_VET_VISIT` metadata JSON model, but validates the new clinical contract and projects cost/plan summaries through `/api/vet-visits`. `Finalizar` is removed from row actions; closure is chosen from the attend flow.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Cancel UX | New standalone `VetVisitCancelDialogComponent` returning `cancelReason` | Reuse full visit form | Cancel is a small destructive action; separate dialog avoids accidental clinical-field coupling. |
| Attend UX | Extend `VetVisitFormDialogComponent` with `action: 'create'|'attend'|'reschedule'|'followUp'` and conditional fields | Separate wizard component | Existing form already owns visit metadata, animal lookup, dates, and validation; action mode keeps the page thin. |
| Treatment plan | Store `clinicalNote.plan` as `string[]` ordered treatment steps; read old string as one legacy step | Replace plan with findings | Proposal decision keeps plan as distinct “Plan de tratamiento”; array supports dynamic UI and backward compatibility. |
| Cost contract | Store top-level metadata `cost: { amount: number, currency: 'BOB' }`; project `costo: number|null` and `costCurrency` | Store under `visit.cost` | Existing animal detail already reads top-level `metadata.cost`; projection keeps list simple while preserving currency. |
| Metadata storage | No migration; `AnimalHealthEvent.metadata_json` is `CLOB` | Add columns | Current column is unconstrained CLOB, enough for cost + plan arrays. Validate max sizes instead of schema migration. |

## Data Flow

    DataTable row action
      ├─ cancel ─→ CancelDialog ─→ map cancel event ─→ createEvent ─→ mapper validation
      └─ attend ─→ VisitDialog(action=attend)
            ├─ finalize chain: status FINALIZED, protocol CLOSED
            └─ follow-up: status ATTENDED + nextDueAt, then create linked PENDING visit(parentVisitId)
                                  └─ /api/vet-visits projects cost/plan summary

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.ts` | Create | Required reason textarea and Spanish validation. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Modify | Add action mode, findings, notes, cost, dynamic treatmentPlan step list, follow-up/finalize choice. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Modify | Remove `finalize`; branch `handleRowAction`; create cancel/attend/follow-up events. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Modify | Map `cost`, `cancelReason`, `clinicalNote.plan` array; preserve old string reads in helpers. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | Modify | Add `costo`, `costCurrency`, `treatmentPlan`. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Add typed cost, cancelReason, and `plan?: string | string[]`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modify | Allow `cost` only for FIELD_VET_VISIT; validate cancel reason, findings, cost, plan list/string. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modify | Project cost/plan and keep follow-up/closure continuity. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/vetvisit/VetVisitItemDto.java` | Modify | Add `BigDecimal costo`, `String costCurrency`, `List<String> treatmentPlan`. |
| Existing `*.spec.ts` / `VetVisitResourceTest.java` | Modify | Cover actions, forms, mapper, projection, validation. |

## Interfaces / Contracts

```ts
metadata: {
  visit: { visitId, mode, status, parentVisitId?, cancelReason?, veterinarian, targetAnimalCount? },
  cost?: { amount: number, currency: 'BOB' },
  clinicalNote: { reason: string, findings?: string, plan?: string[] | string },
  atencionNotas?: string,
  protocol: { status: 'STARTED'|'FOLLOW_UP_REQUIRED'|'CLOSED', nextDueAt?: string }
}
```

Validation: `CANCELED` requires `visit.cancelReason` length 5..500; `ATTENDED/FINALIZED` require `clinicalNote.findings` and `atencionNotas`; cost amount must be finite `>= 0` with currency `BOB`; plan array max 20 steps, each 1..300 chars. Old string `plan` is accepted and projected as a single-item list.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit | Row actions, cancel dialog, attend validators, dynamic plan list, mapper payload | Update colocated Vitest specs. |
| BE integration | Metadata validation, cost acceptance only for vet visits, projection fields | Extend `VetVisitResourceTest`; add mapper/service validation cases where existing tests live. |
| E2E | Not configured | Document manual smoke: cancel, attend+finalize, attend+follow-up. |

## Migration / Rollout

Phased implementation: (1) backend validation/projection + DTOs, (2) FE contracts/mapper, (3) dialogs/actions, (4) history/list display tests. No DB migration required because `metadata_json` is CLOB. Rollback is code-only; optional fields keep old records readable.

## Open Questions

- None.
