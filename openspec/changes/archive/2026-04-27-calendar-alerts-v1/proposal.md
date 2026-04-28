# Proposal: Calendar Alerts V1

## Intent
Entregar un cronograma operativo con recordatorios offline/local-first usando snapshots/eventos ya sincronizados, para que el equipo gestione vencimientos sanitarios, reproductivos y operativos sin depender de conectividad ni de nuevas entidades backend en V1.

## Scope

### In Scope
- Vista calendario/lista por rango (hoy, 7 días, 30 días) derivada localmente.
- Derivación de agenda desde `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_EVENT` y contexto `ANIMAL`.
- Estados locales `upcoming`, `due_today`, `overdue` con priorización in-app.
- Recordatorios locales best-effort (permiso navegador) y contador de pendientes.
- Preferencias locales mínimas (horizonte 1/3/7 días y silenciamiento temporal local).

### Out of Scope
- Notificaciones push nativas/remotas (Firebase/APNs/WebPush server-side).
- Reglas clínicas/reproductivas avanzadas o motor experto.
- Estado compartido cross-device (read/snooze sincronizado entre dispositivos).

## Capabilities

### New Capabilities
- `calendar-offline-schedule-v1`: cronograma local derivado de snapshots/eventos existentes por ventana temporal.
- `calendar-local-reminders-v1`: clasificación temporal y alertas locales/in-app con preferencias locales mínimas.

### Modified Capabilities
- None

## Approach
Aplicar proyección local incremental: al cargar snapshots o finalizar sync, recalcular agenda y severidad temporal en FE, sin cambiar contratos BE ni agregar `entityType` nuevo. Mantener reglas V1 simples y explícitas para minimizar riesgo y habilitar evolución a modelo sincronizado en V2.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/app.routes.ts` | Modified | Ruta del módulo de calendario/alertas |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modified | Acceso de navegación |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Lectura/proyección de snapshots para agenda |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Recalcular agenda post-sync |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Tipos para preferencias/estado local de alertas |
| `hato-fe/src/app/features/admin/calendar/` | New | Feature UI calendario/recordatorios |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Notificación local no confiable en background | High | UX prioriza alertas in-app y comunicación explícita de límites |
| Datos incompletos (`nextDueAt`/metadata) | Med | Validaciones, fallback por reglas simples, métricas de calidad |
| Scope creep por reglas de negocio complejas | High | Contrato V1 acotado y backlog V2 separado |

## Rollback Plan
Deshabilitar ruta/feature de calendario, remover cálculo de alertas en FE y volver al flujo actual de consulta de eventos por animal, sin tocar sync/backend.

## Dependencies
- Snapshots offline existentes y ciclo de sync operativo (`offline-sync-foundation-v1`).
- Contratos sanitarios/reproductivos actuales con metadata de fechas próximas cuando aplique.

## Success Criteria
- [ ] La agenda V1 funciona offline con datos locales sin endpoints nuevos.
- [ ] Se muestran y priorizan `upcoming`, `due_today`, `overdue` para los próximos vencimientos.
- [ ] Usuario puede ajustar horizonte de aviso y silenciamiento local.
- [ ] No se agrega entidad backend sincronizada para alertas en V1.
- [ ] OUT respetado: sin push nativa, sin reglas clínicas avanzadas, sin estado cross-device.
