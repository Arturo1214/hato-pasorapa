# Tasks: vet-visit-lifecycle-actions-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900 (BE ~200, FE ~500, Tests ~200) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (BE foundation) → PR 2 (FE contracts/mapper) → PR 3 (FE dialogs) → PR 4 (FE page/integration) → PR 5 (tests) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | BE validation, projection, DTOs | PR 1 | Independent; all other work depends on API contract |
| 2 | FE offline-types, service DTOs, mapper contracts | PR 2 | Builds on PR 1 API; provides types for dialogs |
| 3 | FE cancel dialog + form dialog structural changes | PR 3 | Core UX; builds on PR 2 types |
| 4 | FE page component wiring + follow-up chain logic | PR 4 | Builds on PR 3 dialogs; needs full types |
| 5 | Unit tests BE + FE | PR 5 | Cross-cuts all layers; final verification |

---

## Phase 1: Backend Foundation — Validation, Projection, DTOs

### 1.1 Backend — Mapper: cost acceptance for FIELD_VET_VISIT

- [x] 1.1.1 **TDD RED**: Add `VetVisitResourceTest` case — `FIELD_VET_VISIT` with `metadata.cost: { amount: 150; currency: "BOB" }` must be accepted; VACCINATION with cost must throw `ANIMAL_HEALTH_EVENT_ATTACHMENTS_NOT_SUPPORTED`
- [x] 1.1.2 **TDD RED**: Add `VetVisitResourceTest` case — `FIELD_VET_VISIT` with `estado=CANCELADA` and missing/blank `cancelReason` must throw `ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED`
- [x] 1.1.3 **TDD RED**: Add `VetVisitResourceTest` case — `FIELD_VET_VISIT` with `estado=ATENDIDA` and missing `clinicalNote.findings` must throw
- [x] 1.1.4 **GREEN**: Modify `rejectOutOfScopeAttachments()` in `AnimalHealthEventMapper.java` — remove `cost` from the rejected-keys set; add a FIELD_VET_VISIT-specific exemption block that only allows cost under `metadata.cost` (not `costo`, `price`, `billing`)
- [x] 1.1.5 **GREEN**: In `validateFieldVetVisit()`, after reading visit status, add: if `CANCELADA`/`CANCELED` state, require `visit.cancelReason` length 5..500
- [x] 1.1.6 **GREEN**: In `validateFieldVetVisit()`, after reading visit status, add: if `ATENDIDA`/`ATTENDED` state, require `clinicalNote.findings` non-empty
- [x] 1.1.7 **GREEN**: In `validateFieldVetVisit()`, add `treatmentPlan` validation — if present, must be `List<Map>` with `description` (1..300 chars) and `order` (int); max 20 steps; accept legacy `String` plan and normalize to single-item list
- [x] 1.1.8 **REFACTOR**: Ensure private helper methods `requireText`, `requireOffsetDateTime` etc. are used consistently

### 1.2 Backend — DTO: extend VetVisitItemDto

- [x] 1.2.1 Add `BigDecimal costo` field to `VetVisitItemDto.java` (nullable)
- [x] 1.2.2 Add `String costCurrency` field to `VetVisitItemDto.java` (nullable, default "BOB")
- [x] 1.2.3 Add `List<String> treatmentPlan` field to `VetVisitItemDto.java` (nullable, ordered steps as strings)

### 1.3 Backend — Service: project cost/plan in list

- [x] 1.3.1 **TDD RED**: Add test — `toVetVisitItem()` must project `costo` from `metadata.cost.amount` and `costCurrency` from `metadata.cost.currency`; legacy records without cost project null
- [x] 1.3.2 **TDD RED**: Add test — `toVetVisitItem()` must project `treatmentPlan` from `metadata.clinicalNote.plan` array (strings); legacy string plan projected as single-item list
- [x] 1.3.3 **GREEN**: In `toVetVisitItem()` in `AnimalHealthEventService.java`, extract and project `costo` and `costCurrency` from `metadata.cost`
- [x] 1.3.4 **GREEN**: In `toVetVisitItem()`, extract and project `treatmentPlan` from `metadata.clinicalNote.plan`; handle both `List<String>` and legacy `String` cases

### 1.4 Backend — Mapper: add cost/treatmentPlan helpers

- [x] 1.4.1 Add public method `readCost(Map<String, Object> metadata)` returning `Map<String, Object>` or null
- [x] 1.4.2 Add public method `readTreatmentPlan(Map<String, Object> metadata)` returning `List<String>` (normalize legacy string to single-item list)
- [x] 1.4.3 Add public method `readCancelReason(Map<String, Object> metadata)` returning `String` or null

---

## Phase 2: Frontend Contracts — Types, Service, Mapper

