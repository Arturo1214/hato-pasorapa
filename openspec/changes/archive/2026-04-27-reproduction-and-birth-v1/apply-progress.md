# Apply Progress: reproduction-and-birth-v1

## Implementation Progress

**Change**: reproduction-and-birth-v1  
**Mode**: Strict TDD

### Completed Tasks
- [x] Phase 1 — agregado reproductivo base, migración `007-*`, extensión de `animals` con filiación y contratos offline `ANIMAL_REPRODUCTION_EVENT` + `PENDING_SYNC`.
- [x] Phase 2 — ledger reproductivo append-only con metadata mínima tipada por tipo e idempotencia por `operationId`.
- [x] Phase 3 — partos, crías y proyección mínima de madre/padre/fecha de nacimiento sin sobrescribir parentesco existente.
- [x] Phase 4 — listado `GET /api/animals/{uuid}/reproduction-events`, adapter FE y wiring UI reproductivo separado.
- [x] Phase 5 — push/pull incremental e idempotente para `ANIMAL_REPRODUCTION_EVENT`, más suites objetivo ejecutadas en BE/FE.
- [x] Correctivo verify-feedback — limpieza transaccional compartida para suites Quarkus order-independent y cobertura explícita para `BIRTH` sin `offspringCount` + padre inexistente.

### Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/007-reproduction-and-birth-v1.yaml` | Created | Ledger reproductivo, índices de timeline/pull y columnas de filiación en `animals`. |
| `hato-be/src/main/java/**/AnimalReproductionEvent*.java` | Created | Nuevo agregado completo: enum, entity, DTOs, mapper, repository, service y resource. |
| `hato-be/src/main/java/**/Sync*.java` | Modified | Nuevo `SyncEntityType`, capability matrix y handlers push/pull reproductivos. |
| `hato-be/src/main/java/**/Animal*.java` | Modified | Proyección mínima de filiación en `Animal`/`AnimalResponse` para soporte V1. |
| `hato-be/src/test/java/**/AnimalReproductionEvent*.java` | Created | Tests de liquibase, mapper, service y resource para contratos V1. |
| `hato-be/src/test/java/**/Sync*Test.java` | Modified | Cobertura de push/pull reproductivo, primer pull sin cursor y replay idempotente. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Nuevo tipo offline `ANIMAL_REPRODUCTION_EVENT`, catálogo reproductivo y metadata tipada. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-reproduction-events.service.ts` | Created | Servicio reproductivo queue-first con helper compartido para metadata `BIRTH`. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-reproduction-events-timeline.adapter.ts` | Created | Normalización, filtros, orden descendente y badges sync del timeline reproductivo. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modified | Formulario/timeline reproductivo y acciones por animal alineadas al patrón operativo/sanitario. |
| `hato-fe/src/app/**/reproduction*.spec.ts` | Created/Modified | Tests FE para contratos, servicio, adapter, orquestador y página. |
| `hato-be/src/test/java/bo/pasorapa/hato/support/IntegrationDatabaseCleaner.java` | Created | Helper de limpieza compartido que borra dependencias en orden seguro antes de `animals` y `ganaderos`. |
| `hato-be/src/test/java/bo/pasorapa/hato/support/IntegrationDatabaseCleanerTest.java` | Created | Regression test RED→GREEN para garantizar cleanup order-independent en suites backend. |
| `hato-be/src/test/java/**/{Auth,Admin,Animal*,Sync}*Test.java` | Modified | Reemplazo de `deleteAll()` ad-hoc por el cleaner compartido para eliminar flakiness por orden y nuevas FKs. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalReproductionEventMapperTest.java` | Modified | Cobertura explícita para `BIRTH` sin `offspringCount`. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalReproductionEventServiceTest.java` | Modified | Cobertura explícita para parto con `fatherAnimalUuid` inexistente. |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1–1.3 | `AnimalReproductionEventLiquibaseMigrationTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ schema + FK + columnas | ✅ constraints/nombres consolidados |
| 1.4–1.6 | `offline-types.reproduction.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ catálogo + metadata BIRTH | ✅ tipos compartidos alineados |
| 2.1–2.7 | `AnimalReproductionEventMapperTest.java`, `AnimalReproductionEventServiceTest.java` | Unit/Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ service, preñez, parto, conflicto | ✅ helper `BirthMetadata` y validaciones reutilizadas |
| 3.3–3.5 | `animals-reproduction-events.service.spec.ts` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ queue-first offline/online + helper `buildBirthMetadata` | ✅ armado de metadata BIRTH centralizado |
| 4.1–4.6 | `AnimalReproductionEventResourceTest.java`, `animal-reproduction-events-timeline.adapter.spec.ts`, `animals-page.component.spec.ts` | API/UI | ✅ suites objetivo previas verdes | ✅ Written | ✅ Passed | ✅ orden desc + filtros + wiring UI | ✅ presentación separada de data-access |
| 5.1–5.5 | `SyncServiceTest.java`, `SyncResourceTest.java`, `sync-orchestrator.service.spec.ts` | Integration/API/UI | ✅ suites objetivo previas verdes | ✅ Written | ✅ Passed | ✅ push, pull, replay, missing payload opId | ✅ sync genérico reutilizado sin cursores acoplados |
| Correctivo verify-feedback | `IntegrationDatabaseCleanerTest.java`, `AnimalReproductionEventMapperTest.java`, `AnimalReproductionEventServiceTest.java` | Integration/Unit | ❌ pre-change batch de 17 suites reproducía 20 errores FK/order-dependent | ✅ Written | ✅ `jenv exec ./mvnw -Dtest=IntegrationDatabaseCleanerTest,AnimalReproductionEventMapperTest,AnimalReproductionEventServiceTest test` + `jenv exec ./mvnw test` | ✅ cleanup helper + `BIRTH` sin `offspringCount` + padre inexistente | ✅ cleanup centralizado en 17 suites Quarkus |

### Test Summary
- **Total tests written**: 10 nuevos + 7 extensiones sobre suites existentes
- **Total tests passing**: `jenv exec ./mvnw test` → 97 BE green; batch de seguridad post-fix → 78/78 green
- **Layers used**: Unit, Integration, API/UI
- **Approval tests**: None — se agregaron comportamientos nuevos
- **Pure functions created**: helper `buildBirthMetadata`, adapter reproductivo, parser de UUIDs y validador de metadata

### Design Decisions Resolved During Apply
- `offspringAnimalUuids` es **obligatorio** cuando `offspringCount > 0` y además debe tener cardinalidad exacta.
- La proyección de parentesco en `animals` **no sobrescribe** madre/padre/fecha ya cargados con valores distintos; si hay conflicto se rechaza con `ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT`.

### Deviations from Design
Ninguna crítica. Se mantuvo el agregado separado, la metadata mínima tipada y el contrato offline dedicado; el correctivo sólo consolidó infraestructura de tests.

### Issues Found
- Se confirmó que la flakiness no era sólo por `animal_reproduction_events`: varias suites heredadas también dependían de orden por no limpiar `animal_events`/`animal_health_events`/`animals`/`ganaderos` de forma global.
- No fue necesario tocar FE para este correctivo; el objetivo quedó resuelto completamente en backend.

### Remaining Tasks
- [ ] Ninguna de implementación — listo para `sdd-verify`.

### Status
29/29 tasks complete. Ready for verify rerun.
