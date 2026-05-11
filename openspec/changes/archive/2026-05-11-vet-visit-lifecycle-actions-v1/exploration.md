# Exploration: vet-visit-lifecycle-actions-v1

## Current State

### Actions in the List

The vet visits page (`vet-visits-page.component.ts` lines 111-116) exposes four row actions:

| id | label | icon | visible condition |
|----|-------|------|-------------------|
| `attend` | Atender | `medical_services` | `status === 'PENDING' || status === 'RESCHEDULED'` |
| `reschedule` | Reprogramar | `event_repeat` | `status === 'ATTENDED'` |
| `finalize` | Finalizar | `task_alt` | `status === 'PENDING' || 'ATTENDED' || 'RESCHEDULED'` |
| `cancel` | Cancelar | `cancel` | `status === 'PENDING' || 'RESCHEDULED'` |

Current `handleRowAction` (line 150) dispatches **all** actions through the same `VetVisitFormDialogComponent` with `data` carrying `{ mode, parentVisitId, targetAnimalCount }`. The dialog does NOT differentiate between `attend`, `reschedule`, `finalize`, and `cancel` — it always renders as "Nueva visita veterinaria" (line 56). The action `id` is thrown away.

### Cancel Flow — Gap

`cancel` action exists but **no cancellation reason is captured**. The backend `validateFieldVetVisit` (`AnimalHealthEventMapper.java` line 260) reads `visit.get("status")` and rejects invalid transitions, but there is no field for `cancelReason` anywhere in the metadata schema. The `rejectOutOfScopeAttachments` (line 224) explicitly blocks any field containing `cost`, `costo`, `price`, `billing` — so there is no cost field either.

### Atender Flow — Gap

When `status === 'ATTENDED'`, the dialog shows `Notas de atención` (line 122) and the `attendedNotesValidator` (line 266) enforces it is not blank. However:
- There is **no `descripción/hallazgos` field** separate from `reason`.
- There is **no `costo` field** in the dialog or mapper.
- `findings` is mapped in the mapper (line 48) but the dialog does NOT expose it.
- `plan` is mapped in the mapper (line 49) but the dialog does NOT expose it.

### Backend Metadata Validation

`validateFieldVetVisit` (lines 260-317) validates:
- `visit.visitId` (required)
- `visit.mode` (GLOBAL | SPECIFIC | ESPECIFICA)
- `visit.status` (PROGRAMADA/ATENDIDA/REPROGRAMADA/FINALIZADA/CANCELADA | PENDING/ATTENDED/RESCHEDULED/FINALIZED/CANCELED)
- `visit.veterinarian.name` (required)
- `visit.atencionNotas` or `metadata.atencionNotas` — **required when status is ATTENDED** (lines 274-280)
- `checklist` — required list of 5 typed items
- `clinicalNote.reason` (required), `findings` (optional), `plan` (optional)
- `protocol.status` (STARTED | FOLLOW_UP_REQUIRED | CLOSED), `protocol.nextDueAt` (required if FOLLOW_UP_REQUIRED)

The `plan` field is stored in `clinicalNote.plan`, accepted as optional, and validated as free text only (line 304). The backend never enforces it or derives any behavior from it.

### Cost — Gap

The backend mapper `rejectOutOfScopeAttachments` (lines 225-235) **explicitly blocks** any metadata key containing `cost`, `costo`, `price`, `billing`, `amount`. The FE has `readCostLabel` (animal-detail-page.component.ts line 1190) that reads `metadata['cost']` or `metadata['costo']` — but this code **never executes against live API data** because the BE rejects these fields before persisting. The `VetVisitItemDto` has no cost field (line 15).

### Follow-up / Próximo Control — Already Supported

`nextControlAt` / `nextDueAt` already exists in both BE and FE. The `protocol.nextDueAt` field drives the `FOLLOW_UP_REQUIRED` → `CLOSED` transition. A visit in `ATTENDED` status with `nextDueAt` triggers `canContinue` (`reschedule` action). The `parentVisitId` field already exists in metadata (line 281 of mapper, FE mapper line 38) — meaning the model already supports linking a new visit as a follow-up to a parent visit.

