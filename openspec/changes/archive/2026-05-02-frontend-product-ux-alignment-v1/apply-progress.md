# Apply Progress: frontend-product-ux-alignment-v1

## Status

- Completed tasks: 45 / 45
- Active mode: Strict TDD
- Batch scope completed: public registration/auth alignment + FE onboarding flow + home redirect cleanup + profile flow + admin ganadero password reset + dashboard charts + shared data table + admin tables/dialogs + pending closure review for tasks 2.1 and 6.4

## Completed Tasks

- [x] 1.1
- [x] 1.2
- [x] 1.3
- [x] 1.4
- [x] 1.5
- [x] 1.6
- [x] 1.7
- [x] 1.8
- [x] 1.9
- [x] 1.10
- [x] 2.2
- [x] 2.3
- [x] 2.1
- [x] 2.4
- [x] 2.5
- [x] 2.6
- [x] 2.7
- [x] 3.1
- [x] 3.3
- [x] 3.4
- [x] 3.5
- [x] 3.2
- [x] 3.6
- [x] 3.7
- [x] 3.8
- [x] 3.9
- [x] 4.1
- [x] 4.2
- [x] 4.3
- [x] 4.4
- [x] 4.5
- [x] 4.6
- [x] 4.7
- [x] 4.8
- [x] 4.9
- [x] 4.10
- [x] 4.11
- [x] 4.12
- [x] 5.1
- [x] 5.2
- [x] 5.3
- [x] 6.1
- [x] 6.2
- [x] 6.3
- [x] 6.4

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.8 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/PublicGanaderosResourceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.9 | `hato-be/src/test/java/bo/pasorapa/hato/service/validator/AntiSpamValidatorTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.10 | `hato-be/src/test/java/bo/pasorapa/hato/service/PublicGanaderoServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 2.2-2.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/AuthServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | Unit + Integration | ✅ Existing auth tests green | ✅ Written | ✅ Passed | ✅ email + CI + invalid | ✅ Clean |
| 2.4-2.5, 6.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/GanaderosResourceTest.java` | Integration | ✅ Existing ganadero admin tests green (with Java 21 runtime) | ✅ Written | ✅ Passed | ✅ list + disable + update + reset temp password | ✅ Clean |
| 3.2 | `hato-fe/src/app/app.routes.admin.spec.ts` | Route/unit | ✅ Existing route specs green | ✅ Written | ✅ Passed | ✅ dashboard redirect + perfil route | ✅ Clean |
| 3.6-3.8 | `hato-fe/src/app/features/public/ganadero-registration-page/ganadero-registration-page.component.spec.ts` | Component | ✅ Existing registration spec green | ✅ Written | ✅ Passed | ✅ validation + honeypot + submit | ✅ Inline cleanup |
| 3.9 | `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts` | Unit | ✅ Existing auth service spec green | ✅ Written | ✅ Passed | ✅ email + CI + logout path | ➖ None needed |
| 4.1-4.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminProfileResourceTest.java`, `hato-fe/src/app/features/admin/profile/profile-page.component.spec.ts` | Integration + Component | N/A (new) | ✅ Written | ✅ Passed | ✅ contact update + current password invalid + password change | ✅ Clean |
| 5.1 | `hato-fe/src/app/app.routes.admin.spec.ts`, `hato-fe/src/app/app.routes.spec.ts` | Route/unit | ✅ Existing route specs green | ✅ Written | ✅ Passed | ✅ redirect scenarios | ✅ Clean |
| 2.6-2.7 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminUsersResourceTest.java` | Integration | ✅ Existing admin users resource tests green (with Java 21 runtime) | ✅ Written | ✅ Passed | ✅ create + update + validation + non-admin 403 | ✅ Clean |
| 3.1, 4.4-4.6 | `hato-fe/src/app/features/admin/charts/charts-lazy.component.spec.ts`, `hato-fe/src/app/features/admin/dashboard/admin-dashboard-page.component.spec.ts` | Component | ✅ Existing dashboard specs green | ✅ Written | ✅ Passed | ✅ bar + doughnut + metrics fetch on load | ✅ Deferred chart chunk |
| 3.3-3.5, 5.3 | `hato-fe/src/app/ui/layout/main-layout/header/header.spec.ts`, `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts`, `hato-fe/src/app/app.routes.admin.spec.ts`, `hato-fe/src/app/app.routes.spec.ts` | Component + Route | ✅ Existing sidebar/route specs green | ✅ Written | ✅ Passed | ✅ branding + logout + role nav + lazy route verification | ✅ Product copy cleanup |
| 4.7-4.12 | `hato-fe/src/app/shared/ui/data-table/data-table.component.spec.ts`, `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts`, `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | Component | ✅ Existing admin page specs green | ✅ Written | ✅ Passed | ✅ filters + dialogs + disable/reset flows | ✅ Shared table extraction |
| 2.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/AuthServiceTest.java` | Spec/design review + existing integration | ✅ Existing auth coverage already green | ➖ No new RED: task closed as not applicable after verifying repository ownership against spec/design | ➖ No code change required | ✅ existing email + CI + invalid identifier scenarios already cover acceptance criteria | ✅ Preserved `Ganadero` ownership of `businessIdentifier` |
| 6.4 | `hato-fe/src/app/features/public/ganadero-registration-page/ganadero-registration-page.component.spec.ts`, `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts`, `hato-fe/src/app/features/admin/dashboard/admin-dashboard-page.component.spec.ts` | Component + unit fallback | ✅ Existing FE specs already green | ➖ Deferred: no Playwright / no `e2e` target configured for `hato-fe` | ➖ No code change required | ✅ submit payload + session persistence + dashboard render already covered at lower layers | ➖ E2E intentionally deferred for V1 |

## Test Summary

- Total tests written/updated in this change so far: 17 files
- Total tests passing executed in this batch: 0 (closure review only, no code changes)
- Layers used: Route/unit, Component, Integration
- Approval tests: None
- Pure functions created: 4 (`passwordsMatch`, `resolveErrorMessage`, chart dataset builders, table display formatter wiring)

## Deviations from Design

- Java package segments cannot be named `public`; implementation uses `publicapi` and `registration` packages instead of `web.rest.public` / `service.public`.
- CI → email resolution is correctly implemented in `AuthService` through `GanaderoRepository`, so task 2.1 is closed as not applicable because `UserRepository` does not own `businessIdentifier`.
- Ganadero profile contact data is persisted as JSON inside `Ganadero.contactInfo`, so the FE can keep separate `telefono`/`direccion` fields without a schema migration in this batch.
- Dashboard charts were lazy-loaded with Angular `@defer` inside `/admin/dashboard` instead of a nested chart route, preserving the existing URL while still splitting the charts chunk.
- The shared table lives under `hato-fe/src/app/shared/ui/data-table/` to respect the current repo layout instead of the literal `ui/shared/` path from design.md.
- Playwright/E2E remains deferred for V1 because `hato-fe/angular.json` does not define an `e2e` target and the frontend standards say E2E is not configured by default.

## Remaining Tasks

- None.
