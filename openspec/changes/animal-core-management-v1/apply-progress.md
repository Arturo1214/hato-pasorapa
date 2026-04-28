# Apply Progress: animal-core-management-v1

## Mode
Strict TDD

## Completed Tasks
- [x] 1.1 Contrato REST canónico por UUID con `ownerGanaderoId` obligatorio y exclusión de `id` externo.
- [x] 1.2 Migración `004` con ownership, visibles e índices/constraint de unicidad normalizada.
- [x] 1.3 Dominio, DTOs y mapper alineados a `uuid` + `ownerGanaderoId` + visibles.
- [x] 1.4 Normalización/validaciones centrales en `AnimalService`.
- [x] 2.1 Tests de servicio para owner inexistente, arete duplicado, regla de visibles y flexibilidad de `marca/tatuaje`.
- [x] 2.2 Reglas BE implementadas con `GanaderoRepository` + `AnimalRepository`.
- [x] 2.3 REST ajustado a alta/edición por UUID y errores de negocio consistentes.
- [x] 2.4 DTOs como frontera única en REST/service.
- [x] 2.5 Spec FE con validaciones explícitas de owner + visibles + modo edición.
- [x] 2.6 Pantalla standalone `animals-page` con signals, reactive forms y flujo alta/edición por `uuid`.
- [x] 2.7 `AnimalsService` extraído para HTTP/snapshots y componente liviano enfocado en presentación.
- [x] 3.1 Contrato REST de listado con filtros `visible.contains`, `ownerGanaderoId.equals`, `active.equals`, `category.equals` y rechazo de boolean inválido.
- [x] 3.2 Criteria/doc/query service BE alineados a filtros V1.
- [x] 3.3 Predicados reutilizables en `AnimalQueryService` + parser booleano estricto para evitar drift silencioso.
- [x] 3.4 `animals.service.spec.ts` cubre lectura online/offline, filtros esenciales, marcadores pending/conflict y contrato por `uuid`.
- [x] 3.5 Listado paginable/filtros binded en `animals.service.ts` + `animals-page.component.ts` con base lista para offline create/update por `entityId = animalUuid`.
- [x] 4.1 Tests backend de sync cubren `ANIMAL CREATE` offline, replay idempotente y conflicto por versión sin romper foundation.
- [x] 4.2 `SyncPayloadMapper` habilita `ANIMAL CREATE` y parsea payload core (`ownerGanaderoId`, `arete`, `marca`, `tatuaje`, categoría, estado, fecha, peso).
- [x] 4.3 `SyncService` procesa `ANIMAL CREATE/UPDATE` por `uuid`, reutiliza validaciones del core y mantiene `version_conflict` con `manual_refresh`.
- [x] 4.4 `animals.service.spec.ts` cubre cola offline create/update por `entityId = animalUuid`, snapshot local estable y replay vía orquestador.
- [x] 4.5 `offline-types.ts` + `animals.service.ts` alineados al contrato offline/sync sin remapeo de identidad; create/update quedan queue-first.
- [x] 5.1 Ruta `admin/animales` accesible para `ADMIN`/`GANADERO` y sidebar actualizado con navegación operativa.
- [x] 5.2 Cleanup residual FE/BE: contrato público animal sin `id/code/tag` en pull, filtros/docs alineados a `uuid` + `ownerGanaderoId` + visibles y fallback legacy explicitado sólo para sync update.
- [x] 5.3 Suite completa backend `./mvnw test` verde (52 tests).
- [x] 5.4 Suite completa frontend `ng test` verde (79 tests).

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` baseline verde | ✅ Written | ✅ Passed | ✅ create/get/update + owner requerido | ✅ Contrato UUID sin `id` externo |
| 1.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` baseline verde | ✅ Written | ✅ Passed | ➖ Estructural + validado al boot Liquibase | ✅ `004` aislado y enlazado en `master.yaml` |
| 1.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` baseline verde | ✅ Written | ✅ Passed | ✅ create/get/update cubren DTO request/response | ✅ Mapper sin exponer entidad |
| 1.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` | Unit | N/A (nuevo archivo) | ✅ Written | ✅ Passed | ✅ owner inválido + visibles requeridos + arete duplicado | ✅ helper central de normalización/legacy |
| 2.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` | Unit | N/A (nuevo archivo) | ✅ Written | ✅ Passed | ✅ 4 casos de negocio | ✅ Casos alineados a decisión operativa vigente |
| 2.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` | Unit | ✅ `SyncServiceTest`/`SyncResourceTest` baseline verde | ✅ Written | ✅ Passed | ✅ colisión arete vs duplicados permitidos de `marca/tatuaje` | ✅ repository helper por `areteNormalized` |
| 2.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` baseline verde | ✅ Written | ✅ Passed | ✅ create/get/update + 400 bean validation | ✅ Resource liviano delegando a service |
| 2.4 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` baseline verde | ✅ Written | ✅ Passed | ✅ DTOs frontera única en request/response | ✅ Sin exposición de entidad ni `id` interno |
| 2.5 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Component | N/A (nuevo archivo) | ✅ Written | ✅ Passed | ✅ owner requerido + visible requerido + empty state | ✅ Mensajes claros y asserts de comportamiento real |
| 2.6 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Component | ✅ `animals-page.component.spec.ts` baseline verde | ✅ Written | ✅ Passed | ✅ submit mínimo válido + edición por `uuid` | ✅ Formulario standalone + signals sin lógica de acceso a datos embebida |
| 2.7 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Component | ✅ `animals-page.component.spec.ts` 4/4 | ✅ Written | ✅ Passed | ✅ flujo create/edit preservado tras extracción | ✅ `AnimalsService` centraliza HTTP/snapshots y deja el componente liviano |
| 3.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` 2/2 baseline verde | ✅ Written | ✅ Passed | ✅ filtro combinado + boolean inválido | ✅ Dataset semilla cubre owner/visible/category/active sin tocar contrato base |
| 3.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` 2/2 baseline verde | ✅ Written | ✅ Passed | ✅ filtros REST pasan por criteria/doc/query service | ✅ `UuidFilter` + binder estricto sostienen contrato V1 |
| 3.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Integration | ✅ `AnimalResourceTest` 4/4 | ✅ Written | ✅ Passed | ✅ visible OR reutilizable + owner path tipado | ✅ Helper central evita drift entre campos visibles |
| 3.4 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | Unit | N/A (nuevo archivo) | ✅ Written | ✅ Passed | ✅ online query + offline filter + conflict/pending + uuid contract | ✅ Servicio configurable para tests con snapshots/outbox reales |
| 3.5 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts`, `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Unit + Component | ✅ `animals-page.component.spec.ts` 4/4 baseline verde | ✅ Written | ✅ Passed | ✅ bind filtros UI + marcadores sync + canonical snapshot key | ✅ Base de listado queda lista para 4.x sin remapear identidad |
| 4.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Unit + Integration | ✅ `SyncServiceTest` + `SyncResourceTest` 19/19 baseline verde | ✅ Written | ✅ Passed | ✅ create canonical + replay idempotente + conflicto de versión | ✅ Contrato `/sync` animal quedó cubierto sin drift con foundation |
| 4.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Unit + Integration | ✅ backend sync baseline 19/19 | ✅ Written | ✅ Passed | ✅ payload core obligatorio + capability matrix CREATE/UPDATE | ✅ Mapper tipado evita parseo ad-hoc en `SyncService` |
| 4.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Unit + Integration | ✅ backend sync baseline 19/19 | ✅ Written | ✅ Passed | ✅ create por `uuid` + update core/legacy + `version_conflict` preservado | ✅ Reuso de `AnimalService` centraliza ownership/unicidad/normalización |
| 4.4 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | Unit | ✅ `animals.service.spec.ts` + `sync-orchestrator.service.spec.ts` 9/9 baseline verde | ✅ Written | ✅ Passed | ✅ create queued + update queued + snapshot estable por `animalUuid` | ✅ Servicio queda alineado al loop central sin HTTP directo |
| 4.5 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts`, `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ frontend baseline 9/9 | ✅ Written | ✅ Passed | ✅ trigger manual online + replay sin remap + payload tipado | ✅ `offline-types` documenta el contrato canónico FE/BE |
| 5.1 | `hato-fe/src/app/app.routes.admin.spec.ts`, `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts`, `hato-fe/src/app/app.auth.integration.spec.ts` | Unit + Component + Integration | ✅ route/sidebar baseline 4/4 | ✅ Written | ✅ Passed | ✅ admin + ganadero + navegación shell protegida | ✅ `ALLOWED_ROLES` centraliza acceso y el sidebar comparte item sin duplicar feature |
| 5.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ animal/sync backend baseline 29/29 | ✅ Written | ✅ Passed | ✅ payload pull canónico + ocultamiento de claves legacy | ✅ fallback `code/tag` queda acotado y documentado en mapper legacy |
| 5.3 | `./mvnw test` | Verify | ✅ backend focused regression 29/29 | ➖ Verify task (suite completa) | ✅ Passed | ➖ N/A verify-only | ✅ Sin cambios adicionales tras suite completa |
| 5.4 | `ng test --watch=false` | Verify | ✅ frontend focused regression 23/23 | ➖ Verify task (suite completa) | ✅ Passed | ➖ N/A verify-only | ✅ Sin cambios adicionales tras suite completa |

