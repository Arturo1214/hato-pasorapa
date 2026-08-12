# Exploration: Calendar Month View V1

## Context

The current calendar page is not a visual calendar. It is an operational reminder/timeline page with badges, range buttons (`today`, `next_7_days`, `next_30_days`), local reminder preferences, and two `app-data-table` sections.

Relevant current files:

- `hato-fe/src/app/features/admin/calendar/calendar-page.component.ts`
- `hato-fe/src/app/features/admin/calendar/calendar-page.component.html`
- `hato-fe/src/app/features/admin/calendar/calendar-page.component.scss`
- `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.ts`
- `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.ts`
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts`
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts`
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts`

## Existing behavior

- `CalendarAlertsStore` builds derived agenda state from local offline snapshots:
  - `ANIMAL`
  - `ANIMAL_EVENT`
  - `ANIMAL_HEALTH_EVENT`
  - `ANIMAL_REPRODUCTION_EVENT`
- `projectCalendarAlerts()` creates `CalendarDerivedAgendaItem[]`, windows, and counts.
- `selectCalendarTimeline()` only supports the existing range model.
- Vet visits are represented through `FIELD_VET_VISIT` health events and already participate in local reminders.
- `VetVisitsPageComponent.openNewVisitDialog()` opens `VetVisitFormDialogComponent` and `createVisit()` persists by calling `AnimalsHealthEventsService.createEvent()`.

## Product decisions captured

- Show **all agenda items** with actionable dates in the first visual calendar version, not only vet visits.
- Creating a visit from the calendar should open the existing vet-visit modal and prefill the selected date.
- On mobile, day detail should open in a bottom panel/sheet.
- Mobile should support both compact month view and agenda-list view.

## Constraints

- Must follow `angular-hato`: standalone components, feature-oriented structure, signals for local state, typed RxJS for async flows.
- Must follow `hato-admin-ux`: no duplicate page `h1`, use real data, keep page wrapper thin, reuse existing dialogs/patterns where comparable.
- Strict TDD is active in `openspec/config.yaml`; apply/verify must add/update focused Angular specs before implementation.
- Review budget selected for this SDD session: 600 changed lines.
- Artifact store requested: both OpenSpec and Engram. Engram was unavailable during this phase, so OpenSpec is the authoritative artifact store until memory is reachable again.

## Implementation shape suggested

- Keep current `CalendarAlertsStore` as the agenda source.
- Add pure projection helpers for month grid generation and day bucketing rather than pushing calendar layout logic into the component template.
- Add a focused responsive calendar shell in `CalendarPageComponent`.
- Reuse the existing `VetVisitFormDialogComponent` create flow rather than creating a second scheduling form.
- Prefer a mobile `MatBottomSheet` or equivalent responsive panel for day details; use a side/detail panel or dialog-friendly layout on desktop.
