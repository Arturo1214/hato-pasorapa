## Implementation Progress

**Change**: analytics-decision-support-v1
**Mode**: Strict TDD

### Completed Tasks
- [x] 1.1–1.5 Contratos offline, migración v10 y fixtures compartidas para reporting/decision-support.
- [x] 2.1–2.5 Guardrails descriptivos, ventanas acotadas y proyección reusable para insights explicables.
- [x] 3.1–3.5 Store incremental offline-first, pantalla standalone `admin/decision-support` y ruta protegida con fallback.
- [x] 4.1–4.3 No-regresión de `/api/sync` y centralización FE de mensajes/constantes de alcance.
- [x] 5.1–5.4 Ejecución de suites FE/BE, checklist actualizado y correctivo de cobertura runtime offline + comparación período-vs-período.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Added decision-support contracts and derived-state metadata. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Bumped schema to v10 and initialized persisted decision-support state. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Added get/set/invalidate APIs for decision-support cache. |
| `hato-fe/src/app/features/admin/shared/admin-analytics-scope.ts` | Created | Centralized analytics guardrail windows/messages/manual-copy. |
| `hato-fe/src/app/features/admin/reporting/testing/admin-analytics-offline.fixtures.ts` | Created | Shared offline fixtures for reporting and decision-support tests. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` | Modified | Exposed reusable reporting base for decision-support composition. |
| `hato-fe/src/app/features/admin/decision-support/**` | Created | Added utils, projection, store, page and specs for local-first decision support. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.store.ts` | Modified | Preserved offline status message during startup/manual refresh without triggering sync side-effects. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.store.spec.ts` | Modified | Added direct offline runtime proof from local snapshots plus no-sync-side-effects assertions. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support-projection.ts` | Modified | Extracted deterministic bounded comparison helper reused by decision-support insights. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support-projection.spec.ts` | Modified | Added deterministic bounded/aligned period-vs-period regression test with shuffled input. |
| `hato-fe/src/app/app.routes.ts` | Modified | Added protected `admin/decision-support` route with fallback to reporting page. |
| `hato-fe/src/app/app.routes.spec.ts` | Created | Covered route registration and lazy-load path. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceV2IntegrationTest.java` | Modified | Asserted sync payload remains free of decision-support analytics fields. |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `offline-types.spec.ts` | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 1.2 | `offline-types.ts` | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 1.3 | `offline-store.service.spec.ts` | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ API cleanup |
| 1.4 | `offline-store.migrations.spec.ts` | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ v10 normalization |
| 1.5 | `admin-analytics-offline.fixtures.ts` via reporting/decision-support specs | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ Shared across 4 specs | ✅ Extracted helpers |
| 2.1 | `admin-decision-support-projection.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Reused reporting base |
| 2.2 | `admin-decision-support.utils.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.3 | `admin-decision-support.utils.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Helper extraction |
| 2.4 | `admin-decision-support-projection.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Stable insight builder |
| 2.5 | `admin-reporting-projection.spec.ts` | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ Existing + shared fixtures | ✅ Exposed base projection |
| 3.1 | `admin-decision-support.store.spec.ts` | Integration | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Source-signature reuse |
| 3.2 | `admin-decision-support.store.spec.ts` | Integration | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Persisted signal store |
| 3.3 | `admin-decision-support-page.component.spec.ts` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ➖ None needed |
| 3.4 | `admin-decision-support-page.component.spec.ts` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ OnPush standalone page |
| 3.5 | `app.routes.spec.ts` | Unit | ✅ 47/47 FE batch before route assertion | ✅ Written | ✅ Passed | ➖ Single route behavior | ➖ None needed |
| 4.1 | `SyncResourceV2IntegrationTest.java` | Integration | ✅ 2/2 baseline BE | ✅ Written | ✅ Passed | ✅ existing sync + contract assertions | ➖ None needed |
| 4.2 | `SyncResourceV2IntegrationTest.java` | Integration | ✅ 2/2 baseline BE | ✅ Written | ✅ Passed | ✅ snapshot contract assertions | ➖ None needed |
| 4.3 | `admin-analytics-scope.ts` via FE specs | Unit | ✅ 36/36 baseline FE | ✅ Written | ✅ Passed | ✅ reused by reporting + decision-support | ✅ Centralized constants |
| 5.1 | FE targeted suite | Verification | N/A | ✅ Written earlier | ✅ Passed | ✅ 12 files / 48 tests | ➖ None needed |
| 5.2 | `SyncResourceV2IntegrationTest` | Verification | N/A | ✅ Written earlier | ✅ Passed | ✅ 2 integration cases | ➖ None needed |
| 5.3 | FE+BE targeted suites | Verification | N/A | ✅ Written earlier | ✅ Passed | ✅ offline/render/recompute/guardrail scenarios | ➖ None needed |
| 5.4 | `tasks.md` + this artifact | Process | N/A | ✅ Written | ✅ Passed | ➖ Single | ➖ None needed |
| 5.3 corrective | `admin-decision-support.store.spec.ts`, `admin-decision-support-projection.spec.ts` | Integration + Unit | ✅ 4/4 corrective baseline FE | ✅ Written | ✅ Passed (6/6 targeted) | ✅ offline runtime + shuffled bounded comparison | ✅ comparison helper + offline status constant |

### Test Summary
- **Total tests written**: 12 updated/new spec files + 2 corrective scenarios.
- **Total tests passing**: FE 48/48 targeted tests + FE corrective 6/6 targeted tests, BE 2/2 targeted tests.
- **Layers used**: Unit, Integration.
- **Approval tests**: None — no legacy behavior refactor requiring snapshot approval beyond safety-net suites.
- **Pure functions created**: `coerceDecisionSupportWindow`, `assertDecisionSupportScope`, `filterWindowRecords`, `resolveDecisionSupportSeverity`, `calculateDeltaPct`, `isPeriodKeyInWindow`, `buildDecisionSupportPeriodComparison`.

### Deviations from Design
None — implementation matches the local-first descriptive design and keeps final decisions manual.

### Issues Found
- The repository already had substantial unrelated dirty changes before this apply batch; they were left untouched.

### Remaining Tasks
- [ ] None.

### Status
21/21 tasks complete. Ready for `sdd-verify`.
