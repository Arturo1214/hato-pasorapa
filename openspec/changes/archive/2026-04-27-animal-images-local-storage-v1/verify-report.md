# Verification Report

**Change**: animal-images-local-storage-v1  
**Mode**: Strict TDD (verified)  
**Artifact store**: hybrid (engram + openspec)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 29 |
| Tasks complete | 29 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution (evidence)

### Frontend (hato-fe)

- **Node/NPM**: Node `v25.9.0`, npm `11.12.1` (via nvm; `.nvmrc` is `20.19.6` but environment resolved to 25.9.0 during verify)
- **Install**: `npm ci` ✅
- **Tests**: `npm test` (`ng test`) ✅ **113 passed** across **33 files**, 0 failed
- **Build**: `npm run build` ✅ (warning: initial bundle budget exceeded)
- **Coverage**: `ng test --coverage` ➖ not available (missing `@vitest/coverage-v8`)

### Backend (hato-be)

- **Java**: `21.0.5` (via explicit `JAVA_HOME` to avoid toolchain mismatch)
- **Tests**: `./mvnw test` ✅ **109 run**, 0 failed
- **Compile**: `./mvnw -DskipTests compile` ✅

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `openspec/.../apply-progress.md` includes full TDD Cycle Evidence table |
| All tasks have tests | ✅ | All tasks map to existing test files listed in the table |
| RED confirmed (tests exist) | ✅ | Verified existence of key files (FE + BE) for the change |
| GREEN confirmed (tests pass) | ✅ | `ng test` + `./mvnw test` both passed during verify |
| Triangulation adequate | ✅ | Multi-case where needed (e.g., MIME allowlist, reconciliation, partial ack) |
| Safety net for modified files | ✅ | Table marks targeted suites green for modified areas |

**Assertion quality**: ✅ No tautologies/ghost-loop patterns found in reviewed change-related tests.

---

## Spec Compliance Matrix (behavioral)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Append-only image metadata per animal | Alta válida de múltiples imágenes | `hato-be/.../AnimalImageServiceTest.java > shouldCreateAppendOnlyAnimalImagesIdempotentlyAndListInDeterministicOrder` | ✅ COMPLIANT |
| Append-only image metadata per animal | Metadata mínima incompleta | `hato-be/.../AnimalImageMapperTest.java > shouldRejectIncompleteMetadata` | ✅ COMPLIANT |
| Basic listing + thumbnail metadata | Listado básico ordenado por animal | `hato-be/.../AnimalImageResourceTest.java > shouldListAnimalImagesInStableOrderAndDownloadAuthenticatedContent` | ✅ COMPLIANT |
| Basic listing + thumbnail metadata | Miniatura no disponible | `hato-fe/.../animals-images-offline-flow.spec.ts > should reconcile a pending image...` (pull returns `thumbnailRef: null`) | ✅ COMPLIANT |
| Queue-first offline image capture | Carga offline pendiente | `hato-fe/.../animals-images-offline-flow.spec.ts > should reconcile a pending image...` | ✅ COMPLIANT |
| Queue-first offline image capture | Reintento de la misma operación | `hato-be/.../SyncServiceTest.java > shouldCreateAnimalImageOfflineIdempotentlyAndKeepOtherEntityTypesFlowingOnPartialAck` (replay push) | ⚠️ PARTIAL (server idempotent proven; FE does not expose explicit re-enqueue same `operationId`) |
| Incremental push/pull reconciliation | Reconciliación exitosa post-conectividad | `hato-fe/.../animals-images-offline-flow.spec.ts > should reconcile...` + `hato-be/.../AnimalImageEndToEndSyncTest.java > shouldSyncOfflineImageThenListAndDownloadAuthenticatedContent` | ✅ COMPLIANT |
| Incremental push/pull reconciliation | Falla parcial de sincronización | `hato-fe/.../animals-images-offline-flow.spec.ts > should keep partial sync failures...` + `hato-be/.../SyncResourceTest.java > shouldSyncAnimalImageCreateAndPullWithoutBlockingPartialFailures` | ✅ COMPLIANT |
| Secure local filesystem persistence | Persistencia local válida | `hato-be/.../AnimalImageStorageServiceTest.java > shouldValidateChecksumAndWriteInsideConfiguredRoot` | ✅ COMPLIANT |
| Secure local filesystem persistence | Validación de seguridad fallida | `hato-be/.../AnimalImageStorageServiceTest.java > shouldRejectPathTraversalAndMimeOutsideAllowlist` + `hato-be/.../AnimalImageMapperTest.java > shouldRejectMimeOutsideV1Allowlist` | ✅ COMPLIANT |
| Authenticated retrieval + V1 exclusions | Descarga autenticada de imagen | `hato-be/.../AnimalImageResourceTest.java` + `hato-be/.../AnimalImageEndToEndSyncTest.java` | ✅ COMPLIANT |
| Authenticated retrieval + V1 exclusions | Solicitud de funcionalidad excluida | `hato-be/.../AnimalImageMapperTest.java > shouldRejectSizeMismatchAndOutOfScopeFields` | ✅ COMPLIANT |

**Compliance summary**: 10/11 scenarios ✅ compliant, 1 ⚠️ partial, 0 failing, 0 untested.

---

## Correctness (Static — structural evidence)

- **Múltiples imágenes por animal**: BE `AnimalImageService` + repo query + resource listing; FE timeline adapter supports multiple entries.
- **Cola offline + binario temporal en IndexedDB**: FE `OfflineImageBinaryStoreService` stores blobs by `operationId` and provides base64 for push; purge after ACK verified.
- **Sync idempotente `ANIMAL_IMAGE`**: BE idempotency by `operationId` (service lookup + DB unique constraint), plus receipts pipeline; replay push tested.
- **Persistencia final en filesystem local**: BE `AnimalImageStorageService` writes under configured root (`hato.storage.animal-images.root-dir`) and validates MIME/size/checksum/path.
- **Límites V1**: FE blocks >3 images and >2MB; BE enforces MIME allowlist + max bytes (2MB) and size mismatch.
- **Validaciones de seguridad**: path traversal protection + MIME spoofing guard via allowlist + checksum verification.

---

## Coherence (Design)

| Decision / Design item | Followed? | Notes |
|---|---:|---|
| Binary transported as `base64Data` in `/sync/push` | ✅ | Covered by BE E2E sync test and FE orchestrator integration |
| Client binary stored outside snapshots (IndexedDB store) | ✅ | Dedicated binary store + migrations present |
| Server FS + DB metadata with compensation | ✅ | Storage/service tests cover security + write; service idempotency tested |
| **Minor deviation**: `AnimalImageContentResource` separated from `AnimalImageResource` | ✅ (documented) | Matches apply-progress deviation; HTTP contract unchanged; listing remains DTO-only |

---

## Issues Found

### CRITICAL (block archive)
- None.

### WARNING (non-blocking)
- FE coverage run not available without installing `@vitest/coverage-v8`.
- FE build budget warning (initial bundle size > configured budget).
- BE test logs show unrecognized/deprecated Quarkus config keys (does not fail tests, but should be cleaned).

### SUGGESTION
- If you want the spec scenario “re-enqueue same operationId” to be literally true on FE side, add a guard in `OfflineStoreService.enqueueOperation` (or in `AnimalsImagesService`) to avoid duplicate `operationId` in outbox when `input.operationId` is supplied.

---

## Verdict

**PASS WITH WARNINGS** — No blockers. Change is eligible for `sdd-archive`.
