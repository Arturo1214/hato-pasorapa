# Apply Progress: MVP Admin + Ganaderos Offline Foundation

**Change**: `mvp-admin-ganaderos-offline-foundation`
**Mode**: Strict TDD
**Batch**: Foundation + auth hardening + admin/ganaderos/dashboard + UX/integration hardening + verify-alignment corrective batch

## Completed Tasks

- [x] 1.1 RED (BE): Tests REST para `/api/auth/login` con 200/401/403 y roles `ADMIN` / `GANADERO`.
- [x] 1.2 GREEN (BE): Liquibase `002-admin-ganaderos-foundation.yaml` + inclusión en master.
- [x] 1.3 GREEN (BE): Modelo `Role`, `UserStatus`, `User`, `Ganadero`, `OperationLog`.
- [x] 1.4 REFACTOR (BE): Repositorios base para unicidad, admin activo e idempotencia.
- [x] 1.5 GREEN (BE): Bootstrap único y auditable del primer admin.
- [x] 1.6 RED (FE): Specs de formularios controlados para login/bootstrap.
- [x] 2.1 RED (BE): Tests de servicio para política de password y estados de cuenta.
- [x] 2.2 GREEN (BE): `AuthService` + `AuthResource` con `/api/auth/login` y DTOs validados.
- [x] 2.3 GREEN (BE): Errores explícitos mapeados a respuestas HTTP claras.
- [x] 2.4 REFACTOR (BE): JWT endurecido (`sub`, `role`, `userVersion`) y `/api/auth/token` detrás de flag interna.
- [x] 2.5 RED (FE): Specs de `auth.service`, `auth.guard`, `role.guard`.
- [x] 2.6 GREEN (FE): Login FE migrado a `/api/auth/login` con formularios reactivos y mensajes claros.
- [x] 2.7 REFACTOR (FE): Catálogo de errores + `shared/ui/form-errors` mobile-first.
- [x] 3.1 RED (BE): `AdminUsersResourceTest` para alta/listado/baja/cambio de password con `X-Operation-Id` idempotente.
- [x] 3.2 GREEN (BE): `AdminUserService` + `AdminUsersResource` + DTOs con roles permitidos (`ADMIN`,`GANADERO`) y política de password.
- [x] 3.3 RED (BE): `GanaderosResourceTest` para alta, duplicado por identificador de negocio y filtros activo/baja.
- [x] 3.4 GREEN (BE): `GanaderoService` + `GanaderosResource` con persistencia idempotente en `operation_log`.
- [x] 3.5 RED (BE): `AdminDashboardResourceTest` para métricas agregadas y denegación a no-ADMIN.
- [x] 3.6 GREEN (BE): `AdminDashboardResource` + consultas agregadas consistentes por rol/estado.
- [x] 3.7 RED (FE): Specs para rutas `/admin/usuarios`, `/admin/ganaderos`, `/admin/dashboard`, sidebar admin y estados vacíos/error.
- [x] 3.8 GREEN (FE): Features standalone Material para dashboard, usuarios y ganaderos; actualización de `app.routes.ts` y sidebar por rol.
- [x] 4.1 REFACTOR (FE): Formularios admin endurecidos con helper text, password policy explícita, disabled states y feedback accesible.
- [x] 4.2 RED/GREEN: Tests de integración FE para flujo login -> rutas protegidas y bootstrap inicial.
- [x] 4.3 RED/GREEN: Suite integrada BE auth + admins + ganaderos + dashboard + validación de `X-Operation-Id`.
- [x] 4.4 REFACTOR: `design.md` actualizado con política final de password, roles finales y plan de retiro del endpoint legado.
- [x] V.1 RED/GREEN (BE): Hacer explícita y detectable la password policy con regex canónica compartida en `AuthService` y anotaciones `@Pattern`/`@Size` en DTOs de bootstrap y administración.
- [x] V.2 RED/GREEN (FE): Centralizar roles soportados en `core/auth/auth-rules.ts` y exponer mensajes estructurales detectables para login/bootstrap.
- [x] V.3 REFACTOR (Artifacts): Reforzar `design.md` y este `apply-progress.md` con evidencia estructural para rerun de verify.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/{AuthResourceTest,AdminBootstrapResourceTest,AdminUsersResourceTest,GanaderosResourceTest,AdminDashboardResourceTest}.java` | Created/Modified | RED/triangulación de auth, bootstrap, gestión de usuarios, ganaderos y dashboard. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AuthServiceTest.java` | Created | Política de password y estados de cuenta. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/{AuthService,AdminBootstrapService,AdminUserService,GanaderoService,AdminDashboardService}.java` | Created/Modified | Login real, bootstrap inicial, CRUD mínimo admin/ganaderos y métricas. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/{AuthResource,AdminBootstrapResource,AdminUsersResource,GanaderosResource,AdminDashboardResource}.java` | Created/Modified | Endpoints auth/admin con autorización `ADMIN` e idempotencia. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/{UserRepository,GanaderoRepository,OperationLogRepository}.java` | Modified/Created | Queries de unicidad case-insensitive, filtros y lookup idempotente. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/**` | Created | DTOs validados para usuarios, ganaderos, dashboard y respuestas de acción. |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modified | Getter de token + sesión tipada reutilizable por servicios admin. |
| `hato-fe/src/app/features/admin/{dashboard,users,ganaderos}/**` | Created | Pages standalone Material, servicios data-access, formularios reactivos y estados vacíos/error. |
| `hato-fe/src/app/app.auth.integration.spec.ts` | Created | Flujo integrado login -> rutas protegidas y bootstrap inicial con RouterTestingHarness. |
| `hato-fe/src/app/shared/forms/password-policy.ts` | Created | Regla reusable de password policy FE para bootstrap/usuarios. |
| `hato-fe/src/app/features/admin/{bootstrap,users,ganaderos}/**/*.spec.ts` | Modified | RED/triangulación para helper text, password policy y disabled states. |
| `hato-fe/src/app/features/admin/{bootstrap,users,ganaderos}/*.component.ts` | Modified | Helper text, validaciones explícitas, feedback accesible y estados de submit. |
| `hato-fe/src/app/app.routes.ts` | Modified | Nuevas rutas protegidas `/admin/dashboard`, `/admin/usuarios`, `/admin/ganaderos`. |
| `hato-fe/src/app/ui/layout/main-layout/header/header.ts` | Modified | Hardening del route-data para tests/inicialización sin snapshot completo. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/{sidebar.ts,sidebar.spec.ts}` | Modified/Created | Menú admin por rol con accesos a dashboard, usuarios y ganaderos. |
| `.nvmrc` | Created | Fija Node LTS `20.19.6` para reducir drift y evitar non-LTS accidental. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminFoundationIntegrationTest.java` | Created | Suite integrada auth/bootstrap/admin users/ganaderos/dashboard e idempotencia clave. |
| `hato-fe/src/app/ui/layout/main-layout/header/{header.ts,header.html}` | Modified | Alineación con `displayName` de la sesión y cleanup template warnings. |
| `hato-fe/src/app/app.routes.admin.spec.ts` | Created | Cobertura de rutas admin. |
| `openspec/changes/mvp-admin-ganaderos-offline-foundation/{tasks.md,design.md,exploration.md,apply-progress.md}` | Modified | Tareas completadas, decisiones finales de roles/password y tracking del batch. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AdminPasswordPolicyAnnotationsTest.java` | Created | Verifica que DTOs admin expongan `@Size(min = 8)` y `@Pattern` con la regex canónica de password policy. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AuthService.java` | Modified | Password policy endurecida con `PASSWORD_POLICY_REGEX` y `PASSWORD_POLICY_MESSAGE` reutilizables/detectables por verify. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/{bootstrap/AdminBootstrapRequest,users/AdminUserCreateRequest,users/AdminUserPasswordUpdateRequest}.java` | Modified | Validación Bean Validation explícita para password policy final. |
| `hato-fe/src/app/core/auth/{auth-rules.ts,auth-rules.spec.ts}` | Created | Fuente única y test de roles finales (`ADMIN`,`GANADERO`) y `ADMIN_ONLY_ROLES`. |
| `hato-fe/src/app/features/admin/{auth/login-page,bootstrap/bootstrap-page}/*` | Modified | Mensajes estructurados reutilizables para login hardening y bootstrap password policy. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | REST | N/A (new suite) | ✅ Written first, compile-failed until auth foundation existed | ✅ Backend auth command green | ✅ 4 cases (`ADMIN`, `GANADERO`, invalid, blocked) | ✅ Shared auth/error infrastructure extracted |
| 1.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | REST | N/A (new files) | ✅ Tests demanded tables before code | ✅ Backend auth command green after Liquibase 002 | ✅ Login + bootstrap exercised schema | ✅ H2/Liquibase compatibility adjusted |
| 1.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | REST | N/A (new files) | ✅ Missing entities caused RED compile | ✅ Backend auth command green | ✅ Roles/status exercised in multiple scenarios | ✅ Metadata hooks consolidated |
| 1.4 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminBootstrapResourceTest.java` | REST | N/A (new files) | ✅ Repository queries required by RED scenarios | ✅ Backend auth command green | ✅ Active-admin + audit paths verified | ✅ Reusable repository methods extracted |
| 1.5 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminBootstrapResourceTest.java` | REST | N/A (new endpoint) | ✅ Written first | ✅ Backend auth command green | ✅ Success + duplicate bootstrap cases | ✅ Audit logging isolated |
| 1.6 | `hato-fe/src/app/features/admin/auth/login-page/login-page.component.spec.ts`, `hato-fe/src/app/features/admin/bootstrap/bootstrap-page/bootstrap-page.component.spec.ts` | Component | N/A (new specs) | ✅ Written first | ✅ Frontend auth/admin command green | ✅ Empty form + backend error/policy cases | ✅ Shared `form-errors` extracted |
| 2.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/AuthServiceTest.java` | Service | N/A (new suite) | ✅ Written first | ✅ Backend auth command green | ✅ Policy + inactive + blocked + invalid credential cases | ✅ Password policy centralized |
| 2.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | REST | N/A | ✅ Written first | ✅ Backend auth command green | ✅ Username/email login paths | ✅ DTOs and token helper extracted |
| 2.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/service/AuthServiceTest.java` | REST + Service | N/A | ✅ Written first | ✅ Backend auth command green | ✅ Distinct business errors covered | ✅ Exception mapper added |
| 2.4 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AuthResourceTest.java` | REST | N/A | ✅ RED relied on hardened token issuance | ✅ Backend auth command green | ✅ JWT for `ADMIN` + `GANADERO` validated | ✅ Legacy endpoint hidden behind flag |
| 2.5 | `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts`, `hato-fe/src/app/core/auth/guards/{auth.guard.spec.ts,role.guard.spec.ts}` | Service + Guard | N/A | ✅ Written first | ✅ Frontend auth/admin command green | ✅ Success, error, auth, role, status cases | ✅ Storage guards extracted |
| 2.6 | `hato-fe/src/app/features/admin/auth/login-page/login-page.component.spec.ts` | Component | N/A | ✅ Written first | ✅ Frontend auth/admin command green | ✅ Required + invalid credential cases | ✅ Reactive form messages standardized |
| 2.7 | `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts`, `hato-fe/src/app/features/admin/**/**/*.spec.ts` | Service + Component | N/A | ✅ Written first | ✅ Frontend auth/admin command green | ✅ Shared errors reused across auth screens | ✅ Error catalog + reusable feedback component |
| 3.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminUsersResourceTest.java` | REST | ✅ `AuthResourceTest,AuthServiceTest,AdminBootstrapResourceTest` passing | ✅ Written first; endpoints returned 404 before implementation | ✅ Backend admin command green | ✅ Create + replay + deactivate + password reset + forbidden cases | ✅ Idempotent mutation result extracted |
| 3.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminUsersResourceTest.java` | REST | ✅ Existing auth/admin suites green | ✅ Request/response contracts written first | ✅ Backend admin command green | ✅ Allowed roles limited to final enum and password policy reused | ✅ DTOs/common mutation wrapper extracted |
| 3.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/GanaderosResourceTest.java` | REST | ✅ Existing auth/admin suites green | ✅ Written first; endpoints returned 404 before code | ✅ Backend admin command green | ✅ Create + duplicate + filters active/baja | ✅ Business identifier lookup normalized |
| 3.4 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/GanaderosResourceTest.java` | REST | ✅ Existing auth/admin suites green | ✅ Written first | ✅ Backend admin command green | ✅ Idempotent create + status transition paths | ✅ Shared operation-log persistence pattern reused |
| 3.5 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminDashboardResourceTest.java` | REST | ✅ Existing auth/admin suites green | ✅ Written first; 404 before resource existed | ✅ Backend admin command green | ✅ Authorized metrics + forbidden `GANADERO` path | ✅ Summary DTOs extracted |
| 3.6 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminDashboardResourceTest.java` | REST | ✅ Existing auth/admin suites green | ✅ Written first | ✅ Backend admin command green | ✅ Counts by role and status exercised | ✅ Repository count helpers extracted |
| 3.7 | `hato-fe/src/app/{app.routes.admin.spec.ts,ui/layout/main-layout/sidebar/sidebar.spec.ts,features/admin/dashboard/admin-dashboard-page.component.spec.ts,features/admin/users/admin-users-page.component.spec.ts,features/admin/ganaderos/ganaderos-page.component.spec.ts}` | Route + Component | ✅ Auth/login/bootstrap specs passing | ✅ Written first; lazy routes/components missing at RED | ✅ Frontend auth/admin command green | ✅ Routes + admin nav + empty/error + required-field cases | ✅ Feature folders and standalone shells extracted |
| 3.8 | `hato-fe/src/app/features/admin/{dashboard,users,ganaderos}/**/*.spec.ts` | Component | ✅ Existing auth specs green | ✅ Written first | ✅ Frontend auth/admin command green | ✅ Dashboard summaries + users/ganaderos UX states + reset-password form | ✅ Sidebar/admin pages aligned to final session model |
| 4.1 | `hato-fe/src/app/features/admin/{bootstrap,users,ganaderos}/**/*.spec.ts` | Component | ✅ Existing auth/admin specs green | ✅ Written first; UX expectations failed before validators/hints/disabled states existed | ✅ Frontend admin verification command green | ✅ Bootstrap + create/reset password + ganadero form cases | ✅ Shared password-policy helper + accessible feedback states |
| 4.2 | `hato-fe/src/app/app.auth.integration.spec.ts` | Integration | ✅ Auth/login/bootstrap/sidebar specs green | ✅ Written first; router flow and bootstrap integration missing | ✅ Frontend admin verification command green | ✅ Guest redirect + login flow + bootstrap flow | ✅ Header route-data hardening for layout navigation |
| 4.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminFoundationIntegrationTest.java` | REST Integration | ✅ Auth/bootstrap/admin/ganaderos/dashboard suites green | ✅ Written first; integrated flow exposed dashboard assumption and operation-id coverage gaps | ✅ Backend verification command green | ✅ Full flow + invalid/missing operation-id cases | ✅ Scenario aligned to dashboard semantics based on managed users |
| 4.4 | `openspec/changes/mvp-admin-ganaderos-offline-foundation/design.md` | Documentation | N/A (artifact task) | ➖ Structural documentation task | ➖ No runtime tests required | ➖ Triangulation skipped: artifact-only update | ✅ Open questions, roles and rollout updated |
| V.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/{AuthServiceTest,AdminPasswordPolicyAnnotationsTest}.java` | Service + Structural | ✅ `AuthServiceTest` 4/4 passing | ✅ New annotation test referenced missing constants first | ✅ `AuthServiceTest,AdminPasswordPolicyAnnotationsTest` green | ✅ Regex + DTO annotations covered across bootstrap/create/reset password | ✅ Password policy centralizada en constantes reutilizables |
| V.2 | `hato-fe/src/app/core/auth/auth-rules.spec.ts`, `hato-fe/src/app/features/admin/{auth/login-page,bootstrap/bootstrap-page}/*.spec.ts` | Unit + Component | ✅ Login/bootstrap/guard/routes 9/9 passing | ✅ New specs referenced missing auth-rules file and missing component messages first | ✅ Frontend corrective command green | ✅ Roles finales + mensajes estructurados de login/bootstrap cubiertos | ✅ Rutas admin reutilizan `ADMIN_ONLY_ROLES` |
| V.3 | `openspec/changes/mvp-admin-ganaderos-offline-foundation/{design.md,apply-progress.md}` | Documentation | N/A (artifact task) | ➖ Structural documentation task | ➖ No runtime tests required | ➖ Triangulation skipped: artifact-only update | ✅ Evidencia de verify consolidada |

## Test Summary

- **Backend command**: `eval "$(jenv init -)" && jenv shell 21.0.5 && ./mvnw test -Dtest=AuthResourceTest,AdminBootstrapResourceTest,AdminUsersResourceTest,GanaderosResourceTest,AdminDashboardResourceTest,AdminFoundationIntegrationTest`
- **Frontend command**: `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false --include "src/app/core/auth/data-access/auth.service.spec.ts" --include "src/app/core/auth/guards/auth.guard.spec.ts" --include "src/app/core/auth/guards/role.guard.spec.ts" --include "src/app/features/admin/auth/login-page/login-page.component.spec.ts" --include "src/app/features/admin/bootstrap/bootstrap-page/bootstrap-page.component.spec.ts" --include "src/app/features/admin/users/admin-users-page.component.spec.ts" --include "src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts" --include "src/app/features/admin/dashboard/admin-dashboard-page.component.spec.ts" --include "src/app/app.routes.admin.spec.ts" --include "src/app/app.auth.integration.spec.ts" --include "src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts"`
- **Total tests written/executed in verification commands**: 49
- **Total tests passing**: 49
- **Layers used**: Service/Unit (7), Component/Guard/Route (24), Integration FE (2), REST (18)
- **Approval tests**: None — refactors quedaron cubiertos por safety nets e integración.
- **Pure functions created**: 4 (`getStorage`, mapeo de errores auth, evaluación de password policy, `password-policy` shared helper)
- **Corrective backend command**: `eval "$(jenv init -)" && jenv shell 21.0.5 && ./mvnw test -Dtest=AuthServiceTest,AdminPasswordPolicyAnnotationsTest`
- **Corrective frontend command**: `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false --include "src/app/core/auth/auth-rules.spec.ts" --include "src/app/features/admin/bootstrap/bootstrap-page/bootstrap-page.component.spec.ts" --include "src/app/features/admin/auth/login-page/login-page.component.spec.ts" --include "src/app/core/auth/guards/role.guard.spec.ts" --include "src/app/app.routes.admin.spec.ts"`
- **Corrective tests passing**: Backend 5/5, Frontend 13/13

## Deviations from Design

- Ninguna funcional crítica: el diseño quedó actualizado para reflejar los roles finales `ADMIN`/`GANADERO`, la policy de password y el retiro futuro del endpoint legado.
- El dashboard mínimo cuenta usuarios del sistema por rol (`users`) y no el registro de negocio `ganaderos`, que se mantiene como recurso administrativo separado.

## Issues Found

- `UserRepository` tenía consultas case-insensitive incompletas (`count("lower(username)")` / `count("lower(email)")`), lo que podía romper unicidad real; se corrigió durante el batch.
- El header layout todavía leía `currentUser().name`; hubo que alinearlo a `displayName` para que compile con la sesión tipada nueva.
- La navegación integrada descubrió que `header.ts` asumía route snapshots siempre completos; se endureció con fallback defensivo.
- `nvm` resolvía Node `v25.9.0` y Angular advertía non-LTS; se fijó `20.19.6` en `.nvmrc` para eliminar drift.
- El dashboard administrativo resume usuarios gestionados por rol (`GANADERO`) y no el recurso de negocio `ganaderos`; la suite integrada quedó alineada a esa semántica.
- Verify también dependía de evidencia estructural: se agregó regex canónica visible en `AuthService`, anotaciones Bean Validation explícitas en DTOs de password y una fuente única FE para roles finales.

## Remaining Tasks

- Ninguna dentro de este change; queda listo para rerun de `sdd-verify`.

## Status

25/25 tasks complete. Corrective verify-alignment batch applied. Ready for rerun de `sdd-verify`.
