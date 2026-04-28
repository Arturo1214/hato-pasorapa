# Apply Progress

**Change**: animal-images-local-storage-v1  
**Mode**: Strict TDD  
**Date**: 2026-04-27

## Completed Tasks

- [x] Phase 1 — contratos FE/BE, changelog `008`, allowlist JPEG/PNG, naming común `checksumSha256` / `binaryRef` / `operationId`.
- [x] Phase 2 — vertical backend completo (`AnimalImage`, repository, DTOs, mapper, storage service, service) con validación de MIME, tamaño, checksum, path traversal e idempotencia por `operationId`.
- [x] Phase 3 — sync incremental FE/BE para `ANIMAL_IMAGE`, storage binario IndexedDB separado, hidratación `base64Data`, ACK parcial y purge post-ACK.
- [x] Phase 4 — endpoints REST autenticados de listado/descarga + data-access/UI Angular con selector múltiple, previews básicas y timeline V1.
- [x] Phase 5 — cobertura final con E2E backend, regresión FE `PENDING → SYNCED` / `FAILED` y exclusiones V1 validadas en tests.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalImageResource.java` | Updated | Se dejó el endpoint REST de listado por animal en recurso DTO-only. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalImageContentResource.java` | Existing | Mantiene descarga autenticada del binario con media types de imagen. |
| `hato-fe/src/app/features/admin/animals/animals-images-offline-flow.spec.ts` | Created | Regresión FE para reconciliación `PENDING→SYNCED` y falla parcial `FAILED`. |
| `openspec/changes/animal-images-local-storage-v1/tasks.md` | Updated | 29/29 tasks marcadas como completas. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `AnimalImageLiquibaseMigrationTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.2 | `AnimalImageLiquibaseMigrationTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.3 | `offline-types.animal-image.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.4 | `offline-types.animal-image.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.5 | `offline-types.animal-image.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Contract alignment | ✅ Naming unified |
| 2.1 | `AnimalImageMapperTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Clean |
| 2.2 | `AnimalImageServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ Ledger cases | ✅ Clean |
| 2.3 | `AnimalImageMapperTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Helpers extracted |
| 2.4 | `AnimalImageStorageServiceTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 paths | ✅ Clean |
| 2.5 | `AnimalImageStorageServiceTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 paths | ✅ Helpers extracted |
| 2.6 | `AnimalImageServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ Idempotency + ordering | ✅ Clean |
| 2.7 | `AnimalImageServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ Idempotency + ordering | ✅ Clean |
| 2.8 | `AnimalImageMapperTest.java`, `AnimalImageStorageServiceTest.java` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Shared helpers exercised | ✅ Validation/security shared |
| 3.1 | `SyncServiceTest.java`, `SyncResourceTest.java` | Integration | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ ACK parcial + no bloqueo | ✅ Clean |
| 3.2 | `SyncServiceTest.java`, `SyncResourceTest.java` | Integration | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Push/Pull cases | ✅ Clean |
| 3.3 | `offline-image-binary-store.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Clean |
| 3.4 | `offline-image-binary-store.service.spec.ts`, `offline-store.service.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Storage + migration | ✅ Clean |
| 3.5 | `sync-orchestrator.service.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Hydration/reconcile/dedupe | ✅ Clean |
| 3.6 | `sync-orchestrator.service.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Hydration/reconcile/dedupe | ✅ Cleanup post-ACK |
| 4.1 | `AnimalImageResourceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ List + download | ✅ Clean |
| 4.2 | `AnimalImageResourceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ List + download | ✅ REST/Service split kept |
| 4.3 | `animals-images.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ Queue-first + limits | ✅ Clean |
| 4.4 | `animals-images.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ Queue-first + limits | ✅ Adapter extracted |
| 4.5 | `animals-page.component.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Multi-upload + timeline | ✅ Clean |
| 4.6 | `animals-page.component.spec.ts` | Unit | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Multi-upload + timeline | ✅ Clean |
| 5.1 | `animal-images-timeline.adapter.ts`, targeted FE/BE suites | Unit/Integration | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Success/failure mapping | ✅ Error mapping normalized |
| 5.2 | `AnimalImageEndToEndSyncTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ Offline→sync→download | ✅ Clean |
| 5.3 | `animals-images-offline-flow.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 flows | ✅ Clean |
| 5.4 | `AnimalImageMapperTest.java`, `SyncResourceTest.java` | Unit/Integration | ✅ Targeted suite green | ✅ Written | ✅ Passed | ✅ Out-of-scope + MIME exclusion | ✅ Clean |

## Test Summary

- **Total tasks complete**: 29/29
- **Targeted test suites passing in this reattempt**: 75 (`hato-fe`: 28, `hato-be`: 47)
- **Layers used**: Unit (contracts, adapter, UI, mapper, storage), Integration (Quarkus services/resources, sync E2E)
- **Approval tests**: None — no behavior-preserving refactor required beyond covered regression checks
- **Pure functions created/refined**: `decorateAnimalImageTimeline`, `normalizeAnimalImageItem`, `AnimalImageSecuritySupport`

## Deviations from Design

- Minor: la descarga autenticada del binario quedó en `AnimalImageContentResource` separado, mientras `AnimalImageResource` conserva el listado DTO-only. No cambia contratos HTTP ni rompe la separación REST → Service.

## Issues Found

- None.

## Remaining Tasks

- [x] None — change ready for `sdd-verify`.

## Status

29/29 tasks complete. Ready for verify.
