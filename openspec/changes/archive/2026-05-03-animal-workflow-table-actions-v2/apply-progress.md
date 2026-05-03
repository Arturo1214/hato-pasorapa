# Apply Progress: `animal-workflow-table-actions-v2`

**Change**: `animal-workflow-table-actions-v2`
**Mode**: Strict TDD
**Status**: 27/28 tasks complete — cierre documental/técnico completado; sólo queda el smoke manual.

## Completed Tasks

- [x] 1.1 `AnimalCategory.java` — 6 categorías nuevas
- [x] 1.2 `AnimalEventType.java` — `CASTRATION`
- [x] 1.3 `AnimalRequest.java` — `birthDate`
- [x] 1.4 Validación `category×sex`
- [x] 1.5 `birthDate` requerido para `TERNERO/TERNERA`
- [x] 1.6 Transición de castración en service/event flow
- [x] 1.7 Auto-transición `TERNERO→TORO` on-read
- [x] 1.8 `AnimalMapper.java` no-aplica: mapping legacy ya resuelto en sync/migración; mapper REST trabaja con enum canónico
- [x] 1.9 Migración/backfill de categorías y `birth_date`
- [x] 1.10 Backfill `birth_date=admission_date-6m` para `TERNERO`
- [x] 2.1 Recurso REST de eventos con `CASTRATION`
- [x] 2.2 Delegación service-layer a `applyCastration()`
- [x] 2.3 Lecturas transparentes con auto-transiciones
- [x] 3.1 FE `AnimalCategory`/`AnimalItem` 6 valores canónicos end-to-end
- [x] 3.2 FE `createCastrationEvent()` + proyección offline a `BUEY`
- [x] 3.3 `AnimalFormDialogComponent`
- [x] 3.4 `animals-page.component.ts` → `DataTableComponent` + dialogs/actions
- [x] 3.5 Config completa de columnas/filtros
- [x] 4.1 Tests inválidos `category×sex`
- [x] 4.2 Test `BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL`
- [x] 4.3 Tests `CASTRATION` macho→`BUEY` / hembra unchanged
- [x] 4.4 Tests `TERNERO→TORO` on-read
- [x] 4.5 Integración REST para validaciones + castración
- [x] 4.6 `animals-page.component.spec.ts`
- [x] 4.7 `AnimalFormDialogComponent` specs
- [x] 5.1 Full BE suite ejecutada; animal suites verdes, blockers ajenos documentados
- [x] 5.2 Full FE suite ejecutada; feature pack verde, fallos ajenos documentados

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts` | Modified | Canonizó categorías FE, agregó `sex`/`birthDate`, normalizó snapshots legacy y exportó opciones compartidas |
| `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | Modified | Cubrió query canónica, snapshots legacy canonizados y persistencia offline de `sex`/`birthDate` |
| `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.ts` | Modified | Ajustó proyección offline de `CASTRATION` al modelo canónico |
| `hato-fe/src/app/features/admin/animals/animal-form-dialog.component.ts` | Created | Modal create/edit con birthDate, validación `category×sex` y regla young-animal |
| `hato-fe/src/app/features/admin/animals/animal-form-dialog.component.spec.ts` | Created | Cobertura create/edit, `birthDate` y errores de validación |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Replaced | Card-grid → DataTable, toolbar, dialogs de ficha/eventos/imágenes y acciones por fila |
| `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Replaced | Validó render tabular, dialogs, castración offline e imágenes accesibles desde acción |
| `hato-fe/src/app/shared/ui/data-table/data-table.component.ts` | Modified | Sumó `DATE` como filtro de columna |
| `hato-fe/src/app/shared/ui/data-table/data-table.component.spec.ts` | Modified | Cubrió emisión de filtros de fecha |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Alineó payload offline al catálogo canónico de 6 categorías |
| `openspec/changes/animal-workflow-table-actions-v2/tasks.md` | Modified | Marcó tareas FE/UI completadas |
| `openspec/changes/animal-workflow-table-actions-v2/apply-progress.md` | Modified | Mergeó cierre de 1.8/5.1/5.2 y dejó evidencia para verify |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.5, 4.1-4.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` | Integration/Service | ⚠️ Baseline bloqueado al inicio por `JAVA_HOME` de Maven; rerun verde con Java 21 | ✅ Written | ✅ Passed | ✅ 8 casos | ✅ Clean |
| 1.6, 2.2, 4.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalEventServiceTest.java` | Integration/Service | ✅ `AnimalEventServiceTest` baseline | ✅ Written | ✅ Passed | ✅ macho + hembra | ✅ Clean |
| 2.1, 4.5 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalEventResourceTest.java` / `AnimalResourceTest.java` | REST integration | ✅ `AnimalResourceTest` + `AnimalEventResourceTest` baseline | ✅ Written | ✅ Passed | ✅ validation + happy path | ✅ Clean |
| 3.2 | `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.spec.ts` | FE unit | ✅ `animals-events.service.spec.ts` baseline | ✅ Written | ✅ Passed | ✅ queue + projection | ✅ Clean |
| 3.1 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | FE unit | ✅ `animals.service.spec.ts` baseline 6/6 | ✅ Written | ✅ Passed | ✅ canonical query + legacy snapshot normalization | ✅ Clean |
| 3.3, 4.7 | `hato-fe/src/app/features/admin/animals/animal-form-dialog.component.spec.ts` | FE component | N/A (new) | ✅ Written | ✅ Passed | ✅ create + edit validation paths | ✅ Clean |
| 3.4, 4.6 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | FE integration | ✅ `animals-page.component.spec.ts` baseline 9/9 | ✅ Written | ✅ Passed | ✅ toolbar + edit + operative + repro + castration + images | ✅ Clean |
| 3.5 | `hato-fe/src/app/shared/ui/data-table/data-table.component.spec.ts` | FE unit | ✅ `data-table.component.spec.ts` baseline 3/3 | ✅ Written | ✅ Passed | ✅ text/select/date filters | ✅ Clean |

