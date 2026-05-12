# Tasks: vet-visit-clinical-workflow-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | BE DTO + Service chain projection + repo filter | PR 1: `vet-visit-be-chain` | Target `main`; BE unit tests + REST-assured included |
| 2 | FE types + form dialog clinical controls + mapper + service | PR 2: `vet-visit-fe-form` | Target PR 1 branch; Vitest specs for dialog/form/mapper |
| 3 | FE page `Ver` action + detail dialog + cancel terminal guard | PR 3: `vet-visit-fe-detail` | Target PR 2 branch; Vitest specs for page + dialog |

---

## Phase 1: BE Foundation — DTO, Service, Repository

- [x] 1.1 Add `parentVisitId: String` and `cancelReason: String` fields to `VetVisitItemDto.java`
- [x] 1.2 Add `chainStatus: String` field to `VetVisitItemDto.java` (derived from `protocol.status` + `parentVisitId`)
- [x] 1.3 Write failing `VetVisitResourceTest` scenarios: list response includes `parentVisitId` and `cancelReason`
- [x] 1.4 Write failing service test: projection returns latest event per `visitId` with correct `parentVisitId`/`cancelReason`
- [x] 1.5 Update `AnimalHealthEventService` projection to expose `parentVisitId` from `visit.metadata.parentVisitId`
- [x] 1.6 Add `findByParentVisitId(String parentVisitId)` to `AnimalHealthEventRepository`
- [x] 1.7 Add service method `getVisitChainDetail(String visitId)` returning parent + children ordered by `occurredAt`
- [x] 1.8 Make `VetVisitResource` expose chain detail via `GET /api/vet-visits/{visitId}/chain` (or query param)
- [x] 1.9 Verify all BE tests pass with Java 21 + `./mvnw test -Dquarkus.profile=test`

---

## Phase 2: FE Types, Form Dialog, Mapper, Service

- [x] 2.1 Add `VetVisitCreationMode = 'scheduled' | 'attendedNow'` to `vet-visit-form-dialog.component.ts` exports
- [x] 2.2 Replace status selector in form dialog with `creationMode: 'scheduled' | 'attendedNow'` toggle — scheduled shows only `Fecha de visita` + veterinarian + reason + next control; attendedNow shows clinical form
- [x] 2.3 Make `findings` required when `creationMode === 'attendedNow'`; add `attendedNowValidator` that enforces findings + attentionNotes
- [x] 2.4 Default `occurredAt` to `new Date().toISOString()` (injectable `DateTimeClock`) for `attendedNow` mode
- [x] 2.5 Hide `nextDueAt` datepicker for `creationMode === 'attendedNow'` unless `followUpChoice === 'schedule'`
- [x] 2.6 Update `VetVisitDialogData` to include `creationMode?: VetVisitCreationMode`
- [x] 2.7 Update `VetVisitDialogResult` to include `creationMode: VetVisitCreationMode` and `findings: string | null`
- [x] 2.8 Update `VetVisitItem` in service to add `cancelReason: string | null` and `chainStatus: 'OPEN' | 'CLOSED' | null`
- [x] 2.9 Update `vet-visits.service.ts` mapper to parse `cancelReason` and `chainStatus` from API response
- [x] 2.10 Update `vet-visit-form.mapper.ts`: add `VetVisitFormValue.creationMode`, map it to payload; `scheduled` creation omits clinical fields entirely
- [x] 2.11 Write Vitest spec: `vet-visit-form-dialog.component.spec.ts` — mode-specific visibility, attended-now clock, `followUpChoice` mandatory
- [x] 2.12 Write Vitest spec: `vet-visits.service.spec.ts` — `cancelReason` and `chainStatus` mapping
- [x] 2.13 Write Vitest spec: `vet-visit-form.mapper.spec.ts` — scheduled/attendedNow payloads
- [x] 2.14 Run FE tests with Node 20.19.6: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits --watch=false` (no build)

---

## Phase 3: FE Page — Ver Action, Detail Dialog, Cancel Terminal Guard

- [x] 3.1 Create `vet-visit-detail-dialog.component.ts`: read-only display of estado, fecha, veterinario, hallazgos, notas, plan, costo, motivo cancelación, linked children. Inject `DateTimeClock` for formatting.
- [x] 3.2 Create `vet-visit-detail-dialog.component.spec.ts`: renders chain with parent + canceled child; shows cancel reason
- [x] 3.3 Add `Ver` action to `visitActions` in `vet-visits-page.component.ts` — always visible, no terminal guard
- [x] 3.4 Implement `openDetailVisitDialog(row)` — calls `GET /api/vet-visits/{visitId}/chain` or uses existing list data, opens detail dialog
- [x] 3.5 Update `canCancel()` guard: terminal = `CANCELED` OR (`ATTENDED` with `chainStatus === 'CLOSED'`) — add `chainStatus` check
- [x] 3.6 Update `canAttend()` guard: only `PROGRAMADA` (not `RESCHEDULED`); add `chainStatus === 'OPEN'` check
- [x] 3.7 Remove `RESCHEDULED` from `VISIT_STATUS_LABELS` and status options — `PROGRAMADA` replaces it
- [x] 3.8 Remove `reschedule` action from `visitActions`; create child follow-up only from attend flow `followUpChoice === 'schedule'`
- [x] 3.9 Update `cancelVisit()`: `protocolStatus` always `CLOSED` on cancel; child chain remains `OPEN` for parent
- [x] 3.10 Write Vitest spec: `vet-visits-page.component.spec.ts` — `Ver` always visible, terminal cancel blocked, `ATTENDED + CLOSED` attend blocked, `RESCHEDULED` absent
- [x] 3.11 Run FE tests with Node 20.19.6: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits --watch=false` (no build)

---

## Phase 4: Integration + Finalization

- [ ] 4.1 Verify full BE test suite passes: `./mvnw test -Dquarkus.profile=test` (Java 21)
- [ ] 4.2 Verify full FE test suite passes: `npm test --prefix hato-fe -- --run`
- [ ] 4.3 Manual smoke: create scheduled visit (no clinical fields visible), create attended-now visit (clinical fields + follow-up choice required), attend pending visit (clinical + choice), cancel child (parent stays `ATENDIDA`), `Ver` on terminal row (read-only chain)
- [ ] 4.4 Confirm no direct row `Finalizar` action exists anywhere in the feature
- [ ] 4.5 Confirm "Finalizada" label in UI only appears as chain status (`CLOSED`), never as a row status dropdown option
- [x] 4.6 Bugfix regression: GLOBAL list projection chooses attended/closed lifecycle rows over stale scheduled fan-out rows for the same `visitId`
- [x] 4.7 Bugfix regression: FE attend flow reloads canonical backend rows after scheduling a follow-up and limits row actions to `Ver` for attended parents with active follow-up
- [x] 4.8 Bugfix regression: shared DataTable replaces its Material data source and resets pagination when canonical backend rows change after attend reload
- [x] 4.9 Bugfix regression: FE attended-now create path creates the pending child follow-up, reloads canonical backend rows before table update, and uses parent/child fallback only when the backend list is stale
- [x] 4.10 Bugfix regression: attending/finalizing an existing pending follow-up reuses the selected child `visitId` and never trusts a dialog-generated sibling `visitId`
- [x] 4.11 Backend guard: reject attended/canceled follow-up lifecycle events that create a new sibling `visitId` while a pending child exists for the same parent
- [ ] 4.12 Scalability follow-up: replace JSON/CLOB in-memory vet visit grouping with a queryable read model or persisted visit lifecycle fields so `/api/vet-visits` can paginate after grouping without scanning all matching events
