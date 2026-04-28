# Implementation Progress

**Change**: multi-entity-sync-regression-harness-v1  
**Mode**: Strict TDD

## Completed Tasks
- [x] 1.1–1.3 baseline decisions, defensive cap `hasMore=10` y tagging `[smoke]`/`[stress]` documentados en tests + tasks.
- [x] 1.4–1.5 helpers FE `sync-harness.fixtures.ts` y `sync-harness.assertions.ts` para escenarios determinísticos y asserts reutilizables.
- [x] 1.6 helper BE `SyncHarnessFixtures.java` con seed deterministic, requests y `PullPageExpectation`.
- [x] 2.1–2.9 matriz FE en `sync-orchestrator.service.spec.ts` + runtime fields (`attempt`, `reconnectCount`, `batchComposition`, `hasMoreObserved`) + guard de overflow a 10 páginas.
- [x] 3.1–3.9 cobertura BE en `SyncServiceTest.java` y `SyncResourceTest.java` para mixed batch idempotente, drenado `hasMore`, decisiones de conflicto y append repetido del audit ledger por `operationId`.
- [x] 4.1–4.4 matriz smoke/stress actualizada en `tasks.md`, comments de gating en suites FE/BE y corridas focalizadas verdes listas para verify.

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-fe/src/app/core/offline/testing/sync-harness.fixtures.ts` | Created | Fixtures determinísticos FE, páginas pull, mixed batch y overflow guard constants. |
| `hato-fe/src/app/core/offline/testing/sync-harness.assertions.ts` | Created | Asserts reutilizables para orden, checkpoint, snapshots y runtime cycle. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Se agregaron campos runtime observability y constante defensiva de paginación. |
| `hato-fe/src/app/core/offline/sync-metrics.store.ts` | Modified | Defaults runtime alineados con los nuevos campos del harness. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Drenado `hasMore` hasta `false`, guard de 10 páginas y snapshot runtime con attempt/reconnect/batch/hasMore. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modified | Casos `[smoke]`/`[stress]` para continuidad push→pull, retry mixed batch, reconnect overflow y conflicto encadenado. |
| `hato-be/src/test/java/bo/pasorapa/hato/support/sync/SyncHarnessFixtures.java` | Created | Builder/seed deterministic para animales/usuarios/ganaderos, requests y expectativas de pull paginado. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Replay controlado de conflictos resueltos con `retry_local` para permitir audit append repetido. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | Smoke/stress coverage para mixed batch idempotente, `hasMore` monotónico y replay de conflicto append-only. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | Contrato REST para replay de conflicto vía `retry_local` y paginación `hasMore=true`/`false`. |
| `openspec/changes/multi-entity-sync-regression-harness-v1/tasks.md` | Modified | Todas las tareas marcadas completas y matriz smoke/stress expandida con required fields. |

## Deviations from Design
Ninguna relevante. La implementación siguió el enfoque de extender suites existentes con helpers compartidos FE/BE.

## Issues Found
- El cambio sí necesitó un ajuste productivo controlado en `SyncService.java` para permitir replay después de `retry_local`; sin eso no era posible cumplir el requirement de append repetido por `operationId`.
- El drenado FE de `hasMore` también requirió instrumentación productiva mínima en `sync-orchestrator.service.ts` para que el harness observe la paginación real y no un mock incompleto.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java`, `SyncResourceTest.java` | Unit + Integration | ✅ FE 16/16, BE 50/50 | ✅ Written first | ✅ Passed | ➖ Structural decision | ✅ Comments/tagging unified |
| 1.2 | `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java` | Unit + Integration | ✅ FE 16/16, BE 50/50 | ✅ Written first | ✅ Passed | ✅ 3 pagination paths | ✅ Shared max-page constant |
| 1.3 | `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java`, `SyncResourceTest.java` | Unit + Integration | ✅ FE 16/16, BE 50/50 | ✅ Written first | ✅ Passed | ✅ smoke vs stress naming | ✅ CI gate comments centralized |
| 1.4 | `sync-orchestrator.service.spec.ts` | Unit | N/A (new) | ✅ Written first | ✅ Passed | ✅ paged + retry + overflow fixtures | ✅ Fixture builders extracted |
| 1.5 | `sync-orchestrator.service.spec.ts` | Unit | N/A (new) | ✅ Written first | ✅ Passed | ✅ checkpoint/runtime/order assertions | ✅ Assertion helpers extracted |
| 1.6 | `SyncServiceTest.java`, `SyncResourceTest.java` | Integration | N/A (new) | ✅ Written first | ✅ Passed | ✅ mixed batch + paged pull + replay seeds | ✅ `PullPageExpectation` extracted |
| 2.1 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Written first | ✅ 17/17 | ✅ baseline + paged pull | ➖ None needed |
| 2.2 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Reused RED | ✅ 17/17 | ✅ push/pull continuity exercised | ✅ Runtime wiring isolated |
| 2.3 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Approval baseline | ✅ 19/19 | ✅ helper usage across cases | ✅ setup deduplicated |
| 2.4 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Written first | ✅ 18/18 | ✅ retry + duplicate mixed batch | ➖ None needed |
| 2.5 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Reused RED | ✅ 18/18 | ✅ success after scheduled retry | ✅ expectations stabilized |
| 2.6 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Approval baseline | ✅ 19/19 | ✅ mixed USER/ANIMAL scenario builder | ✅ data drift removed |
| 2.7 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Written first | ✅ 19/19 | ✅ reconnect overflow + conflict chain | ➖ None needed |
| 2.8 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Reused RED | ✅ 19/19 | ✅ attempt/reconnect/batch/hasMore fields | ✅ runtime context helper added |
| 2.9 | `sync-orchestrator.service.spec.ts` | Unit | ✅ 16/16 | ✅ Written first | ✅ 19/19 | ✅ finite vs overflow pagination | ✅ explicit error message |
| 3.1 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Written first | ✅ 27/27 | ✅ single + mixed duplicate cases | ➖ None needed |
| 3.2 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Reused RED | ✅ 27/27 | ✅ no duplicate side effect checks | ✅ stable ordering assertions |
| 3.3 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Approval baseline | ✅ 29/29 | ✅ helper-backed seeding | ✅ setup consolidated |
| 3.4 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Written first | ✅ 28/28 | ✅ 100+1 page drain | ➖ None needed |
| 3.5 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Reused RED | ✅ 28/28 | ✅ `hasMore=true` then `false` | ✅ monotonic cursor expectation |
| 3.6 | `SyncServiceTest.java` | Integration | ✅ 26/26 | ✅ Approval baseline | ✅ 29/29 | ✅ named expectation record | ✅ readability improved |
| 3.7 | `SyncResourceTest.java` | Integration | ✅ 24/24 | ✅ Written first | ✅ 25/25 | ✅ retry_local replay + conflict list | ➖ None needed |
| 3.8 | `SyncResourceTest.java` | Integration | ✅ 24/24 | ✅ Reused RED | ✅ 25/25 | ✅ `accept_server`/`retry_local`/`discard_local` contract preserved | ✅ response checks grouped |
| 3.9 | `SyncResourceTest.java` | Integration | ✅ 24/24 | ✅ Approval baseline | ✅ 26/26 | ✅ paged pull + repeated audit trail | ✅ request builders reused |
| 4.1 | `tasks.md` + suites | Manual + Integration | ✅ prior task coverage | ✅ Matrix requirement encoded in tests first | ✅ Passed | ➖ Structural artifact | ✅ footer matrix expanded |
| 4.2 | `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java`, `SyncResourceTest.java` | Unit + Integration | ✅ prior task coverage | ✅ Written first | ✅ Passed | ➖ Structural comments | ✅ gate comments aligned |
| 4.3 | `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java`, `SyncResourceTest.java` | Unit + Integration | ✅ FE 16/16, BE 50/50 | ✅ Written first | ✅ FE 19/19, BE 55/55 | ✅ shared operation timeline by `operationId` | ✅ helper files reuse |
| 4.4 | FE/BE targeted suites | Unit + Integration | ✅ Baseline captured | ✅ Existing files updated only after RED | ✅ FE 19/19 + BE 55/55 | ➖ Suite gate | ✅ no flaky randomness in harness data |

## Test Summary
- **Total tests written**: 8 nuevos/ajustados específicos del change (FE 4, BE service 3, BE REST 2; uno reemplazó expectativas existentes).
- **Latest targeted passing runs**: FE `sync-orchestrator.service.spec.ts` 19/19; BE `SyncServiceTest,SyncResourceTest` 55/55.
- **Layers used**: Unit (FE), Integration (BE service + REST).
- **Approval tests**: baselines focalizadas de `sync-orchestrator.service.spec.ts`, `SyncServiceTest.java`, `SyncResourceTest.java`.
- **Pure/shared functions created**: FE fixture/assertion helpers + BE `SyncHarnessFixtures` + runtime context helpers.

## Remaining Tasks
- [x] Ninguna. El change quedó listo para `sdd-verify`.

## Status
28/28 tareas completadas. Harness FE+BE, runtime observability, gating smoke/stress, replay de conflictos y paginación defensiva quedaron listos para verify.
