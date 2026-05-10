# Proposal: Notification Recipient Workflow V1

## Intent

Separar el flujo ADMIN→GANADERO: ADMIN crea/envía y revisa métricas; GANADERO recibe una bandeja personal, marca leído y ve campana con pendientes. Hoy la UI mezcla inbox local/admin y el BE ya modela destinatarios con `read`, pero falta exponer inbox GANADERO y desglose de entrega.

## Scope

### In Scope
- BE: endpoints GANADERO para inbox, unread count y mark-read usando `AdminNotificationRecipient`.
- BE: endpoint ADMIN de métricas por notificación: total, leídas, pendientes.
- FE: separar pantallas admin de bandeja ganadero; ADMIN ve historial/métricas, no inbox local.
- FE: campana GANADERO en header con unread count y navegación a inbox.
- Tests de recursos REST y specs FE afectadas.

### Out of Scope
- Push/WebPush/email/SMS/WhatsApp.
- Cross-device realtime; el estado leído será persistido en servidor y refrescado por endpoints/sync normal.
- Segmentación avanzada, plantillas, campañas o analytics BI.

## Capabilities

### New Capabilities
- `ganadero-notification-inbox-v1`: bandeja personal GANADERO, mark-read y contador unread basado en destinatarios.
- `admin-notification-delivery-metrics-v1`: métricas operativas ADMIN por notificación emitida.

### Modified Capabilities
- `admin-notification-ledger-v1`: incluir resumen de entrega/read-status en contratos ADMIN.
- `admin-notification-local-read-state-v1`: reemplazar read local-only por read persistido para GANADERO; eliminar concepto de inbox ADMIN.
- `layout-home`: agregar campana GANADERO en header sin contaminar navegación ADMIN.

## Approach

Mantener `AdminNotification` como ledger canónico y usar `AdminNotificationRecipient(read, updated_at)` como estado por usuario. Crear endpoints role-scoped: ADMIN para emisión/métricas; GANADERO para inbox/read/unread. En FE, remover dual-mode admin inbox y modelar stores separados: admin notifications table + ganadero inbox/bell.

## Migration/Data Considerations

- No nueva tabla requerida si `AdminNotificationRecipient.read` y `updated_at` cubren read/readAt.
- Si hay estado local previo, tratarlo como legado de dispositivo; no migrarlo automáticamente al servidor.
- Asegurar índices por `recipient_user_id`, `read`, `notification_id`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/.../web/rest` | Modified | Endpoints role-scoped inbox, mark-read, metrics |
| `hato-be/.../service|repository` | Modified | Queries por destinatario y agregados read/pending |
| `hato-fe/src/app/features/admin/notifications/**` | Modified | Historial + tabla de métricas, sin inbox local |
| `hato-fe/src/app/features/ganadero/**` | New/Modified | Inbox personal y mark-read |
| `hato-fe/src/app/ui/layout/**` | Modified | Campana GANADERO con unread count |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper comportamiento offline local previo | Med | Specs explicitan legado y pruebas de merge/refresh |
| Fuga de métricas/inbox entre roles | Med | Guards REST por rol + tests 403 |
| Conteo unread inconsistente | Med | Una fuente: `AdminNotificationRecipient.read` |

## Rollback Plan

Revertir endpoints y UI nuevos, mantener emisión ADMIN existente. Si hubo cambios de índices, dejarlos si son compatibles o revertir changelog específico. Restaurar vista anterior de notificaciones sin campana.

## Dependencies

- `sdd-init/code`; specs existentes `admin-notification-*` y `layout-home`.

## Success Criteria

- [ ] GANADERO lista sus notificaciones, marca leído y ve campana con unread correcto.
- [ ] ADMIN ve total/read/pending por notificación sin inbox propio.
- [ ] REST impide acceso cruzado ADMIN/GANADERO.
- [ ] Tests actualizados en FE/BE para los contratos modificados.
