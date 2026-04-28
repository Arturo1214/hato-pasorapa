# Proposal: Admin Internal Notifications V1

## Intent

Habilitar notificaciones internas ADMIN→GANADERO visibles en startup/refresh y utilizables offline. Objetivo: cubrir comunicación operativa sin infraestructura externa ni complejidad extra en V1.

## Scope

### In Scope
- Alta de notificaciones internas por ADMIN con persistencia backend y auditoría básica.
- Distribución a GANADERO vía `sync/pull` incremental con nuevo `SyncEntityType.NOTIFICATION`.
- Inbox local en FE visible al iniciar sesión y al refrescar/sincronizar.
- Estado `leída/no leída` local por dispositivo (offline-first), con badge de pendientes.

### Out of Scope
- Push remota (FCM/APNs/WebPush), email/SMS/WhatsApp o integraciones externas.
- ACK/read cross-device o sincronización del estado leído entre dispositivos.
- Targeting complejo por segmentos/campañas/reglas automáticas.
- Analytics avanzadas (funnels, CTR, cohortes, reporting BI).

## Capabilities

### New Capabilities
- `admin-notification-ledger-v1`: emisión ADMIN y almacenamiento canónico de notificaciones internas para destinatarios GANADERO.
- `admin-notification-offline-sync-v1`: pull incremental de `NOTIFICATION` en startup/refresh con contrato offline-first.
- `admin-notification-local-read-state-v1`: proyección local `leída/no leída` por dispositivo con counters/badge consistentes.

### Modified Capabilities
- None.

## Approach

Implementar Approach 1: entidad sincronizable + lectura local-only. Backend agrega agregado/repo/servicio/recurso y soporte en `SyncService.pull`; frontend extiende `OFFLINE_ENTITY_TYPES`, migración de store y UI de inbox/badge. Strict TDD para no romper sync existente.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/.../domain|repository|service|web/rest` | New/Modified | Nuevo módulo de notificaciones internas + endpoint ADMIN |
| `hato-be/.../SyncEntityType.java`, `SyncService.java` | Modified | Canal `NOTIFICATION` en pull incremental |
| `hato-be/src/main/resources/db/changelog/*` | Modified | Tabla e índices de notificaciones |
| `hato-fe/src/app/core/offline/*` | Modified | Tipo offline, migración store y estado local leído/no leído |
| `hato-fe/src/app/features/admin/notifications/**` | New | Inbox local y store de proyección |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/*` | Modified | Badge de no leídas y navegación |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ambigüedad de destinatarios GANADERO | Med | Definir en spec V1: todos activos vs targeting simple explícito |
| Drift de estado leído entre dispositivos | High | Documentar decisión local-only y reflejarla en UX/copy |
| Regresión del pipeline sync | Med | Strict TDD + pruebas de contrato pull por entityType |

## Rollback Plan

Revertir changelog y remover `NOTIFICATION` de `SyncEntityType`/pull. En FE, desactivar inbox/badge y migración de metadatos. Mantener sync legado sin cambios funcionales.

## Dependencies

- `sdd-init/code` (strict TDD + convenciones FE/BE).
- Backbone offline existente (outbox/inbox/snapshots/checkpoints).

## Success Criteria

- [ ] ADMIN puede emitir notificación interna y queda persistida/auditable.
- [ ] GANADERO ve nuevas notificaciones en startup/refresh sin conectividad continua.
- [ ] Marcar `leída/no leída` funciona offline y persiste localmente por dispositivo.
- [ ] No se implementan componentes fuera de scope V1 (push, cross-device ACK, targeting complejo, analytics avanzadas).
