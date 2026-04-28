## Exploration: admin-notifications-v1

### Current State
El sistema ya tiene un backbone offline-first sólido (outbox/inbox/snapshots/checkpoints + pull incremental por `entityType`) y un patrón probado de estado derivado local (`calendarAlerts`) que se inicializa en arranque y se refresca post-sync.

- **Frontend (actual)**
  - `SyncOrchestratorService` ejecuta `syncNow('startup')` al iniciar y luego `pull` para **todos** los `OFFLINE_ENTITY_TYPES`.
  - `OfflineStoreService` persiste snapshots por `entityType/entityId` y estado local adicional en `syncState.meta` (hoy usado por `calendarAlerts`).
  - Ya existe patrón UX de badge/estado en sidebar (`CalendarAlertsStore`), con recálculo al iniciar y al evento `CALENDAR_ALERTS_REFRESH_EVENT`.
  - No existe feature de notificaciones internas admin→ganadero (ni inbox local, ni marcador leído/no leído para ese caso de uso).

- **Backend (actual)**
  - `SyncEntityType` + `SyncService.pull` cubren: `USER`, `GANADERO`, `ANIMAL`, `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_IMAGE`.
  - No existe entidad/tabla/endpoint REST para notificaciones internas entre usuarios.
  - La app ya tiene recursos `@RolesAllowed("ADMIN")` para operación administrativa y recursos compartidos `@RolesAllowed({"ADMIN","GANADERO"})` para sync.

Conclusión: la base para entregar notificaciones V1 ya está, pero falta introducir un nuevo agregado `NOTIFICATION` y su proyección local de lectura/no leída en FE, manteniendo exclusiones V1 (sin push remota, sin integraciones externas, sin estado cross-device de lectura).

### Affected Areas
- `hato-fe/src/app/core/offline/offline-types.ts` — agregar `NOTIFICATION` a `OFFLINE_ENTITY_TYPES` y contratos payload/snapshot para inbox interno.
- `hato-fe/src/app/core/offline/offline-store.migrations.ts` — extender `schemaVersion` y meta local para estado leído/no leído por dispositivo.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — helpers para leer/escribir estado local de lectura en notificaciones.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — incluir `NOTIFICATION` en ciclo pull startup/manual/reconnect por lista de entidades soportadas.
- `hato-fe/src/app/features/admin/notifications/**` (nuevo) — store/proyección/UI para inbox interno visible al iniciar sesión y refrescar.
- `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` (+ template) — badge de no leídas y navegación al inbox.
- `hato-fe/src/app/app.routes.ts` — ruta protegida para pantalla de notificaciones internas.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/` (nuevo `AdminNotification`) — agregado persistente de notificación emitida por admin.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/` (nuevo repo) — pull incremental por `updatedAt + id` y filtros de destinatario.
- `hato-be/src/main/java/bo/pasorapa/hato/service/` + `service/dto/` + `service/mapper/` (nuevo módulo notifications) — emisión admin y payload pull para clientes.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/` (nuevo recurso admin + posible lectura por rol) — contrato para crear notificaciones internas.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — agregar `NOTIFICATION` al canal sync.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — rama `pull` para `NOTIFICATION` y boundary explícito de no-push para ganadero.
- `hato-be/src/main/resources/db/changelog/master.yaml` + nuevo changelog `009-*.yaml` — tabla/indexes de notificaciones internas.
- `hato-fe/src/app/**.spec.ts` y `hato-be/src/test/java/**` — cobertura de contrato startup/refresh + lectura local + seguridad por rol/destinatario.

### Approaches
1. **Notificación como entidad sincronizable + lectura local por dispositivo (recomendado)** — admin crea notificación en backend; ganadero la recibe por `pull` (`NOTIFICATION`) y FE mantiene `readAt` local-only en IndexedDB.
   - Pros: reutiliza canal offline existente; visible en login/startup y refresh sin infraestructura nueva; cumple offline-first y “sin integraciones externas”.
   - Cons: estado leído/no leído no se comparte entre dispositivos (decisión explícita V1); requiere nueva migración FE + BE.
   - Effort: Medium

2. **Notificación 100% local en frontend (sin entidad backend)** — generar mensajes locales por reglas del cliente.
   - Pros: implementación rápida FE-only.
   - Cons: NO cumple requisito “emitidas por admin”, no hay fuente autoritativa ni auditoría, imposible segmentar destinatarios reales.
   - Effort: Low

3. **Sincronizar también el estado leído/no leído al backend en V1** — `NOTIFICATION_READ` como operación de outbox/push.
   - Pros: consistencia cross-device de lectura.
   - Cons: aumenta scope (capability matrix, operaciones nuevas, conflictos de versión) y contradice patrón V1 reciente de estado local por dispositivo.
   - Effort: High

### Recommendation
Recomiendo **Approach 1**.

**V1 IN scope propuesto**
1. Emisión de notificaciones internas por ADMIN (sin canales externos).
2. Distribución a usuarios GANADERO vía `sync/pull` usando nuevo `SyncEntityType.NOTIFICATION`.
3. Inbox local visible en frontend al iniciar sesión (startup) y tras refresco/sync.
4. Estado `leída/no leída` persistido localmente por dispositivo (offline-compatible).
5. Badge de no leídas en navegación + vista listada mínima (titulo, cuerpo breve, emitida en, prioridad opcional).

**V1 OUT of scope (explícito)**
1. Push notifications remotas (FCM/APNs/WebPush), email, SMS, WhatsApp o integraciones de terceros.
2. Confirmación de lectura cross-device o recibos “seen by all devices”.
3. Motor de campañas/segmentación avanzada/reglas automáticas.
4. Adjuntos, rich media o threads conversacionales.

Esta delimitación mantiene continuidad con el enfoque de `calendar-alerts-v1`: datos canónicos sincronizados + estado de interacción local por dispositivo.

### Risks
- **Ambigüedad de destinatario**: hoy no hay vínculo explícito User↔Ganadero en el modelo; hay que definir si V1 envía a “todos los GANADERO activos” o requiere target específico.
- **Crecimiento de snapshots**: sin paginación/retención mínima, el inbox puede inflar almacenamiento local en dispositivos de campo.
- **Drift de estado leído**: al ser local-only, usuarios multi-dispositivo verán diferencias en no leídas (debe comunicarse como decisión de alcance).
- **Scope creep**: pedir confirmación cross-device o push externa durante V1 rompería el objetivo de entrega incremental.
- **Contrato sync sensible**: agregar `NOTIFICATION` impacta FE+BE+tests en cadena; requiere disciplina strict TDD para no romper entidades ya cerradas.

### Ready for Proposal
Yes — el change está suficientemente delimitado para pasar a `sdd-propose` con un objetivo claro: notificación interna admin→ganadero, pull offline-first y lectura/no leída local por dispositivo.
