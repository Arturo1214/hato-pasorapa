# Tasks: `animal-workflow-table-actions-v2`

## Phase 1: Backend Foundation — Enums, DTOs, Service

- [x] 1.1 `AnimalCategory.java` — replace 4 values with 6: `TERNERO`, `TERNERA`, `VAQUILLONA`, `VACA`, `TORO`, `BUEY`
- [x] 1.2 `AnimalEventType.java` — add `CASTRATION`
- [x] 1.3 `AnimalRequest.java` — add `LocalDate birthDate` field
- [x] 1.4 `AnimalService.applyCategorySexValidation()` — switch/if enforcing HEMBRA→{TERNERA,VAQUILLONA,VACA}, MACHO→{TERNERO,TORO,BUEY}, throw 400 on invalid
- [x] 1.5 `AnimalService.validateBirthDateForYoungAnimals()` — require birthDate when category is TERNERO or TERNERA, throw 400
- [x] 1.6 `AnimalService.applyCastration()` — `@Transactional` method: find animal, validate category TERNERO|TORO, persist `AnimalEvent(CASTRATION)`, set `animal.category=BUEY`
- [x] 1.7 `AnimalService.applyAutoTransitionOnRead()` — in `findByUuid()` and `listAnimals()`: if TERNERO with birthDate and age≥24mo, set category=TORO and persist
- [x] 1.8 `AnimalMapper.java` — no aplica: `AnimalRequest` ya entrega enum canónico y el compat/backfill legacy (`COW/BULL/CALF/HEIFER`) vive en `SyncPayloadMapper` + migration `015-animal-category-workflow-v2`
- [x] 1.9 Liquibase migration: ALTER enum `category` to 6 values (ternero/ternera/vaquillona/vaca/toro/buey)
- [x] 1.10 Backfill script: set birthDate=admissionDate-6months for existing animals where category=TERNERO and birthDate=null

## Phase 2: Backend Events & Resources

- [x] 2.1 `AnimalEventResource.java` — handle CASTRATION type in `createEvent()` flow
- [x] 2.2 Update `AnimalService` method signature for event creation to call `applyCastration()` when type=CASTRATION
- [x] 2.3 `AnimalResource.java` — no endpoint changes; transitions handled transparently in service layer

## Phase 3: Frontend — DataModel, Service, Components

- [x] 3.1 `animals.service.ts` — update `AnimalCategory` type to 6 values; add `sex: 'MACHO'|'HEMBRA'` and `birthDate?: string` to `AnimalItem`
- [x] 3.2 `animals.service.ts` — add `createCastrationEvent(animalUuid, payload)` method
- [x] 3.3 `AnimalFormDialogComponent` — create new component (ref: `UserFormDialogComponent`): create/edit mode, `birthDate` field, reactive form with category×sex validation
- [x] 3.4 `animals-page.component.ts` — replace card-grid with `DataTableComponent`; toolbar "Nuevo animal" button → opens `AnimalFormDialogComponent`; add `sex` column; remove global `ownerGanaderoId` and `active` filters; row actions: operative event, reproductive event, images, view-edit
- [x] 3.5 `DataTableColumn` config: arete, marca, tatuaje, sex, category, birthDate, admissionDate, active; sortable + filterType per column

## Phase 4: Testing

- [x] 4.1 `AnimalServiceTest.java` — parametrize: reject invalid category×sex combos (VACA+MACHO→400, TERNERO+HEMBRA→400, etc.)
- [x] 4.2 `AnimalServiceTest.java` — create TERNERO without birthDate → 400 BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL
- [x] 4.3 `AnimalServiceTest.java` — CASTRATION on TERNERO → animal.category=BUEY; CASTRATION on VACA → category unchanged
- [x] 4.4 `AnimalServiceTest.java` — TERNERO age≥24mo → auto-transition TORO on read; age<24mo → stays TERNERO; birthDate=null → no transition
- [x] 4.5 BE integration (`rest-assured`): POST /animals invalid category×sex → 400; POST /animals TERNERO without birthDate → 400; POST /animals-events castration on TERNERO → 201 + BUEY
- [x] 4.6 `animals-page.component.spec.ts` — DataTable renders, toolbar "Nuevo animal" opens dialog, row actions fire correct events, offline castration event enqueued
- [x] 4.7 `AnimalFormDialogComponent` — create/edit with birthDate field, validation error display

## Phase 5: Integration & Polish

- [x] 5.1 Run full BE test suite (`./mvnw test`) — animal suites green; full run detecta 2 fallos fuera de scope (`OfflineConflictResolutionMigrationTest`, `AdminDashboardResourceTest`)
- [x] 5.2 Run FE tests (`npm test`) — suites del feature/DataTable green; full run detecta 3 fallos fuera de scope (`app.auth.integration.spec.ts`, `calendar-alerts.integration.spec.ts`)
- [ ] 5.3 Manual smoke test: create animal VACA+HEMBRA (success), VACA+MACHO (400), TERNERO without birthDate (400), castration TERNERO→BUEY — pendiente manual, no ejecutado en esta sesión
