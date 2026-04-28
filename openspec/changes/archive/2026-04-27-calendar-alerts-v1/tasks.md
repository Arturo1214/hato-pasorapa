# Tasks: Calendar Alerts V1

## Phase 1: Foundation + contrato de storage derivado (Strict TDD)

- [x] 1.1 **RED** Crear tests fallando en `hato-fe/src/app/core/offline/offline-store.migrations.spec.ts` para exigir schema v4 con `syncState.meta.calendarAlerts` (prefs, cache, `lastComputedAt`) y compatibilidad con datos v3.
- [x] 1.2 **GREEN** Modificar `hato-fe/src/app/core/offline/offline-types.ts` y `hato-fe/src/app/core/offline/offline-store.migrations.ts` para introducir `CalendarAlertPreferences`, `CalendarDerivedAgendaItem`, `CalendarDerivedState` y migración `v3->v4`.
- [x] 1.3 **REFACTOR** Ajustar `hato-fe/src/app/core/offline/offline-store.service.spec.ts` y `hato-fe/src/app/core/offline/offline-store.service.ts` con helpers `get/set/invalidate` de `calendarAlerts` sin romper persistencia existente.

## Phase 2: Derivación local y timeline core (Strict TDD)

- [x] 2.1 **RED** Crear `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.spec.ts` (table-driven) para: derivación multi-origen, exclusión por `dueAt` inválido, clasificación `upcoming/due_today/overdue`, orden estable en empates.
- [x] 2.2 **GREEN** Implementar `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.ts` con funciones puras de proyección, filtro por rango (`today/next_7_days/next_30_days`) y prioridad determinística.
- [x] 2.3 **RED** Crear `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts` para rebuild por `startup/post-sync/prefs/manual`, stale-guard 15m, badges por severidad y contador total.
- [x] 2.4 **GREEN** Implementar `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.ts` con signals/computed, cache derivado local y persistencia de preferencias por dispositivo.
- [x] 2.5 **REFACTOR** Extraer utilidades de fecha/prioridad reutilizables para evitar duplicación entre proyección y store.

## Phase 3: Refresh policy + recordatorios locales (Strict TDD)

- [x] 3.1 **RED** Ampliar tests de `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` para exigir evento `calendar-alerts:refresh` sólo después de sync pull exitoso.
- [x] 3.2 **GREEN** Modificar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para emitir trigger post-sync consumible por Calendar Alerts Store.
- [x] 3.3 **RED** Crear `hato-fe/src/app/features/admin/calendar/data-access/browser-notification.gateway.spec.ts` para `permission` (`default/denied/granted`), cooldown y silencio temporal.
- [x] 3.4 **GREEN** Implementar `hato-fe/src/app/features/admin/calendar/data-access/browser-notification.gateway.ts` con degradación obligatoria a alerta in-app (sin push remota ni sync cross-device).

## Phase 4: UI timeline + navegación (Strict TDD)

- [x] 4.1 **RED** Crear `hato-fe/src/app/features/admin/calendar/calendar-page.component.spec.ts` para cambio de rango, timeline filtrada, estados vacío/loading/stale, refresh manual y edición de preferencias (horizonte 1/3/7 + snooze local).
- [x] 4.2 **GREEN** Implementar `hato-fe/src/app/features/admin/calendar/calendar-page.component.ts` (y template/scss asociados) desacoplando UI de la lógica de derivación.
- [x] 4.3 **RED** Agregar tests en `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts` y pruebas de rutas para badge por severidad + visibilidad de entrada `admin/calendario`.
- [x] 4.4 **GREEN** Modificar `hato-fe/src/app/app.routes.ts` y `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` para wiring final de ruta + badge.

## Phase 5: Integración y verificación final

- [x] 5.1 **RED** Crear prueba de integración FE (`hato-fe/src/app/features/admin/calendar/calendar-alerts.integration.spec.ts`) validando rebuild post-sync y actualización de badge/sidebar.
- [x] 5.2 **GREEN** Completar wiring mínimo de inicialización (`startup` rebuild) en layout/bootstrap para cumplir escenarios de recalculo local.
- [x] 5.3 **REFACTOR** Documentar en comentarios del feature/store exclusiones V1 (sin motor experto, sin push remota, sin estado cross-device) y limpiar código temporal.
- [x] 5.4 Ejecutar suite de tests objetivo (`ng test` por specs afectadas) y confirmar cobertura de escenarios de spec antes de `sdd-apply` por lotes.
