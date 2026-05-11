# Tasks: Veterinary Visits Redesign V1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1200 (FE ~550 + BE ~350) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 (BE) | Backend DTOs + `GET /api/vet-visits` resource + repository query | PR 1 → feature/vet-visits-redesign | Base = feature/vet-visits-redesign |
| 2 (BE) | Service logic: scoping, fan-out list, lifecycle validation | PR 2 → feature/vet-visits-redesign | Base = PR 1 branch |
| 3 (FE–BE API) | FE `VetVisitsService` + mapper extended + dialog form | PR 3 → feature/vet-visits-redesign | Base = PR 2 branch |
| 4 (FE–UI) | `VetVisitsPageComponent` central list + Spanish labels + calendar adapter + animal timeline | PR 4 → feature/vet-visits-redesign | Base = PR 3 branch |

## Phase 1: Backend Foundation — DTOs + Resource + Repository

- [x] 1.1 Create `hato-be/src/main/java/.../service/dto/vetvisit/VetVisitListResponse.java` with `items`, `page`, `size`, `total`
- [x] 1.2 Create `hato-be/src/main/java/.../service/dto/vetvisit/VetVisitItemDto.java` with `visitId`, `mode`, `status`, `veterinarian`, `occurredAt`, `nextControlAt`, `animalUuid` (null for global), `targetAnimalCount`, `atencionNotas`
- [x] 1.3 Create `hato-be/src/main/java/.../service/dto/vetvisit/VetVisitFilterDto.java` with `@BeanParam` fields: `mode`, `status`, `animalUuid`, `visitId`, `occurredFrom`, `occurredTo`, `page`, `size`
- [x] 1.4 Create `hato-be/src/main/java/.../web/rest/VetVisitResource.java` with `GET /api/vet-visits` returning `VetVisitListResponse`; apply `@RolesAllowed({"ADMIN", "GANADERO"})`; use service layer
- [x] 1.5 Add repository query `findFieldVetVisitsByOwner(ownerId, filter)` in `AnimalHealthEventRepository.java`: filter by `healthEventType=FIELD_VET_VISIT`, `ownerId`, date range, mode from metadata, status from metadata; support `limit`/`offset`
- [x] 1.6 Add BE unit tests for `VetVisitResource` filters and pagination (RestAssured)

## Phase 2: Backend Service — Scoping + Fan-out Grouping + Lifecycle

- [x] 2.1 RED: Write failing test in `AnimalHealthEventServiceTest.java` for `getGlobalVisitsByOwner(ownerId, filter)` returning grouped items with `targetAnimalCount`
- [x] 2.2 GREEN: Implement `getGlobalVisitsByOwner` in `AnimalHealthEventService.java`: query repo with scoping by ganadero owner, project metadata fields (`visit.mode`, `visit.status`, `visit.veterinarian.name`), group by `visitId` for globals
- [x] 2.3 Add `visit.mode` / `visit.status` / `visit.veterinarian` / `visit.targetAnimalCount` to `AnimalHealthEventMapper.java` validation; reject if `modo` absent on `FIELD_VET_VISIT`
- [x] 2.4 RED: Write failing test for `AnimalHealthEventMapper` rejecting `FIELD_VET_VISIT` without `visit.modo`
- [x] 2.5 GREEN: Implement metadata block validation in `AnimalHealthEventMapper`; add `visit` block parsing with `JsonNode`
- [x] 2.6 Add BE unit test for lifecycle continuity: `PROGRAMADA→ATENDIDA`, `ATENDIDA→REPROGRAMADA→ATENDIDA`, `ATENDIDA→FINALIZADA`

## Phase 3: Frontend — Service + Form Dialog + Mapper Extension

