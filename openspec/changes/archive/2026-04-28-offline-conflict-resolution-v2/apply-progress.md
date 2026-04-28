# Apply Progress: offline-conflict-resolution-v2

**Change**: offline-conflict-resolution-v2  
**Mode**: Strict TDD  
**Date**: 2026-04-28

## Completed Tasks
- [x] 1.1-1.5 Foundation: migration `010`, V2 contracts, schema v7 metadata, type specs.
- [x] 2.1-2.5 Backend policy source-of-truth: policy matrix by `entityType/opType`, diff metadata, backward-compatible V1/V2 conflict payload.
- [x] 3.1-3.7 Frontend orchestration/UI: offline store helpers, sync conflict refresh channel, conflict store, route, sidebar badge, diff page with required reason.
- [x] 4.1-4.5 Manual resolution flow: `/api/sync/conflicts` list + resolve endpoints, FE local effects (`acked|pending`) and original-payload retry semantics.
- [x] 5.1-5.4 Audit ledger: dedicated append-only table/repository/entity and DETECTED/RESOLVED writes.
- [x] 6.1-6.3 Validation: targeted suites plus full `npm test` and full `./mvnw test`; rollout guard via `offlineConflictResolutionV2` runtime flag + `X-Sync-Conflict-Version: 2` header.

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/010-offline-conflict-resolution-v2.yaml` | Created | Added receipt V2 columns and append-only audit ledger with retention index. |
| `hato-be/src/main/java/**/SyncService.java` | Modified | Added V2 conflict payload generation, policy lookup, diff computation, conflict listing and manual resolution. |
| `hato-be/src/main/java/**/SyncResource.java` | Modified | Added header-guarded `/api/sync/conflicts` endpoints. |
| `hato-be/src/main/java/**/SyncConflictAuditLedger*.java` | Created | Added entity/repository for append-only audit. |
| `hato-be/src/test/java/**/OfflineConflictResolutionMigrationTest.java` | Created | Covered Liquibase migration for ledger/indexes/receipt columns. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Added V2 policy/diff/audit contracts. |
| `hato-fe/src/app/core/offline/offline-store*.ts` | Modified | Added conflict audit persistence, pending reset, server snapshot replacement, schema v7 migration. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Consumed V2 conflict metadata and emitted shared conflict refresh signal. |
| `hato-fe/src/app/features/admin/conflicts/**` | Created | Added conflict store, HTTP client, page component and specs. |
| `hato-fe/src/app/app.routes.ts`, `sidebar.ts`, `app.initializers.ts` | Modified | Wired conflicts UI, badge and startup initialization. |

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/OfflineConflictResolutionMigrationTest.java` | Unit/Migration | ✅ baseline targeted BE sync tests | ✅ Written | ✅ Passed | ✅ table + columns + indexes | ✅ names aligned to schema |
| 1.4-1.5 | `hato-fe/src/app/core/offline/offline-types.spec.ts` | Unit | ✅ baseline FE offline tests | ✅ Written | ✅ Passed | ✅ actions + diff + policy contracts | ➖ None needed |
| 2.1-2.5 | `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapperTest.java`, `.../SyncServiceTest.java` | Unit | ✅ baseline targeted BE sync tests | ✅ Written | ✅ Passed | ✅ policy matrix + diff + exclusions | ✅ helper extraction for policy keys |
| 3.1-3.7 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts`, `.../sync-orchestrator.service.spec.ts`, `.../admin-conflict-resolution.store.spec.ts`, `.../conflict-resolution-page.component.spec.ts` | Unit/Integration | ✅ baseline FE offline tests | ✅ Written | ✅ Passed | ✅ state transitions + page actions + refresh event | ✅ selectors/helpers simplified |
| 4.1-4.5 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java`, `.../SyncServiceTest.java`, `hato-fe/src/app/features/admin/conflicts/data-access/admin-conflict-resolution.store.spec.ts` | REST/Unit/Integration | ✅ baseline targeted FE+BE tests | ✅ Written | ✅ Passed | ✅ accept_server + retry_local + policy rejection | ✅ header guard + local effect helpers |
| 5.1-5.4 | `hato-be/src/test/java/bo/pasorapa/hato/repository/SyncConflictAuditLedgerRepositoryTest.java`, `.../SyncServiceTest.java` | Repository/Unit | ✅ baseline targeted BE sync tests | ✅ Written | ✅ Passed | ✅ DETECTED + RESOLVED chronology | ✅ append-only responsibility centralized |
| 6.1-6.3 | Full FE/BE suites | Full suite | N/A | ✅ Written earlier | ✅ Passed | ✅ targeted + full suites | ✅ rollout guard wired with runtime flag + header |

## Test Summary
- **Frontend targeted suite**: 34 passing tests.
- **Frontend full suite**: 165 passing tests.
- **Backend targeted suite**: targeted sync/conflict suite passing.
- **Backend full suite**: `./mvnw test` passing.

## Decisions Documented
- **Audit ledger TTL V2**: 365 días (`CONFLICT_LEDGER_TTL_DAYS = 365`).
- **`retry_local` semantics**: no permite editar payload en V2; el FE re-habilita el mismo payload original en `pending`.

## Remaining Issues / Risks
- El rollout guard usa runtime flag FE `offlineConflictResolutionV2` + header `X-Sync-Conflict-Version: 2`; verify debería confirmar si el producto quiere esconder también la navegación de conflictos cuando el flag esté apagado.
- La UI muestra diff genérico por campo y no editor previo al retry (decisión explícita para V2).
