# Design: Calendar Alerts V1

## Technical Approach

Implementar un módulo **offline/local-first** que derive agenda y alertas desde snapshots ya existentes (`ANIMAL`, `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`) sin crear entidad sincronizada nueva. El cálculo vive en una proyección pura (selectors) y un store de feature basado en signals: al iniciar la app, al finalizar sync y al cambiar preferencias locales, se recalcula la vista por rango (`today`, `7d`, `30d`) y severidad (`upcoming`, `due_today`, `overdue`).

Para evitar costo de recomputar en cada navegación, se persiste un cache derivado local (no sincronizado) junto con preferencias mínimas en estado offline local; ante fallo o datos viejos, la UI cae a recomputación en memoria y muestra estado de “actualizando”.

## Architecture Decisions

### Decision: Persistencia del estado derivado

| Option | Tradeoff | Decision |
|---|---|---|
| Solo memoria (signal) | Simple, pero recalcula siempre y pierde estado al recargar | No |
| `localStorage` ad-hoc | Fácil, pero sin versionado/migración uniforme | No |
| Extender estado offline versionado (`syncState.meta.calendarAlerts`) | Requiere migración local v4, pero mantiene gobernanza y tests existentes | Sí |

**Rationale**: el repo ya centraliza persistencia offline y migraciones; calendar debe seguir el mismo camino.

### Decision: Trigger de refresh de proyecciones

| Option | Tradeoff | Decision |
|---|---|---|
| Polling por intervalo | Costo innecesario y drift temporal | No |
| Rebuild al entrar en pantalla | Puede quedar desactualizada post-sync en otras vistas | No |
| Eventos explícitos: startup + post-sync + cambio de prefs + manual refresh | Más wiring, pero coherente y predecible | Sí |

**Rationale**: minimiza trabajo y asegura consistencia con sync real.

### Decision: Notificaciones de recordatorio

| Option | Tradeoff | Decision |
|---|---|---|
| Push remota/server | Fuera de alcance V1 | No |
| Notification API local best-effort + alertas in-app | No garantizada en background, pero cumple offline-first | Sí |

**Rationale**: respeta OUT de proposal y limita riesgo en navegadores.

## Data Flow

```text
OfflineStore snapshots/outbox
   -> CalendarAlertsProjection (pure selectors)
      -> CalendarAlertsStore (signals + cache derived)
         -> CalendarPage + Sidebar badge + in-app alerts
                      \
                       -> NotificationGateway (permission-gated)

SyncOrchestrator (startup/reconnect/manual)
   -> applyPullResponse
   -> emit "calendar-alerts:refresh"
   -> CalendarAlertsStore.rebuild("post-sync")
```

Refresh policy V1:
1) `startup`: rebuild completo al inicializar layout.
2) `post-sync`: rebuild incremental tras ciclo exitoso de sync.
3) `prefs-change`: rebuild inmediato.
4) `stale-guard`: si cache > 15 min, recomputar al abrir calendario.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Tipos `CalendarAlertPreferences`, `CalendarDerivedAgendaItem`, `CalendarDerivedState` en `syncState.meta`. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Subir schema local a v4 + migración `v3-to-v4-calendar-alerts-derived-state`. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Get/Save de `calendarAlerts` (prefs + cache + `lastComputedAt`) y helpers de invalidación. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Emitir señal de refresh de calendario tras pull exitoso. |
| `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.ts` | Create | Selectors puros: derivación desde snapshots/eventos + clasificación temporal/prioridad. |
| `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.ts` | Create | Store con signals/computed para rango, pendientes, estado de refresh, permisos y silenciamiento. |
| `hato-fe/src/app/features/admin/calendar/data-access/browser-notification.gateway.ts` | Create | Wrapper Notification API (capabilities, permission, cooldown, best-effort dispatch). |
| `hato-fe/src/app/features/admin/calendar/calendar-page.component.ts` | Create | Vista calendario/lista + filtros de rango + acciones de preferencias/silencio local. |
| `hato-fe/src/app/app.routes.ts` | Modify | Ruta `admin/calendario` (roles permitidos). |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Menú “Calendario” + badge de pendientes derivados. |

## Interfaces / Contracts

```ts
export type CalendarAlertStatus = 'upcoming' | 'due_today' | 'overdue';
export type CalendarRange = 'today' | 'next_7_days' | 'next_30_days';

export interface CalendarAlertPreferences {
  horizonDays: 1 | 3 | 7;
  snoozedUntil?: string | null;
  notificationsEnabled: boolean;
}

export interface CalendarDerivedAgendaItem {
  id: string;
  animalUuid: string;
  sourceType: 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT' | 'ANIMAL_EVENT';
  dueAt: string;
  status: CalendarAlertStatus;
  title: string;
  detail?: string;
  priorityScore: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Proyección por source (`nextDueAt`, hitos reproductivos, operativos), clasificación y orden | `calendar-alerts-projection.spec.ts` table-driven con fixtures de snapshots. |
| Unit | Migración v3->v4 y persistencia de prefs/cache | ampliar `offline-store.service.spec.ts` + `offline-store.migrations` tests. |
| Unit | Gate de notificaciones (permiso denegado/default/granted, cooldown) | `browser-notification.gateway.spec.ts` con mocks de `Notification`. |
| Component | Señales UI (badge, estados vacíos, stale/loading, rango) | `calendar-page.component.spec.ts` con store fake. |
| Integration | Rebuild post-sync desde `SyncOrchestrator` + reflect en sidebar | spec de integración FE con `SyncMetricsStore`/evento refresh. |

## Migration / Rollout

Sin migración backend. Rollout FE directo con migración local de schema v4. Si hay rollback: ocultar ruta/sidebar y mantener migración local (backward compatible; `calendarAlerts` ignorado por versiones previas).

## Open Questions

- [ ] Definir regla V1 exacta para hitos reproductivos cuando falta metadata explícita de fecha próxima.
- [ ] Confirmar copy UX sobre límites de notificaciones en iOS/Safari/background suspendido.
- [ ] Decidir si el badge de pendientes se muestra para todos los roles o sólo perfiles operativos.