However, **no action in the UI actually creates a linked follow-up visit**. `handleRowAction` passes `parentVisitId` as data to the dialog (line 154) but only when the user explicitly clicks a row action — there is no "schedule follow-up" flow triggered from within the `attend` action.

### Animal Health Timeline Detail

`readCostLabel` (animal-detail-page.component.ts line 1190) already attempts to read `cost`/`costo` from metadata, looking at nested `{ amount, currency }` structures. This suggests the intent is clear but the BE integration is missing.

---

## Affected Areas

| File | Why Affected |
|------|--------------|
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Remove `finalize` action; change `handleRowAction` to differentiate `cancel` → cancel modal |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Add findings field; add cost field; add cancel reason field; differentiate form for attend vs. reschedule |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Map findings, cost, cancelReason |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | `VetVisitItem` needs `costo` field |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Accept `cancelReason` in visit block; accept `cost` in metadata (remove from reject list); validate `findings` required on ATTENDED |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/vetvisit/VetVisitItemDto.java` | Add `costo` field |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Add cost to `toVetVisitItem` projection; validate cancelReason presence on CANCELADA |
| `hato-fe/src/app/core/offline/offline-types.ts` | Add `cost?: { amount: number; currency: string }` to `FieldVetVisitBlock`; add `cancelReason?: string` |

---

## Approaches

### 1. Minimal Cancel-Modal + Attend-Form Enhancement

**Approach**: Add a dedicated `CancelVisitDialogComponent` (simple text input + confirm) and extend `VetVisitFormDialogComponent` with a `VetVisitDialogMode = 'CREATE' | 'ATTEND' | 'RESCHEDULE'` flag. On `ATTEND`, show `findings` + `costo` fields. Remove `finalize` from the list. `plan` stays as-is (optional, free text).

- Pros: Surgical change; minimal risk; separates concerns cleanly
- Cons: Doesn't address `plan` semantics; no redesign of the follow-up creation UX
- Effort: Low-Medium

### 2. Full Dialog Refactor with Follow-up Wizard

**Approach**: When `attend` is clicked, show a 2-step dialog: Step 1 = findings + cost + notes; Step 2 = choose between "Schedule próximo control" (opens a new visit pre-linked via `parentVisitId`) or "Finalizar tratamiento" (sets status to `FINALIZED`). Replace `VetVisitFormDialogComponent` with a routing-free stepper. `plan` field is removed from the clinical note and its content is merged into `findings`.

- Pros: Solves the UX gap for follow-up creation; removes ambiguous `plan`
- Cons: Larger change; more tests needed; stepper adds complexity
- Effort: High

### 3. Two-Phase Delivery (Recommended)

**Phase 1**: Cancel modal + Findings field + Cost field + Backend acceptance. Remove `finalize` action. Keep `plan` for now but add a `TODO: evaluate folding plan into findings` comment.

**Phase 2**: Follow-up creation wizard via `parentVisitId` pre-fill. Postpone `plan` decision.

- Pros: Delivers user-facing value in Phase 1; Phase 2 is scoped and clear; plan decision deferred with documented intent
- Cons: Slightly longer overall timeline
- Effort: Medium split across two phases

---

## Recommendation

**Approach 3 — Two-Phase Delivery**

### Phase 1 Scope

1. **Remove `finalize`** from `vet-visits-page.component.ts` action list. The user only needs `Atender` initially; finalization is handled inside the attend flow.
2. **Add `CancelVisitDialogComponent`**: Simple modal with required `<textarea>` for cancellation reason. On confirm, calls `healthEventsService.createEvent()` with `status: 'CANCELED'` and `cancelReason` in metadata.
3. **Extend `VetVisitFormDialogComponent`**: When `status = 'ATTENDED'` (i.e., opened via `attend` action), show:
   - `Hallazgos / Descripción` field (textarea, maps to `clinicalNote.findings`)
   - `Costo` field (number input, maps to `cost.amount` with hardcoded `currency: 'BOB'`)
4. **Backend changes** (`AnimalHealthEventMapper`):
   - Remove `cost`/`costo`/`amount`/`price`/`billing` from the `rejectOutOfScopeAttachments` block (line 229-230)
   - Accept `cancelReason` as optional string in `visit` block
   - When `visit.status = 'CANCELED'` and `cancelReason` is null, throw `ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED`
   - When `visit.status = 'ATTENDED'`, require `clinicalNote.findings` (not null/empty)
5. **Add `costo`** to `VetVisitItemDto` and project it from `visit.cost?.amount`.
6. **`VetVisitItem`** FE type gets `costo: number | null`.
7. **`VetVisitService`** returns the new field.

### Phase 2 Scope

1. **Follow-up creation flow**: `attend` action opens dialog; after filling findings/cost/notes, user chooses:
   - "Programar próximo control" → pre-fills a new `VetVisitFormDialogComponent` with `parentVisitId = current.visitId`, `mode = current.mode`, `status = 'PENDING'`
   - "Finalizar" → sets `status = 'FINALIZED'`, no follow-up
2. The timeline will naturally show all linked visits via `parentVisitId` / `visitId` grouping.

---

## `plan` Analysis

### Current State

`clinicalNote.plan` is stored in metadata. It's populated by the FE mapper from `VetVisitFormDialogComponent` form value `clinicalNote.plan` — but **the dialog has no `plan` field** (only `reason` and conditionally `notes`). The mapper hardcodes an empty string for `plan` when creating a visit (`vet-visits-page.component.ts` line 318: `plan: ''`).

The spec (`field-vet-visit-workflow-v1/spec.md` line 35) says `plan` is part of the clinical note but it is RFC 2119 "SHALL" (not "MUST") and the spec does not derive any behavior from it.

### Distinguishing `plan` vs `findings` vs `notes`

| Field | Intent | Current Usage |
|-------|--------|---------------|
| `reason` | Why the visit happened (admission reason) | Required, shown in timeline |
| `findings` | What the vet observed/diagnosed | Optional, shown in timeline on ATTENDED |
| `plan` | What to do next / follow-up instructions | Optional, **never shown in UI**, no BE behavior |
| `notes` / `atencionNotas` | Free-text notes from the visit | Shown in timeline and list |

### Recommendation on `plan`

**Fold `plan` into `findings`**: `plan` is semantically indistinguishable from `findings` in practice — both describe the vet's assessment and intended actions. The UI never surfaces `plan` independently. 

**Recommended action**:
- Remove `plan` as a separate field from `FieldVetClinicalNote` in `offline-types.ts`.
- In the BE mapper, accept `plan` for backward compatibility but ignore it (no validation, no error).
- Document this as a **deprecation**: future versions will stop accepting `plan` and remove it.
- This keeps existing stored data valid while simplifying the model.

**Alternative (defer)**: Keep `plan` as-is (optional) and add a comment that it may be folded into `findings` in a future version. This avoids a breaking change now but leaves the ambiguity unresolved.

**Chosen recommendation**: Fold it now in Phase 1 — the effort is near-zero (remove one field from the form, update the mapper to not send it) and the UI never depended on it.

---

## Risks

1. **Breaking existing offline payloads**: If any offline client has stored `plan` and we remove it from the contract, sync could break. Mitigation: accept `plan` on read (backward compat) but stop writing it.
2. **Cost field conflicts with ledger**: The `HerdCostLedger` system already has `amount` for other cost contexts. Adding `cost.amount` to visit metadata could create confusion about whether these are the same thing. Mitigation: clearly namespace it under `visit.cost` to distinguish from `ledger.cost`.
3. **`finalize` removed from list but expected by existing tests**: `vet-visits-page.component.spec.ts` line 133 asserts `pendingActions` includes `Finalizar`. Tests will break and need updating.

---

## Ready for Proposal

**Yes** — the following items should be formalized in `sdd-propose`:

1. Remove `finalize` action from list (change visibility guard).
2. Add `CancelVisitDialogComponent` with required reason field.
3. Extend attend flow with `findings` and `costo` fields in dialog.
4. BE: accept `cost` in metadata, add `costo` to `VetVisitItemDto`.
5. BE: validate `cancelReason` when status = `CANCELED`.
6. BE: validate `findings` required when status = `ATTENDED`.
7. Phase 1 plan is self-contained; Phase 2 follow-up wizard is a clear follow-on.
8. `plan` deprecation: fold into `findings` in BE/contract; stop writing from FE.
9. Tests need updating: `finalize` action removal from spec assertions.

**Next**: Run `sdd-propose` with scope = Phase 1 items + plan deprecation decision.
