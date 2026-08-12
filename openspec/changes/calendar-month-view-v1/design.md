# Design: Calendar Month View V1

## Technical Approach

Rediseñar la pantalla de calendario como una composición Angular standalone basada en signals, usando `CalendarAlertsStore` como fuente de verdad y helpers puros para transformar agenda en grilla mensual y lista móvil. La creación de visitas debe reutilizar el formulario existente de visitas veterinarias para evitar dos flujos de negocio.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
| --- | --- | --- | --- |
| Source of truth | Reuse `CalendarAlertsStore.state().items` | Query backend visits directly | La agenda actual ya agrega salud, reproducción, eventos y visitas con lógica local/offline. |
| Month projection | Pure helper module under calendar data-access | Compute in template/component only | Facilita tests, evita templates pesados y mantiene reglas de fecha trazables. |
| Mobile detail | Bottom panel/sheet for selected day | Center modal or inline expanded day | Mobile necesita foco y legibilidad sin romper la grilla mensual compacta. |
| Create visit | Reuse `VetVisitFormDialogComponent` with initial date | New calendar-specific form | Evita duplicar validación, metadata and create workflow. |
| Mobile mode | Toggle month/agenda inside calendar page | Separate route | Mantiene contexto, navegación y estado del mes en una sola pantalla. |

## Data Flow

```text
CalendarAlertsStore.rebuild()
  └─ projectCalendarAlerts() -> CalendarDerivedAgendaItem[]
       └─ buildCalendarMonthView(items, visibleMonth, selectedDate)
            ├─ CalendarMonthDay[] for grid
            ├─ selectedDayItems
            └─ agendaListGroups for mobile agenda mode

User selects day
  └─ selectedDate signal updates
       ├─ desktop detail panel updates
       └─ mobile bottom detail opens

User schedules visit
  └─ open VetVisitFormDialogComponent({ initialVisitDate })
       └─ existing create visit flow persists FIELD_VET_VISIT
            └─ CalendarAlertsStore refresh/rebuild shows new item
```

## File Changes

| File | Action | Description |
| --- | --- | --- |
| `hato-fe/src/app/features/admin/calendar/data-access/calendar-month-view.ts` | Create | Pure date/month helpers, day buckets, agenda groups and local-date key utilities. |
| `hato-fe/src/app/features/admin/calendar/data-access/calendar-month-view.spec.ts` | Create | Tests for month matrix, previous/next month dates, item bucketing and selected-day items. |
| `hato-fe/src/app/features/admin/calendar/calendar-page.component.ts` | Modify | Add visible month state, view mode, selected day, create-visit action, day selection and responsive detail orchestration. |
| `hato-fe/src/app/features/admin/calendar/calendar-page.component.html` | Modify | Replace timeline-first UI with month toolbar, calendar grid, agenda mobile mode, detail panel and preserved reminder controls. |
| `hato-fe/src/app/features/admin/calendar/calendar-page.component.scss` | Modify | Responsive grid, day cell density, badge/dot indicators, mobile controls and bottom panel styling if implemented locally. |
| `hato-fe/src/app/features/admin/calendar/calendar-page.component.spec.ts` | Modify | Cover navigation, day selection, mode toggle, empty state and schedule action. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Possibly modify | Accept optional initial date in `VetVisitDialogData` if current constructor defaults cannot be injected cleanly. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` | Possibly modify | Verify initial date prefill when dialog data includes selected calendar date. |

## Interfaces / Contracts

Suggested local helper types:

```ts
export interface CalendarMonthDay {
  date: string; // YYYY-MM-DD local key
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: CalendarDerivedAgendaItem[];
  counts: {
    total: number;
    upcoming: number;
    dueToday: number;
    overdue: number;
  };
}

export interface CalendarAgendaGroup {
  date: string;
  label: string;
  items: CalendarDerivedAgendaItem[];
}
```

Suggested dialog extension:

```ts
export interface VetVisitDialogData {
  // existing fields...
  initialVisitDate?: string; // YYYY-MM-DD
}
```

## UI Behavior

- Desktop/tablet:
  - Header/toolbar: previous, month label, next, today, create visit.
  - Calendar grid remains visible while selected-day detail appears beside/below it.
  - Existing reminder preferences move to secondary toolbar/card.
- Mobile:
  - Month/Agenda segmented toggle.
  - Month mode uses compact 7-column grid with dots/badges.
  - Agenda mode lists days with items for the visible month.
  - Day tap opens bottom detail panel.

## Testing Strategy

| Layer | What to Test | Approach |
| --- | --- | --- |
| Pure helpers | Month matrix, local date keys, grouping, counts, agenda list groups | `calendar-month-view.spec.ts`. |
| Component | Prev/next/today navigation, selected day detail, mode toggle, create action | Angular/Vitest component specs. |
| Dialog integration | `initialVisitDate` pre-fills date field | Existing vet visit form dialog spec. |
| Regression | Existing reminder controls still call store methods | Extend calendar page spec. |

## Migration / Rollout

Frontend-only rollout. No backend, database, or offline schema migration expected. If implementation exceeds review budget, split into:

1. Month projection helpers + visual read-only calendar.
2. Mobile detail/agenda mode.
3. Quick schedule visit integration.

## Open Questions

- None for proposal/spec. During implementation, verify whether Material `MatBottomSheet` is already available or if a lightweight responsive local panel is preferable to avoid extra module churn.