- [x] 3.1 Create `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts`: `VetVisitItem` interface, `listVetVisits(filter)` calling `GET /api/vet-visits`, returns `Observable<VetVisitItem[]>`
- [x] 3.2 RED: Write `vet-visits.service.spec.ts` — test `listVetVisits` with filters and pagination normalization
- [x] 3.3 GREEN: Implement `listVetVisits` in `vet-visits.service.ts`
- [x] 3.4 Extend `vet-visit-form.mapper.ts`: add `visit.mode`, `visit.status`, `visit.veterinarian`, `visit.targetAnimalCount`, `visit.parentVisitId` to metadata block in `mapVetVisitFormToCreateInput`
- [x] 3.5 RED: Write `vet-visit-form.mapper.spec.ts` — test extended metadata fields, null handling for `targetAnimalCount`
- [x] 3.6 GREEN: Implement extended mapper fields
- [x] 3.7 Create `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts`: Reactive Form with mode toggle (GLOBAL/ESPECIFICA), veterinarian fields, status selector (`PROGRAMADA|ATENDIDA|REPROGRAMADA|FINALIZADA|CANCELADA`), autocomplete animal (latest 10 + search by arete/marca/tatuaje), notes field
- [x] 3.8 RED: Write `vet-visit-form-dialog.component.spec.ts` — test mode toggle, validation, autocomplete trigger
- [x] 3.9 GREEN: Implement dialog component with form group and manual reactive form

## Phase 4: Frontend — Page Redesign + Calendar + Animal Timeline

- [ ] 4.1 RED: Write failing test in `vet-visits-page.component.spec.ts` — test table loads, columns show Spanish labels, filters work
- [ ] 4.2 GREEN: Redesign `vet-visits-page.component.ts`: replace animalUuid filter with global list (no `animalUuid` required), add Spanish column headers (`Visita`, `Modo`, `Veterinario`, `Estado`, `Fecha`, `Siguiente Control`), toolbar with "Nueva Visita" button, `app-data-table` with filter inputs for `modo`/`estado`/`veterinario`
- [ ] 4.3 Add lifecycle action buttons to table rows: "Atender", "Reprogramar", "Finalizar", "Cancelar" per `visit.status`
- [ ] 4.4 Update `animals-health-events.service.ts`: extend `AnimalHealthEventItem` interface with `visitMode?: 'GLOBAL'|'ESPECIFICA'`, `visitStatus?: string`, `veterinarianName?: string`
- [ ] 4.5 RED: Write `animal-health-events-timeline.adapter.spec.ts` — test CAMPAIGN entry projection from global visit metadata, SPECIFIC entry from specific visit
- [ ] 4.6 GREEN: Update `animal-health-events-timeline.adapter.ts` to read `visit.mode` → `'CAMPAIGN'` | `'SPECIFIC'` and expose `veterinarianName` from `visit.veterinarian.name`
- [ ] 4.7 RED: Write `calendar-alerts-projection.spec.ts` — test global/specific classification, Spanish label "Control Veterinario - Campanha" for GLOBAL
- [ ] 4.8 GREEN: Update `calendar-alerts-projection.ts`: read `visit.mode` from metadata, apply distinct label for GLOBAL, pass mode flag to agenda item
- [ ] 4.9 Update `animals.service.ts`: add `listActiveAnimals(ownerId, page, size)` for autocomplete with latest 10 by default, search by `arete`/`marca`/`tatuaje`

## Phase 5: Integration + Fan-out (Global Campaign)

- [ ] 5.1 RED: Write integration test for global campaign fan-out: when user creates GLOBAL visit, verify `outbox` creates one event per active animal of the ganadero, all sharing `visitId`
- [ ] 5.2 GREEN: Implement fan-out logic in `AnimalsHealthEventsService.createEvent` (or new `createGlobalVetVisit` method): if `visit.mode=GLOBAL`, query active animals for current user, enqueue one event per animal with same `visitId` and `visit.mode=GLOBAL`
- [ ] 5.3 Update `calendar-alerts.store.ts`: exclude agenda items from GLOBAL visits whose chain is `CLOSED` (all events `FINALIZADA` or `CANCELADA`) per spec `calendar-local-reminders-v1`
- [ ] 5.4 Update `calendar-alerts-projection.ts`: classify due/due_today/overdue using `visit.status` (only `PROGRAMADA` and `REPROGRAMADA` count as active) and `nextControlAt`
- [ ] 5.5 Add Spanish label badges to `calendar-alerts-projection.ts`: "Controles Veterinarios Pendientes" (overdue), "Controles Hoy" (due_today)
