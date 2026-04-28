# Tasks: Admin Internal Notifications V1

## Phase 1: Foundation (strict TDD)

- [x] 1.1 RED (BE): crear `hato-be/src/test/java/bo/pasorapa/hato/service/dto/sync/SyncEntityTypeTest.java` validando `NOTIFICATION` en enum/serialización.
- [x] 1.2 GREEN (BE): modificar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` agregando `NOTIFICATION` sin romper tipos existentes.
- [x] 1.3 REFACTOR (BE): actualizar `hato-be/src/main/resources/db/changelog/master.yaml` y crear `.../009-admin-notifications-v1.yaml` con tablas/índices base.
- [x] 1.4 RED (FE): extender `hato-fe/src/app/core/offline/offline-types.spec.ts` con contrato `NOTIFICATION` + tipos `NotificationSnapshot/NotificationReadState`.
- [x] 1.5 GREEN (FE): modificar `hato-fe/src/app/core/offline/offline-types.ts` y `offline-store.migrations.ts` (schema v5 + meta.notifications).
- [x] 1.6 REFACTOR (FE): ajustar helpers comunes en `hato-fe/src/app/core/offline/offline-store.service.ts` para reutilizar lectura/escritura de meta.

## Phase 2: Ledger canónico (backend)

- [x] 2.1 RED: crear `hato-be/src/test/java/bo/pasorapa/hato/service/AdminNotificationServiceTest.java` para creación válida e inválida (auditoría + validación).
- [x] 2.2 GREEN: crear `hato-be/src/main/java/bo/pasorapa/hato/domain/AdminNotification.java` y `.../repository/AdminNotificationRepository.java` con persistencia inmutable y orden newest-first.
- [x] 2.3 GREEN: crear `hato-be/src/main/java/bo/pasorapa/hato/service/AdminNotificationService.java` + DTO request/response para alta canónica.
- [x] 2.4 REFACTOR: extraer mapper/normalización de payload en `AdminNotificationService` para mantener capa service limpia.

## Phase 3: Targeting V1 (backend)

- [x] 3.1 RED: ampliar `AdminNotificationServiceTest` con casos `ALL_ACTIVE_GANADERO`, `EXPLICIT_LIST`, solape include/exclude y precedencia final de exclusión.
- [x] 3.2 GREEN: crear `hato-be/src/main/java/bo/pasorapa/hato/domain/AdminNotificationRecipient.java` y persistencia de destinatarios materializados.
- [x] 3.3 GREEN: implementar resolución de destinatarios por `users(role=GANADERO,status=ACTIVE)` + listas explícitas en `AdminNotificationService`.
- [x] 3.4 REFACTOR: encapsular estrategia de targeting en método/colaborador dedicado para simplificar tests table-driven.

## Phase 4: Pull sync incremental (backend + FE)

- [x] 4.1 RED (BE): extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `.../web/rest/SyncResourceTest.java` con pull `NOTIFICATION` por cursor/usuario.
- [x] 4.2 GREEN (BE): modificar `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` y repo query incremental `updated_at,id` filtrada por recipient.
- [x] 4.3 RED (FE): crear/actualizar `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` verificando evento refresh y merge incremental sin reset total.
- [x] 4.4 GREEN (FE): modificar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para emitir `NOTIFICATIONS_REFRESH_EVENT` tras pull exitoso.
- [x] 4.5 REFACTOR: consolidar utilidades de checkpoint `NOTIFICATION` en `offline-store.service.ts` evitando duplicación con otros entity types.

## Phase 5: Listados y endpoints (admin + inbox)

- [x] 5.1 RED (BE): crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminNotificationsResourceTest.java` para seguridad (`POST/GET` solo ADMIN) y listado determinista.
- [x] 5.2 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AdminNotificationsResource.java` con `POST /api/admin/notifications` y `GET /api/admin/notifications`.
- [x] 5.3 RED (FE): crear `hato-fe/src/app/features/admin/notifications/notification-inbox.store.spec.ts` y `notification-inbox.page.spec.ts` para rebuild startup/refresh.
- [x] 5.4 GREEN (FE): crear `hato-fe/src/app/features/admin/notifications/` (store signals + page inbox) y ruta en `hato-fe/src/app/app.routes.ts`.
- [x] 5.5 REFACTOR (FE): actualizar `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts|html` con menú + badge derivado de unread store.

## Phase 6: Local read-state y hardening final

- [x] 6.1 RED: extender `hato-fe/src/app/core/offline/offline-store.service.spec.ts` y `offline-store.migrations.spec.ts` con mark-read offline, persistencia tras restart y merge A(read)+B(unread).
- [x] 6.2 GREEN: implementar `getNotificationReadState`, `setNotificationReadState`, `markNotificationRead` en `offline-store.service.ts`.
- [x] 6.3 GREEN: conectar `NotificationInboxStore` para calcular unread badge desde snapshots - readMap local-only (sin sync cross-device).
- [x] 6.4 REFACTOR: documentar copy UX “leído solo en este dispositivo” y limpiar duplicación de cálculo unread entre inbox/sidebar.
- [x] 6.5 VERIFY: correr suites objetivo (`hato-be` tests de service/rest/sync y `hato-fe` tests de offline/inbox/sidebar/routes) asegurando GREEN end-to-end del change.
