# Tasks: animal-breed-catalog-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800–2200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 4-PR feature-branch-chain |
| Delivery strategy | feature-branch-chain / work-unit slice |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: Raza catalog foundation (entity, repo, service, DTOs, resource, migration) | PR 1 | Base = `main`. Standalone catalog CRUD, no Animal dependencies. |
| 2 | Backend: Animal contract + sync (entity fields, mappers, service validation, sync preservation) | PR 2 | Base = PR 1 branch. Animal knows about Raza FK. |
| 3 | FE: Admin Raza ABM page (DataTable, dialog, service, routing, sidebar entry) | PR 3 | Base = PR 2 branch. Admin UI for catalog management. |
| 4 | FE: Animal form with breed selector + offline types schema | PR 4 | Base = PR 3 branch. Ganadero sees breed in form, offline survives. |

> ⚠️ User must choose chain strategy before `sdd-apply`. Options: `stacked-to-main` (fast, fix-on-main) or `feature-branch-chain` (rollback-safe, tracker branch accumulates final state). Both keep each PR under 400 lines.

---

## Phase 1: Backend — Raza Catalog Foundation (PR 1)

- [x] 1.1 Create `hato-be/src/main/java/bo/pasorapa/hato/domain/Raza.java` — entity with `uuid`, `nombre`, `descripcion`, `activo`, `sortOrder`, `createdAt`, `updatedAt`, `@Version`
- [x] 1.2 Create `hato-be/src/main/java/bo/pasorapa/hato/repository/RazaRepository.java` — Panache repo with `findByUuid`, `findByNombreIgnoreCase`, `findAllActiveOrdered`
- [x] 1.3 Create DTOs under `hato-be/src/main/java/bo/pasorapa/hato/service/dto/raza/` — `CreateRazaRequest`, `UpdateRazaRequest`, `RazaResponse`, `RazaOptionResponse`
- [x] 1.4 Create `hato-be/src/main/java/bo/pasorapa/hato/service/RazaService.java` — ABM logic, normalized uniqueness check, soft-delete block when in use
- [x] 1.5 Create `hato-be/src/main/java/bo/pasorapa/hato/web/rest/RazaResource.java` — `GET /api/razas/active` (ADMIN/GANADERO), `GET/POST/PUT /api/admin/razas` (ADMIN), `PATCH /api/admin/razas/{uuid}/active` (ADMIN)
- [x] 1.6 Create `hato-be/src/main/resources/db/changelog/018-animal-breed-catalog-v1.yaml` — table `razas` with indexes, seed `Criolla` as `sort_order=1`
- [x] 1.7 Register `018-animal-breed-catalog-v1.yaml` in `master.yaml`
- [x] 1.8 Write `hato-be/src/test/java/bo/pasorapa/hato/service/RazaServiceTest.java` — CRUD, uniqueness, soft-delete block
- [x] 1.9 Write `hato-be/src/test/java/bo/pasorapa/hato/web/rest/RazaResourceTest.java` — REST endpoints for admin and active list

## Phase 2: Backend — Animal Contract + Sync (PR 2)

- [x] 2.1 Add `color` and `description` `String` columns to `Animal.java` entity
- [x] 2.2 Add `@ManyToOne Raza breed` nullable FK + `breedUuid` column to `Animal.java`
- [x] 2.3 Add `breedUuid` and `breedName` (denormalized, nullable String) to `AnimalRequest.java` and `AnimalResponse.java`
- [x] 2.4 Update `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalMapper.java` — map `breedUuid`, `breedName`; call `RazaService` for active breed validation
- [x] 2.5 Update `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalService.java` — validate `breedUuid` is active on create/update; preserve denormalized `breedName` in response
- [x] 2.6 Update `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — preserve `color`, `description`, `breedUuid`, `breedName` in push/pull payloads
- [x] 2.7 Write `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalMapperTest.java` — breed fields mapping
- [x] 2.8 Write `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` — breed validation (inactive → reject, missing → accept null)

## Phase 3: Frontend — Admin Raza ABM Page (PR 3)

- [x] 3.1 Create `hato-fe/src/app/features/admin/razas/data-access/razas.service.ts` — calls `/api/admin/razas` and `/api/razas/active`
- [x] 3.2 Create `hato-fe/src/app/features/admin/razas/data-access/razas.service.spec.ts`
- [x] 3.3 Create `hato-fe/src/app/features/admin/razas/models/raza.model.ts` — `RazaItem` interface matching BE `RazaResponse`
- [x] 3.4 Create `hato-fe/src/app/features/admin/razas/razas-page.component.ts` — standalone, uses `app-data-table`, loads list, emits create/edit events
- [x] 3.5 Create `hato-fe/src/app/features/admin/razas/razas-page.component.spec.ts`
- [x] 3.6 Create `hato-fe/src/app/features/admin/razas/raza-form-dialog.component.ts` — `MatDialog` typed form, `FormGroup` with `nombre`, `descripcion`, `activo`
- [x] 3.7 Create `hato-fe/src/app/features/admin/razas/raza-form-dialog.component.spec.ts`
- [x] 3.8 Add route `{ path: 'admin/razas', component: RazasPageComponent }` to `app.routes.ts`
- [x] 3.9 Add sidebar menu entry for ADMIN in `sidebar.ts` — label "Razas", icon, route `/admin/razas`
- [x] 3.10 Run migration for offline types if needed — update `offline-store.migrations.ts` if schema bump required (not needed: admin raza ABM is online-only and stores no offline schema)

## Phase 4: Frontend — Animal Form Breed Selector + Offline (PR 4)

- [ ] 4.1 Update `hato-fe/src/app/features/admin/animals/animal-form.component.ts` — add `color` `FormControl<string>`, `description` `FormControl<string>`, `breedUuid` `FormControl<string|null>`
- [ ] 4.2 Add breed selector `<mat-select>` in animal form template — fetches `GET /api/razas/active`, displays `name`
- [ ] 4.3 Update `hato-fe/src/app/core/offline/offline-types.ts` — `AnimalMutationPayload` and `AnimalOfflineMutationPayload` add optional `color`, `description`, `breedUuid`, `breedName`
- [ ] 4.4 Update `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts` — send `color`, `description`, `breedUuid` on create/update
- [ ] 4.5 Write `hato-fe/src/app/features/admin/animals/animal-form.component.spec.ts` — breed selector renders active breeds, form includes color/description
- [ ] 4.6 Write `hato-fe/src/app/core/offline/offline-types.spec.ts` — verify payload preserves breed fields

## Phase 5: Integration Verification

- [ ] 5.1 Run `hato-be` tests — `mvnw test -pl hato-be` passes
- [ ] 5.2 Run `hato-fe` tests — `npm test` passes (vitest)
- [ ] 5.3 Smoke-test: ADMIN creates Brangus breed, deactivates it, GANADERO creates animal with Criolla breed — breed selector shows only active breeds