### 2.1 Frontend — offline-types: extend typed metadata

- [x] 2.1.1 Add `cost?: { amount: number; currency: 'BOB' }` to `FieldVetVisitMetadata`
- [x] 2.1.2 Add `treatmentPlan?: string[]` to `FieldVetVisitMetadata`
- [x] 2.1.3 Update `FieldVetClinicalNote` to add `plan?: string | string[]` (accepts both legacy string and new array)
- [x] 2.1.4 Add `cancelReason?: string` to `FieldVetVisitBlock`

### 2.2 Frontend — VetVisitsService: add new DTO fields

- [x] 2.2.1 Update `VetVisitListItem` interface to include `costo: number | null`, `costCurrency: string | null`, `treatmentPlan: string[] | null`
- [x] 2.2.2 Update `createVetVisitEvent()` / `updateVetVisitEvent()` to accept `cost`, `treatmentPlan`, `cancelReason` in metadata payload
- [x] 2.2.3 Ensure API response mapping parses `costo`, `costCurrency`, `treatmentPlan` from backend DTO

### 2.3 Frontend — VetVisitFormMapper: map clinical note fields

- [x] 2.3.1 **TDD RED**: Add unit test — `toRequestPayload()` with `action='cancel'` must produce `metadata.visit.cancelReason`; missing reason must cause validation error
- [x] 2.3.2 **TDD RED**: Add unit test — `toRequestPayload()` with `action='attend'` must produce `metadata.clinicalNote.findings`, `metadata.atencionNotas`, `metadata.cost`, `metadata.treatmentPlan` as string array
- [x] 2.3.3 **GREEN**: In `toRequestPayload()`, handle `action: 'cancel'` — set `visit.status = 'CANCELED'` and `visit.cancelReason` from form
- [x] 2.3.4 **GREEN**: In `toRequestPayload()`, handle `action: 'attend'` — set `visit.status = 'ATTENDED'`, `clinicalNote.findings`, `atencionNotas`, `cost`, `treatmentPlan`; derive `protocol.status` based on follow-up choice
- [x] 2.3.5 **GREEN**: In `toRequestPayload()`, handle legacy `plan: string` (normalize to `plan: [string]`)
- [x] 2.3.6 Add helper `normalizePlan(plan: string | string[] | undefined): string[]` for backward compat

---

## Phase 3: Frontend Dialogs — Cancel + Attend Forms

### 3.1 Frontend — VetVisitCancelDialogComponent

- [x] 3.1.1 Create `vet-visit-cancel-dialog.component.ts` in `features/admin/vet-visits/`
- [x] 3.1.2 Dialog template: `MatDialogTitle` "Cancelar visita", `TextareaFormField` "Motivo de cancelación" (`MatFormField` with `MatInput`), `MatDialogActions` with Cancel and Confirm buttons
- [x] 3.1.3 Validation: `confirmValidators` require `cancelReason.length >= 5`; confirm button disabled until valid (using `mat-dialog-confirm` pattern)
- [x] 3.1.4 Return `Observable<{ cancelReason: string }>` on confirm, `null` on cancel/close
- [x] 3.1.5 Add Spanish i18n labels and error messages for min-length validation

### 3.2 Frontend — VetVisitFormDialogComponent: extend for attend

- [x] 3.2.1 Add `action: 'create' | 'attend' | 'reschedule' | 'followUp'` input to dialog
- [x] 3.2.2 **TDD RED**: Add spec — `action='attend'` mode shows `findings` (required), `notas` (optional), `costo` (optional, number input), `Plan de tratamiento` section with dynamic step list
- [x] 3.2.3 **GREEN**: When `action='attend'`, show `findings: MatFormField` (required, min 5 chars), `notas: MatFormField` (optional textarea), `costo: MatFormField` (number input with BOB suffix), and `Plan de tratamiento` section
- [x] 3.2.4 **GREEN**: Implement dynamic treatmentPlan step list: "Agregar paso" button adds `{ description: '' }` row; each row has text input + delete icon; drag handle for reorder (CDK DragDrop)
- [x] 3.2.5 **GREEN**: Add follow-up/finalize choice at bottom of attend form: radio group with "Programar próximo control" (shows nextDueAt date picker) and "Finalizar tratamiento" (no date)
- [x] 3.2.6 Validation: findings required, cost >= 0 if provided, treatmentPlan max 20 steps, each step description 1..300 chars
- [x] 3.2.7 When user selects "Programar próximo control", set `visit.nextControlAt` and `protocol.status = 'FOLLOW_UP_REQUIRED'`; when "Finalizar", set `protocol.status = 'CLOSED'`

### 3.3 Frontend — VetVisitFormDialogComponent: handle cancel action