## Test Summary

- **Total tests written**: 15 en este batch
- **Total tests passing**: 24 targeted FE tests + batch 1 targeted suites; en este cierre además pasaron 26 BE targeted + 41 FE targeted
- **Layers used**: Unit (services/data-table), Component (dialog), Integration (animals-page)
- **Approval tests**: None — no pure refactor-only task
- **Pure functions created**: 2 (`normalizeAnimalCategory`, `inferAnimalSexFromCategory`)

## Verification / Closure Evidence

- **1.8 no-aplica**: `AnimalMapper.java` sólo copia `request.category()`/`request.sex()` hacia la entidad y no parsea categorías legacy. La compatibilidad `COW/BULL/CALF/HEIFER` ya está implementada en `SyncPayloadMapper.readAnimalCategory()` + `inferLegacyAnimalSex()`, y el backfill persistente quedó cubierto por la migration `015-animal-category-workflow-v2`.
- **5.1 evidencia BE**:
  - `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test` → **213 tests**, **2 failures** fuera de scope: `OfflineConflictResolutionMigrationTest.shouldGeneratePortableIdentityColumnSqlForPostgresql` y `AdminDashboardResourceTest.shouldDenyDashboardAccessToNonAdmins`.
  - `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalServiceTest,AnimalEventServiceTest,AnimalResourceTest,AnimalEventResourceTest test` → **26/26 green** en suites directamente afectadas por este change.
- **5.2 evidencia FE**:
  - `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false` → **277 tests**, **3 failures** fuera del feature: `app.auth.integration.spec.ts` (2) y `calendar-alerts.integration.spec.ts` (1).
  - `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false --include="src/app/features/admin/animals/**/*.spec.ts" --include="src/app/shared/ui/data-table/data-table.component.spec.ts"` → **41/41 green** en el pack relevante (`animals-page`, `animal-form-dialog`, services y `data-table`).
- **5.3**: smoke manual no ejecutado; queda pendiente de verify/manual QA.

## Deviations from Design

- `3.4`: además de las 4 acciones pedidas por spec, la tabla expone acción explícita de **Castración** para no esconder un cambio de estado crítico dentro del modal operativo.
- `3.4`: las acciones de evento e imágenes usan dialogs livianos locales al feature en lugar de reciclar los formularios inline legacy; el comportamiento queda alineado con el patrón modal sin arrastrar el card-grid anterior.
- `1.8`: la compatibilidad legacy `COW/BULL/CALF/HEIFER` quedó centralizada del lado FE/offline (`animals.service.ts`) y en BE offline sync (`SyncPayloadMapper`); `AnimalMapper.java` no requería cambio útil porque opera sobre `AnimalRequest` ya tipado con enum canónico.

## Issues Found

- `./mvnw test` completo sigue rojo por blockers fuera del alcance directo de esta tanda: `OfflineConflictResolutionMigrationTest.shouldGeneratePortableIdentityColumnSqlForPostgresql` y `AdminDashboardResourceTest.shouldDenyDashboardAccessToNonAdmins`.
- `npm test -- --watch=false` completo también expone fallos fuera del feature en `src/app/app.auth.integration.spec.ts` y `src/app/features/admin/calendar/calendar-alerts.integration.spec.ts`.
- `5.3` manual smoke test no se ejecutó en esta sesión.

## Remaining Tasks

- [ ] 5.3 Manual smoke test
