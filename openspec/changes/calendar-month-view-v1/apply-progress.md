# Apply Progress: calendar-month-view-v1

## Current slice

Work Units 1-3 complete. Manual smoke remains pending.

## Completed

### Work Unit 1: Month projection and read-only visual calendar

- Added `calendar-month-view.ts` pure helpers for local date keys, month math, complete month grid, per-day buckets/counts, selected-day items, and visible-month agenda groups.
- Added `calendar-month-view.spec.ts` covering month matrix, selected/today flags, mixed item grouping and local date keys.
- Updated `CalendarAlertsStore` with public `agendaItems` so the visual month can use all actionable items instead of only the current timeline range.
- Reworked `CalendarPageComponent` to expose visible month state, selected date, month view projection, navigation, selected-day detail, source/status labels, and existing reminder actions.
- Replaced timeline-first markup with a monthly grid plus selected-day detail and preserved reminder preferences/in-app alerts.
- Added responsive SCSS for compact mobile day cells and desktop grid/detail layout.

### Work Unit 2: Mobile detail and agenda mode

- Added `mobileViewMode` signal with `month` and `agenda` modes.
- Added mobile view toggle in the calendar card.
- Added agenda-list mode grouped by visible-month day using `agendaGroups()`.
- Added `dayDetailOpen` plus close behavior for responsive selected-day detail.
- Added mobile-focused SCSS: month grid can hide in agenda mode, agenda mode is visible on mobile, and selected-day detail behaves as a sticky bottom panel.
- Extended specs for mobile mode switching, agenda grouped rendering, and day detail close behavior.

### Work Unit 3: Quick schedule vet visit from calendar

- Extended `VetVisitDialogData` with optional `initialVisitDate`.
- `VetVisitFormDialogComponent` now pre-fills scheduled visit date from `initialVisitDate`.
- Added `openScheduleVisitDialog()` in `CalendarPageComponent` to open the existing vet visit dialog using the selected day.
- Reused the existing vet-visit mapper path (`mapVetVisitFormToCreateInput`) to persist `FIELD_VET_VISIT` through `AnimalsHealthEventsService.createEvent()`.
- Rebuilds the calendar agenda after successful create.
- Added focused specs for dialog date prefill and calendar scheduling action.

## Verification

Passed:

```bash
cd hato-fe && npx ng test --include src/app/features/admin/calendar/data-access/calendar-month-view.spec.ts --include src/app/features/admin/calendar/calendar-page.component.spec.ts --include src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts
```

Latest result: 3 spec files passed, 26 tests passed.

Also clean:

```bash
lsp_diagnostics(paths=[calendar-page.component.ts/html/scss/spec.ts, calendar-month-view.ts/spec.ts, calendar-alerts.store.ts, vet-visit-form-dialog.component.ts/spec.ts])
```

## Notes

- During focused test build, Angular surfaced an existing DI compile issue in `CalendarAlertsStore`: constructor parameter `AuthService` was type-only imported. Fixed by using regular `AuthService` import plus `@Optional() @Inject(AuthService)` while keeping manual `new CalendarAlertsStore()` tests valid.
- Manual smoke remains pending: open Docker app, login as `root-admin`, navigate to Calendario, select a day, switch Mes/Agenda, click Agendar visita, verify date prefill.
