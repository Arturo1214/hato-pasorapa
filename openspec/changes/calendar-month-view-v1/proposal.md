# Proposal: Calendar Month View V1

## Intent

Transformar la pantalla de calendario actual de una lista de recordatorios a una experiencia visual mensual tipo calendario, inspirada en macOS Calendar: navegación por mes, grilla de días, indicadores de visitas/agenda, detalle por día y creación rápida de visitas veterinarias desde una fecha seleccionada.

## Scope

### In Scope

- Vista mensual con grilla de días, encabezado del mes y navegación mes anterior/siguiente/hoy.
- Badges/indicadores por día para ítems de agenda existentes.
- Inclusión de todo ítem accionable actual del calendario local: visitas veterinarias, salud, reproducción y eventos generales con fecha.
- Selección de día para ver detalle de ítems programados.
- En mobile, detalle mediante panel inferior y alternativa de vista agenda/lista.
- Creación de visita veterinaria desde el calendario usando el modal existente de visitas, con fecha prellenada.
- Mantener preferencias actuales de recordatorios: horizonte, browser notifications, snooze y refresh manual.
- Tests enfocados para proyección de mes, interacción de día, navegación y apertura de creación de visita.

### Out of Scope

- Drag & drop para mover visitas.
- Edición inline de visitas dentro de una celda del calendario.
- Sincronización nueva de calendario contra backend; se reutiliza la agenda local existente.
- Integración con calendarios externos (Google, Apple Calendar, ICS).
- Crear nuevos tipos de agenda distintos de visita veterinaria desde el calendario.

## Capabilities

### New Capabilities

- `calendar-month-view-v1`: visual monthly calendar with day buckets, month navigation and responsive detail.
- `calendar-vet-visit-quick-schedule-v1`: quick scheduling entry point from selected calendar day.

### Modified Capabilities

- `calendar-local-reminders-v1`: keeps reminder counts/preferences but changes primary presentation from timeline table to visual calendar.
- `field-vet-visit-workflow-v1`: reuses its existing create dialog from an additional calendar entry point.

## Approach

Implementar en frontend solamente para V1:

1. Crear helpers puros de calendario para construir matriz mensual y agrupar `CalendarDerivedAgendaItem` por fecha local.
2. Rediseñar `CalendarPageComponent` para exponer `visibleMonth`, `calendarDays`, `selectedDay`, `selectedDayItems`, `mobileViewMode` y navegación.
3. Reusar `VetVisitFormDialogComponent` para crear visitas con `occurredAt`/fecha seleccionada prellenada.
4. Agregar componente/panel de detalle de día, priorizando bottom-sheet en mobile y layout cómodo en desktop.
5. Mantener los controles actuales de preferencias como toolbar secundaria, no como UI dominante.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `hato-fe/src/app/features/admin/calendar/` | Modified/New | Nueva vista mensual, helpers de proyección y tests. |
| `hato-fe/src/app/features/admin/vet-visits/` | Possibly modified | Permitir abrir el dialog con fecha inicial desde calendario, si el contrato actual no alcanza. |
| `hato-fe/src/app/core/offline/` | Read-only/possibly tests | Se reutilizan snapshots existentes; no schema nuevo previsto. |
| `openspec/specs/calendar-local-reminders-v1/` | Modified conceptually | La capacidad se complementa con vista mensual. |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Alcance visual supera 600 líneas | Medium | Dividir en helpers+calendar shell y luego quick-create/mobile detail. |
| Duplicar lógica de visitas | Medium | Reusar `VetVisitFormDialogComponent` y extracción mínima de create flow si hace falta. |
| Mobile queda ilegible con grilla mensual | Medium | Mostrar badges/puntos en grilla y detalle en bottom panel; ofrecer agenda-list view. |
| Mezclar recordatorios con agenda visual | Low | Mantener `CalendarAlertsStore` como source of truth y helpers puros para layout. |

## Rollback Plan

Revertir los cambios de `hato-fe/src/app/features/admin/calendar/**` y cualquier ajuste mínimo al dialog de visitas. No hay migración de datos ni cambios backend previstos.

## Dependencies

- Angular Material/CDK existente.
- `CalendarAlertsStore` y `CalendarDerivedAgendaItem` existentes.
- `VetVisitFormDialogComponent` existente.

## Success Criteria

- [ ] El usuario puede ver un mes completo con días, mes actual y controles anterior/siguiente/hoy.
- [ ] Los días con agenda muestran indicadores visibles y conteos/resumen.
- [ ] Al seleccionar un día se ve el detalle de visitas/agenda de ese día.
- [ ] En celular existe grilla mensual compacta y vista agenda/lista alternable.
- [ ] Desde un día seleccionado se puede abrir el modal de visita veterinaria con fecha prellenada.
- [ ] Las preferencias actuales de recordatorio siguen accesibles y funcionando.
- [ ] Tests enfocados cubren navegación, agrupación por día, mobile detail y scheduling entry point.