## Test Summary
- **Total tests written**: 27 relevantes acumulados (18 previos + 9 nuevos/casos reforzados en sync, rutas y sidebar)
- **Total tests passing**: 131 en corrida final completa (`52` backend + `79` frontend)
- **Layers used**: Unit (8), Integration (9), Component (6), Verify (2)
- **Approval tests**: 13 baseline frontend/backend usados como safety net antes de tocar rutas, sidebar y contrato pull animal
- **Pure functions created**: 11 (`normalizeVisible`, `toNormalizedKey`, `hasMeaningfulVisible`, `normalizeOptionalText`, `normalizeWeight`, `buildListQuery`, `matchesAnimalFilters`, `decorateAnimalSnapshot`, `parseStrictBoolean`, `createOptimisticAnimalSnapshot`, `applyOptimisticAnimalUpdate`)

## Deviations from Design
- Se aplicó la decisión operativa vigente: `arete` mantiene unicidad global normalizada; `marca` y `tatuaje` quedan sólo indexados/no únicos por ahora.
- Se preservó compatibilidad sync legacy manteniendo `code/tag` sólo como fallback temporal en `ANIMAL UPDATE`; se retiraron del pull canónico y de la documentación pública.
- La base FE quedó bajo `features/admin/animals` como pidió la corrida, no en `features/animals` como figuraba en el design original.
- `SyncService` acepta payload core V1 para create/update animal, pero mantiene fallback legacy `tag/code` en UPDATE para no romper foundation existente durante la transición.
- Alta/edición FE dejaron de ser online-only: ahora ambas entran al outbox y usan `entityId = animalUuid` con snapshot optimista estable, disparando sync manual online y sin remap de identidad.
- La navegación FE quedó bajo `/admin/animales` aunque el acceso lo comparten `ADMIN` y `GANADERO`; se priorizó consistencia con el árbol actual antes de renombrar namespaces.

## Remaining Tasks
- [x] Ninguna en apply. Cambio listo para `sdd-verify`.
