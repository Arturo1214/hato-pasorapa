# Tasks: MVP Admin + Ganaderos Offline Foundation

## Phase 1: Foundation (schema, contracts, strict-TDD harness)

- [x] 1.1 RED (BE): Crear tests REST para `/api/auth/login` (200/401/403) en `hato-be/src/test/java/**/web/rest/AuthResourceTest.java`, validando roles `ADMIN` y `GANADERO`.
- [x] 1.2 GREEN (BE): Crear `hato-be/src/main/resources/db/changelog/002-admin-ganaderos-foundation.yaml` e incluirlo en `db/changelog/master.yaml` con tablas `users`, `ganaderos`, `operation_log`, UUID PK, `version`, `updated_at`, `last_synced_at`.
- [x] 1.3 GREEN (BE): Crear `domain/Role.java` (`ADMIN`,`GANADERO`), `UserStatus.java`, `User.java`, `Ganadero.java`, `OperationLog.java`.
- [x] 1.4 REFACTOR (BE): Crear `UserRepository`, `GanaderoRepository`, `OperationLogRepository` con queries de unicidad, admin activo e idempotencia por `operationId`.
- [x] 1.5 GREEN (BE): Implementar seed/bootstrap único en `AdminBootstrapService` + `AdminBootstrapResource` (solo cuando no hay admin activo, con auditoría).
- [x] 1.6 RED (FE): Crear specs de formularios controlados (login/bootstrap) en `hato-fe/src/app/features/admin/**/**/*.spec.ts` para requeridos y mensajes claros.

## Phase 2: Auth hardening capability (strict TDD)

- [x] 2.1 RED (BE): Escribir tests de servicio para política de password (mín 8, 1 mayúscula, 1 número), credenciales inválidas y cuentas no activas/bloqueadas.
- [x] 2.2 GREEN (BE): Implementar `AuthService` + `AuthResource` (`POST /api/auth/login`) y DTOs con Bean Validation en `service/dto/admin/**`, sin aceptar rol desde request.
- [x] 2.3 GREEN (BE): Mapear errores explícitos (`INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `ACCOUNT_BLOCKED`, `PASSWORD_POLICY_VIOLATION`) con respuestas HTTP claras.
- [x] 2.4 REFACTOR (BE): Endurecer JWT (claims `sub`,`role`,`userVersion`) y dejar `/api/auth/token` deprecado detrás de flag interna.
- [x] 2.5 RED (FE): Agregar specs de `core/auth/data-access/auth.service.ts`, `auth.guard.ts`, `role.guard.ts` para sesión, autorización por rol/estado y mensajes de error.
- [x] 2.6 GREEN (FE): Migrar FE a `/api/auth/login` con Reactive Forms controlados, validaciones explícitas y textos claros de error.
- [x] 2.7 REFACTOR (FE): Extraer catálogo de errores y componente Material de feedback (`hato-fe/src/app/shared/ui/form-errors/*`) mobile-first.

## Phase 3: Functional implementation (admins, ganaderos, dashboard)

- [x] 3.1 RED (BE): Crear tests REST de admins (`AdminUsersResourceTest`) para alta/listado/baja/cambio de password con `X-Operation-Id` idempotente.
- [x] 3.2 GREEN (BE): Implementar `AdminUserService` + `AdminUsersResource` + DTOs, enforcing roles permitidos (`ADMIN`,`GANADERO`) y política de password.
- [x] 3.3 RED (BE): Crear tests REST de ganaderos (`GanaderosResourceTest`) para alta, duplicado por identificador de negocio, filtros activo/baja.
- [x] 3.4 GREEN (BE): Implementar `GanaderoService` + `GanaderosResource` y persistencia idempotente en `operation_log`.
- [x] 3.5 RED (BE): Crear test REST de dashboard (`AdminDashboardResourceTest`) para métricas agregadas y denegación a no-ADMIN.
- [x] 3.6 GREEN (BE): Implementar `AdminDashboardResource` + consultas agregadas consistentes por estado/tipo.
- [x] 3.7 RED (FE): Crear specs para rutas `/admin/usuarios`, `/admin/ganaderos`, `/admin/dashboard`, guardas y estados vacíos/error.
- [x] 3.8 GREEN (FE): Implementar features standalone Material en `hato-fe/src/app/features/admin/**`, actualizar `app.routes.ts` y sidebar por rol.

## Phase 4: UX hardening, regression and release safety

- [x] 4.1 REFACTOR (FE): Aplicar Material-first UX en formularios (labels claros, required explícito, helper text, submit deshabilitado y accesibilidad).
- [x] 4.2 RED/GREEN: Crear tests de integración FE para flujo login -> rutas protegidas y bootstrap inicial; ejecutar `ng test`.
- [x] 4.3 RED/GREEN: Completar suite integración BE para auth+admins+ganaderos+dashboard e idempotencia; ejecutar `./mvnw test`.
- [x] 4.4 REFACTOR: Actualizar `openspec/changes/mvp-admin-ganaderos-offline-foundation/design.md` resolviendo open questions (password policy y roles finales) y plan de retiro de endpoint legado.