- [ ] 3.3.1 When `action='cancel'`, dialog shows only cancel reason field (reuse or simplify — consider composing VetVisitCancelDialog instead of duplicating)
- [ ] 3.3.2 Alternative: call `VetVisitCancelDialogComponent` from within form dialog as sub-flow
- [x] 3.3.3 Decision: prefer composition — import and open `VetVisitCancelDialogComponent` from within `VetVisitsPageComponent` before opening form dialog for cancel; form dialog handles create/attend/reschedule only

---

## Phase 4: Frontend Page — Actions Wiring + Follow-up Chain

### 4.1 Frontend — VetVisitsPageComponent: remove Finalizar, add cancel/attend

- [ ] 4.1.1 **TDD RED**: Add spec — row actions for PROGRAMADA state show "Cancelar" and "Atender" (no "Finalizar")
- [ ] 4.1.2 **GREEN**: In `handleRowAction()`, remove `finalize` case; add `cancel` → opens `VetVisitCancelDialogComponent`, then maps result to `createVetVisitEvent` with cancel metadata
- [ ] 4.1.3 **GREEN**: In `handleRowAction()`, add `attend` → opens `VetVisitFormDialogComponent(action='attend')`, then maps result to `createVetVisitEvent` with clinical metadata + follow-up/finalize choice
- [ ] 4.1.4 After successful attend with follow-up choice = "Programar próximo control": create second event (the linked follow-up visit) with `parentVisitId` = current visit's visitId, `status = 'PENDING'`, `nextControlAt` from form
- [ ] 4.1.5 After successful attend with follow-up choice = "Finalizar": set `visit.status = 'FINALIZED'`, `protocol.status = 'CLOSED'`
- [ ] 4.1.6 For ATENDIDA state rows, show "Reprogramar" (creates linked follow-up) and "Finalizar" (direct finalize via status update, not a modal)
- [ ] 4.1.7 Ensure status transitions respect lifecycle: PROGRAMADA → ATENDIDA/CANCELADA; ATENDIDA → REPROGRAMADA/FINALIZADA/CANCELADA; REPROGRAMADA → ATENDIDA/FINALIZADA/CANCELADA

### 4.2 Frontend — VetVisitsPageComponent: follow-up chain integration

- [ ] 4.2.1 When fetching visit list, ensure `parentVisitId` is displayed as linked chain indicator (icon or badge)
- [ ] 4.2.2 Ensure timeline/history view shows linked visit notes over time by following `parentVisitId` chains

---

## Phase 5: Testing — Unit + Integration Coverage

### 5.1 Backend tests

- [ ] 5.1.1 Extend `VetVisitResourceTest` to cover cancel-without-reason, attend-without-findings, cost-only-for-vet-visit, treatment-plan-validation scenarios from specs
- [ ] 5.1.2 Add `AnimalHealthEventMapperTest` cases for `readCost()`, `readTreatmentPlan()`, `readCancelReason()` and legacy string plan normalization
- [ ] 5.1.3 Add `AnimalHealthEventServiceTest` cases for `toVetVisitItem()` cost/plan projection

### 5.2 Frontend tests

- [x] 5.2.1 `vet-visit-cancel-dialog.component.spec.ts` — renders, validates min-length, returns cancelReason on confirm, null on cancel
- [x] 5.2.2 `vet-visit-form-dialog.component.spec.ts` — action=attend shows all clinical fields, validates findings required, cost >= 0, treatmentPlan max 20 steps, follow-up vs finalize radio works
- [ ] 5.2.3 `vet-visits-page.component.spec.ts` — row actions show correct buttons by state, cancel flow opens dialog and sends correct payload, attend flow opens dialog and creates follow-up event when selected
- [ ] 5.2.4 `vet-visit-form.mapper.spec.ts` — cancel action mapping, attend action mapping, legacy plan normalization

---

## Implementation Order

1. **PR 1 (BE)**: Sections 1.1 → 1.4 — mapper validation, DTO extension, service projection. Establishes the API contract.
2. **PR 2 (FE contracts)**: Sections 2.1 → 2.3 — offline-types, service DTOs, mapper. Builds on the API contract.
3. **PR 3 (FE dialogs)**: Sections 3.1 → 3.3 — cancel dialog + attend form extension. Uses types from PR 2.
4. **PR 4 (FE page wiring)**: Sections 4.1 → 4.2 — page component actions + follow-up chain. Uses dialogs from PR 3.
5. **PR 5 (Tests)**: Sections 5.1 → 5.2 — BE and FE unit/integration tests. Final verification across all layers.

Each PR must be self-contained with tests included. Later PRs retarget to the previous PR branch (feature-branch-chain).
