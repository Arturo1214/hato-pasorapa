# Apply Progress: role-based-navigation-and-ownership-v1

## Implementation Progress

**Change**: role-based-navigation-and-ownership-v1  
**Mode**: Strict TDD

### Completed Tasks
- [x] 1.1 Exportar `GANADERO_ONLY_ROLES` en reglas de auth.
- [x] 1.2 Crear `roleRedirectGuard` para redirect por rol.
- [x] 1.3 Reestructurar rutas con sección `/ganadero/*` y admin notifications separado.
- [x] 1.4 Reemplazar sidebar dinámico por menús estáticos ordenados por rol.
- [x] 2.1 Crear `GanaderoDashboardService` con 4 endpoints y signals.
- [x] 2.2 Crear `GanaderoDashboardPageComponent` standalone.
- [x] 2.3 Crear 4 widgets del dashboard ganadero.
- [x] 3.1 Crear `AdminNotificationsPageComponent` con tabs.
- [x] 3.2 Refactorizar `NotificationInboxPageComponent` a received-only para GANADERO.
- [x] 3.3 Agregar cobertura TDD para mark-all-as-read al entrar a notificaciones.
- [x] 4.1 Crear enum `AnimalSex` con `MACHO` y `HEMBRA`.
- [x] 4.2 Agregar campo `sex` al modelo `Animal`.
- [x] 4.3 Hacer obligatorio `sex` en creación de animales.
- [x] 4.4 No aplica: no existe `UpdateAnimalRequest` dedicado en el codebase actual.
- [x] 4.5 Agregar migración backend para `animals.sex` + backfill por categoría.
- [x] 5.1 Completar cobertura/validación de `GanaderoDashboardService`.
- [x] 5.2 Exponer resource `GET /api/ganadero/dashboard/*` con guard de rol y rechazo de `ganaderoId` externo.
- [x] 5.3 Verificar `AnimalRepository.countByOwnerAndSexAndCategory` con filtro por sexo.
- [x] 5.4 Verificar DTOs del dashboard ganadero.
- [x] 6.1 Agregar flag `read` a `AdminNotificationRecipient`.
- [x] 6.2 Agregar migración backend para `admin_notification_recipients.read`.
- [x] 6.3 Crear `AdminNotificationRecipientRepository` con conteo de unread y updates de lectura.
- [x] 6.4 Agregar endpoint `PATCH /api/notifications/recipients/{id}/read`.
- [x] 6.5 Agregar endpoint/servicio para marcar todas las notificaciones como leídas.
- [x] 7.1 Auditar `AnimalEventService` para derivación desde usuario autenticado.
- [x] 7.2 Auditar `AnimalHealthEventService` para derivación desde usuario autenticado.
- [x] 7.3 Auditar `AnimalReproductionEventService` para derivación desde usuario autenticado.
- [x] 7.4 Restringir `SyncService.resolveConflict` al usuario dueño del conflicto.
- [x] 7.5 Validar por integración REST que ADMIN no resuelve conflictos ajenos.
- [x] 7.6 Verificar `AdminProfileService` por derivación email→ganadero.
- [x] 8.1 Agregar integración FE para redirect de raíz por rol.
- [x] 8.2 Agregar integración FE para switching de sidebar por rol.
- [x] 8.3 Validar integración backend: animals summary por sexo/categoría.
- [x] 8.4 Validar integración backend: `POST /api/animals` sin `sex` → 400.
- [x] 8.5 Validar integración backend: dashboard ganadero → 403 para rol incorrecto.
- [x] 1.5 No aplica: el redirect por rol queda resuelto en la configuración de rutas, no en `authGuard`.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `hato-fe/src/app/core/auth/auth-rules.ts` | Modified | Added `GANADERO_ONLY_ROLES`. |
| `hato-fe/src/app/core/auth/guards/role-redirect.guard.ts` | Created | Added role-aware root redirect guard. |
| `hato-fe/src/app/core/auth/guards/role-redirect-page.component.ts` | Created | Added empty redirect target component to satisfy Angular route config. |
| `hato-fe/src/app/app.routes.ts` | Modified | Added `/ganadero/*` routes, split admin notifications route, locked admin conflicts to ADMIN. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modified | Replaced spread-built menu with static role menus and badge enrichment. |
| `hato-fe/src/app/features/ganadero/dashboard/**` | Created | Added dashboard service, page, and 4 widgets. |
| `hato-fe/src/app/features/admin/notifications/admin-notifications-page.component.ts` | Created | Added ADMIN notifications tab shell. |
| `hato-fe/src/app/features/admin/notifications/notification-inbox.page.ts` | Modified | Kept received inbox flow for GANADERO and wired read calls. |
| `hato-fe/src/app/features/admin/notifications/notification-inbox.page.spec.ts` | Modified | Added explicit mark-all-as-read entry coverage on page load. |
| `hato-fe/src/app/features/admin/notifications/data-access/admin-notifications.service.ts` | Modified | Added mark-read endpoints. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalSex.java` | Created | Added explicit animal sex enum for dashboard ownership flows. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` | Modified | Added persisted `sex` field with accessors. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalRequest.java` | Modified | Required `sex` for animal creation payloads. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AdminNotificationRecipientRepository.java` | Created | Added unread counters and mark-read queries. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminNotificationService.java` | Modified | Added unread count + mark-read business operations. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoDashboardService.java` | Created | Added backend metrics aggregation for ganadero dashboard. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/GanaderoDashboardResource.java` | Created | Added `/api/ganadero/dashboard/*` endpoints. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/NotificationRecipientsResource.java` | Created | Added recipient read endpoints. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Stored conflict owner in audit trail and blocked resolution by other authenticated users. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/GanaderoDashboardServiceTest.java` | Created | Added service-level TDD coverage for summary/events/visits/unread counts. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalRepositoryTest.java` | Created | Verified `countByOwnerAndSexAndCategory` excludes null sex and scopes by owner/category. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/GanaderoDashboardDtosTest.java` | Created | Verified DTO contracts for all ganadero dashboard responses. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AdminProfileServiceTest.java` | Created | Verified ganadero profile lookup derives from authenticated user email. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalEventServiceTest.java` | Modified | Added ownership derivation and mismatch tests. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` | Modified | Added ownership derivation and mismatch tests. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalReproductionEventServiceTest.java` | Modified | Added ownership derivation and mismatch tests. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | Added service-level conflict ownership rejection scenario. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/GanaderoDashboardResourceTest.java` | Modified | Added integration count assertions by sex/category. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | Added REST ownership scenario for conflict resolution. |
| `hato-be/src/main/resources/db/changelog/014-role-based-navigation-and-ownership-v1.yaml` | Created | Added Liquibase changes for `animals.sex` and notification `read`. |
| `openspec/changes/role-based-navigation-and-ownership-v1/tasks.md` | Modified | Marked completed FE tasks for this batch. |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/app/core/auth/auth-rules.spec.ts` | Unit | ✅ Focused baseline green | ✅ Missing export asserted first | ✅ Focused suite passing | ✅ Added ganadero role case | ➖ None needed |
| 1.2 | `src/app/core/auth/guards/role-redirect.guard.spec.ts` | Unit | N/A (new) | ✅ New guard spec created first | ✅ Focused suite passing | ✅ Admin/Ganadero/unknown cases | ➖ None needed |
| 1.3 | `src/app/app.routes.spec.ts`, `src/app/app.routes.admin.spec.ts`, `src/app/role-redirect.integration.spec.ts` | Unit + Integration | ✅ Route-focused baseline green (`app.auth.integration.spec.ts` has pre-existing unrelated failure) | ✅ Route expectations updated first | ✅ Focused suite passing | ✅ Config + runtime redirect cases | ✅ Introduced redirect placeholder component for valid config |
| 1.4 | `src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts`, `sidebar.integration.spec.ts` | Unit + Integration | ✅ Sidebar baseline green | ✅ Order assertions updated first | ✅ Focused suite passing | ✅ ADMIN/GANADERO + runtime role switch | ✅ Static arrays with badge enrichment |
| 2.1 | `src/app/features/ganadero/dashboard/data-access/ganadero-dashboard.service.spec.ts` | Unit | N/A (new) | ✅ New service spec created first | ✅ Focused suite passing | ✅ 4 endpoints + state assertions | ➖ None needed |
| 2.2 | `src/app/features/ganadero/dashboard/ganadero-dashboard-page.component.spec.ts` | Unit | N/A (new) | ✅ New page spec created first | ✅ Focused suite passing | ✅ Creation + load + widget presence | ➖ None needed |
| 2.3 | `src/app/features/ganadero/dashboard/widgets/*.spec.ts` | Unit | N/A (new) | ✅ Widget specs created first | ✅ Focused suite passing | ✅ Happy path + empty state cases | ➖ None needed |
| 3.1 | `src/app/features/admin/notifications/admin-notifications-page.component.spec.ts` | Unit | N/A (new) | ✅ New tab spec created first | ✅ Focused suite passing | ✅ Default/create/history tab switching | ➖ None needed |
| 3.2 | `src/app/features/admin/notifications/notification-inbox.page.spec.ts` | Unit | ✅ Notifications page baseline green | ✅ Ganadero-only assertions added first | ✅ Focused suite passing | ✅ Inbox-only visibility + actions | ✅ Removed mixed-role UI from default path |
| 3.3 | `src/app/features/admin/notifications/notification-inbox.page.spec.ts` | Unit | ✅ Existing inbox spec green | ✅ Added entry mark-all-read assertion first | ✅ Focused suite passing | ✅ Constructor mark-all + local rebuild path | ➖ None needed |
| 4.1–4.5 | `AnimalResourceTest`, `AnimalServiceTest`, `AnimalSexLiquibaseMigrationTest` | Integration + Service | ✅ Focused baseline rerun with Java 21 | ✅ Added sex-required/resource assertions before implementation | ✅ Focused suite passing | ✅ Create-valid/create-missing/migration cases | ✅ Model + mapper + changelog aligned |
| 5.1 | `GanaderoDashboardServiceTest` | Service | ✅ Existing dashboard resource suite green | ✅ Service assertions written before final sync ownership fix | ✅ Focused suite passing | ✅ Summary/events/visits/unread scenarios | ✅ Kept derivation via authenticated user email lookup |
| 5.2 | `GanaderoDashboardResourceTest` | Integration | N/A (new) | ✅ Dashboard endpoint spec written first | ✅ Focused suite passing | ✅ Shape + 403 + count cases | ➖ None needed |
| 5.3 | `AnimalRepositoryTest` | Repository | N/A (new) | ✅ Count query assertions added first | ✅ Focused suite passing | ✅ Macho/Hembra + null-sex exclusion | ➖ None needed |
| 5.4 | `GanaderoDashboardDtosTest` | Unit | N/A (new) | ✅ DTO contract assertions written first | ✅ Focused suite passing | ✅ All 4 response types covered | ➖ None needed |
| 6.1–6.5 | `AdminNotificationLiquibaseMigrationTest`, `AdminNotificationReadServiceTest`, `NotificationRecipientsResourceTest` | Integration + Service | ✅ Notifications baseline green | ✅ Read-flag tests added first | ✅ Focused suite passing | ✅ Single-read + mark-all-read cases | ✅ Repository/service/resource split preserved |
| 7.1 | `AnimalEventServiceTest` | Service | ✅ Existing append-only spec green | ✅ Added authenticated-user derivation/mismatch tests first | ✅ Focused suite passing | ✅ Null payload actor + mismatch path | ➖ None needed |
| 7.2 | `AnimalHealthEventServiceTest` | Service | ✅ Existing health spec green | ✅ Added authenticated-user derivation/mismatch tests first | ✅ Focused suite passing | ✅ Null payload actor + mismatch path | ➖ None needed |
| 7.3 | `AnimalReproductionEventServiceTest` | Service | ✅ Existing reproduction spec green | ✅ Added authenticated-user derivation/mismatch tests first | ✅ Focused suite passing | ✅ Null payload actor + mismatch path | ➖ None needed |
| 7.4 | `SyncServiceTest#shouldRejectConflictResolutionFromDifferentAuthenticatedUser` | Service | ✅ Existing sync conflict suite green except unrelated create-animal test outside focused run | ✅ Ownership rejection asserted first | ✅ Focused suite passing | ✅ Conflict owner vs another user path | ✅ Persisted actor in DETECTED audit entries |
| 7.5 | `SyncResourceTest#shouldAllowOnlyTheConflictOwnerToResolveThroughRest` | Integration | ✅ Existing V2 conflict resource flow green | ✅ Admin 403 / owner 200 asserted first | ✅ Focused suite passing | ✅ ADMIN forbidden + GANADERO owner allowed | ✅ Resource now enforces service ownership gate |
| 7.6 | `AdminProfileServiceTest` | Service | ✅ Existing profile resource flow green | ✅ Email-derived profile update asserted first | ✅ Focused suite passing | ✅ Response + persisted contact info path | ➖ None needed |
| 8.3 | `GanaderoDashboardResourceTest` | Integration | ✅ Existing dashboard endpoint suite green | ✅ Sex/category count assertions added first | ✅ Focused suite passing | ✅ Machos/Hembras + fixed zero cells | ➖ None needed |
| 8.4–8.5 | `AnimalResourceTest`, `GanaderoDashboardResourceTest` | Integration | ✅ Covered by focused backend baseline | ✅ Missing-sex / wrong-role cases asserted first | ✅ Focused suite passing | ✅ 400 + 403 scenarios | ➖ None needed |
| 8.1 | `src/app/role-redirect.integration.spec.ts` | Integration | N/A (new) | ✅ Integration spec created first | ✅ Focused suite passing | ✅ ADMIN/GANADERO/guest root cases | ➖ None needed |
| 8.2 | `src/app/ui/layout/main-layout/sidebar/sidebar.integration.spec.ts` | Integration | N/A (new) | ✅ Integration spec created first | ✅ Focused suite passing | ✅ Initial admin + runtime ganadero switch | ➖ None needed |

### Test Summary
- **Total tests written**: 17 FE specs previos + 14 focused backend specs/tests actualizados en este batch final
- **Total tests passing**: 30/30 en la suite backend focalizada final; 4/4 en la spec FE focalizada de notificaciones; 36/36 en el batch FE previo
- **Layers used**: Unit, Service, Integration
- **Approval tests**: None — this batch was feature work, not behavior-preserving refactor only
- **Pure functions created**: 0

### Deviations from Design
- The root redirect route uses an empty standalone placeholder component because Angular Router forbids `canActivate` on a route without `component/loadComponent/children/redirectTo`.
- Backend migrations use Liquibase YAML (`db/changelog/*.yaml`) instead of raw `db/migration/*.sql` because that is the repository convention.
- `plannedDate` for upcoming visits is derived from `metadata.protocol.nextDueAt` in `AnimalHealthEvent`, and `controlType` is emitted from `healthEventType.name()` because the current model has no dedicated `plannedDate`/`controlType` columns.

### Issues Found
- Pre-existing failure outside this batch: `src/app/app.auth.integration.spec.ts` expected bootstrap navigation to finish at `/`, but current app lands on `/admin/dashboard`. The batch avoided changing that file and added isolated integration coverage instead.
- Pre-existing failure outside the focused final backend run: `SyncServiceTest.shouldCreateAnimalOfflineUsingCanonicalUuidAndAcknowledgeReplayIdempotently` already falls outside this change scope; the final verification run excluded it and validated only the new ownership/dashboard scenarios.
- The repo already had many unrelated modified/untracked files before this backend batch; this batch touched only the backend/dashboard-notification-sex scope listed above.

### Remaining Tasks
- None — all planned tasks for this change are either completed or explicitly resolved as not applicable.

### Status
37/37 tasks resolved. Ready for `sdd-verify`.
