# Design: Admin Internal Notifications V1

## Technical Approach

Implementar **notificación canónica backend + distribución incremental por sync + estado leído local-only**. En backend, ADMIN emite notificaciones con targeting V1 (`ALL_ACTIVE_GANADEROS` o `EXPLICIT_LIST` con `excludeUserIds`) y se materializan destinatarios efectivos al momento de creación para asegurar consistencia y orden determinista. En sync, se agrega `SyncEntityType.NOTIFICATION` y `pull` incremental filtrado por usuario autenticado. En frontend, `NOTIFICATION` entra al pipeline offline existente y un store de feature calcula inbox + no leídas, guardando `readAt` por `notificationId` en IndexedDB local (sin cross-device).

## Architecture Decisions

### Decision: Resolución de targeting en escritura

| Option | Tradeoff | Decision |
|---|---|---|
| Resolver destinatarios en cada pull | Menos storage, pero consultas más caras e inconsistencias si cambia padrón | No |
| Materializar destinatarios al crear (`notification_recipients`) | Más filas, pero determinismo, trazabilidad y pull simple | Sí |

**Rationale**: los specs piden targeting con precedencia de exclusión y listados auditables; materializar cumple mejor soporte/operación.

### Decision: Fuente de “GANADERO activo”

| Option | Tradeoff | Decision |
|---|---|---|
| Tabla `ganaderos` | No representa sesión/credencial de usuario final | No |
| Tabla `users` (`role=GANADERO`, `status=ACTIVE`) | Alineado a autenticación y `subject` JWT | Sí |

**Rationale**: el pull filtra por usuario autenticado, por lo que el targeting debe usar IDs de `users`.

### Decision: Estado leído

| Option | Tradeoff | Decision |
|---|---|---|
| ACK/read sincronizado al backend | Consistencia multi-dispositivo, pero agranda scope V1 (push/conflictos) | No |
| `readAt` local en `syncState.meta` | Offline-first, simple, pero drift entre dispositivos | Sí |

**Rationale**: respeta proposal/exploration y patrón previo de estado local derivado (calendar alerts).

## Data Flow

```text
ADMIN UI -> POST /api/admin/notifications
  -> AdminNotificationService.create()
     -> resolveRecipients(users GANADERO activos | explicit)
     -> persist admin_notifications + admin_notification_recipients

GANADERO startup/manual sync
  -> SyncOrchestrator.syncNow()
     -> pull(entityType=NOTIFICATION, cursor)
        -> SyncService.pull(NOTIFICATION)
           -> NotificationRepository.listChangedSinceForRecipient(userId, cursor)
     -> OfflineStore.applyPullResponse('NOTIFICATION', ...)
     -> NotificationInboxStore.rebuild()
        -> unread = snapshots(NOTIFICATION) - localReadMap
        -> Sidebar badge + inbox list
```

### Sequence (startup pull)

```text
AppInitializer -> SyncOrchestrator: initialize()
SyncOrchestrator -> Sync API: GET /sync/pull?entityType=NOTIFICATION
Sync API -> SyncService: pull(NOTIFICATION, cursor)
SyncService -> NotificationRepository: listChangedSinceForRecipient(currentUserId,...)
SyncService --> Sync API: PullSyncResponse(items,nextCursor)
SyncOrchestrator -> OfflineStore: applyPullResponse('NOTIFICATION', items, nextCursor)
SyncOrchestrator -> window: dispatch('notifications:refresh')
NotificationInboxStore -> OfflineStore: listSnapshots('NOTIFICATION') + getNotificationReadState()
NotificationInboxStore --> Sidebar/Page: unread badge + inbox
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/009-admin-notifications-v1.yaml` | Create | Tablas `admin_notifications` y `admin_notification_recipients` + índices (`updated_at,id`, `recipient_user_id,updated_at,id`). |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog `009-*`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AdminNotification.java` | Create | Registro canónico (title/body/targeting/creator/publishedAt/createdAt/updatedAt). |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AdminNotificationRecipient.java` | Create | Destinatario materializado (`notificationId`,`recipientUserId`,`excluded=false`). |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AdminNotificationRepository.java` | Create | Listado admin y pull incremental por destinatario. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminNotificationService.java` | Create | Emisión ADMIN, resolución targeting, DTOs de salida/listado. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AdminNotificationsResource.java` | Create | `POST` emisión + `GET` historial ADMIN (`@RolesAllowed("ADMIN")`). |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Agregar `NOTIFICATION`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Rama `pull` para `NOTIFICATION` filtrada por usuario actual. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Agregar `NOTIFICATION` y contratos `NotificationSnapshot`, `NotificationReadState`. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Subir schema (v5) y migrar `syncState.meta.notifications`. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Helpers `get/setNotificationReadState`, `markNotificationRead`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Emitir `NOTIFICATIONS_REFRESH_EVENT` tras pull exitoso. |
| `hato-fe/src/app/features/admin/notifications/**` | Create | Inbox page + `NotificationInboxStore` (signals) + proyección unread. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` / `.html` | Modify | Nuevo menú “Notificaciones” + badge unread. |
| `hato-fe/src/app/app.routes.ts` | Modify | Ruta `/admin/notificaciones` (`ADMIN` y `GANADERO`). |

## Interfaces / Contracts

```java
public record AdminNotificationCreateRequest(
  @NotBlank String title,
  @NotBlank @Size(max = 2000) String body,
  @NotNull TargetingMode targetingMode,
  List<UUID> includeUserIds,
  List<UUID> excludeUserIds
) {}
```

```ts
export interface NotificationSnapshot {
  id: string;
  title: string;
  body: string;
  createdByUserId: string;
  publishedAt: string;
  updatedAt: string;
}
export interface NotificationReadState { readAtById: Record<string, string>; }
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE Unit | Resolución targeting (`ALL_ACTIVE`, `EXPLICIT`, exclusión final) | Nuevo `AdminNotificationServiceTest` table-driven. |
| BE Integration | `SyncService.pull(NOTIFICATION)` incremental por cursor y usuario | Extender `SyncServiceTest` + `SyncResourceTest`. |
| BE Integration | Seguridad por rol (`POST` solo ADMIN) y listados deterministas | Nuevo `AdminNotificationsResourceTest` con rest-assured. |
| FE Unit | Migración v4->v5 + persistencia local read state | Extender `offline-store.migrations.spec.ts` y `offline-store.service.spec.ts`. |
| FE Unit/Integration | Inbox rebuild post-sync, mark read local, badge sidebar | Nuevos specs en `features/admin/notifications` + `sidebar.spec.ts` + `app.routes.admin.spec.ts`. |

## Migration / Rollout

Liquibase `009` crea estructura en backend. En FE, migración local v5 inicializa estado leído vacío. Rollout por feature completo; rollback: remover ruta/sidebar y excluir `NOTIFICATION` del pull (datos persistidos quedan inertes, no destructivos).

## Open Questions

- [ ] Confirmar límite V1 de recipients por notificación en `EXPLICIT_LIST` (p.ej. 500).
- [ ] Definir retención/archivo para notificaciones antiguas (impacto storage local).
- [ ] Validar copy UX explícito: “leído solo en este dispositivo”.
