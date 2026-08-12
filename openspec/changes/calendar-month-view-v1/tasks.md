# Tasks: calendar-month-view-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-700 |
| Selected review budget | 600 lines |
| Budget risk | Medium |
| Chained PRs recommended | Maybe |
| Suggested split | 2 work units if implementation trends over 600 lines |
| Delivery strategy | auto-forecast |

Decision needed before apply: No, unless implementation forecast exceeds 600 changed lines after task breakdown.

## Work Unit 1: Month projection and read-only visual calendar

- [x] 1.1 Create `hato-fe/src/app/features/admin/calendar/data-access/calendar-month-view.ts` with pure helpers for visible month grid, local date keys, day buckets, selected-day items and mobile agenda groups.
- [x] 1.2 Add `hato-fe/src/app/features/admin/calendar/data-access/calendar-month-view.spec.ts` covering month matrix, current/adjacent month days, today/selected flags and mixed agenda item grouping.
- [x] 1.3 Update `CalendarPageComponent` state with `visibleMonth`, `selectedDate`, `calendarDays`, `selectedDayItems`, and navigation methods: previous, next, today. (`mobileViewMode` remains for Work Unit 2.)
- [x] 1.4 Replace timeline-first calendar page markup with a visual monthly grid while preserving badge totals and reminder preference controls.
- [x] 1.5 Add responsive SCSS for desktop grid, compact mobile grid, indicators/counts and selected-day styling.
- [x] 1.6 Update `calendar-page.component.spec.ts` for month navigation, day selection, empty month/day states and preserved reminder controls.

## Work Unit 2: Mobile detail and agenda mode

- [x] 2.1 Add mobile month/agenda view toggle to `CalendarPageComponent`.
- [x] 2.2 Implement agenda-list mode grouped by visible-month day using the pure helper output.
- [x] 2.3 Implement selected-day mobile detail as bottom panel/sheet or equivalent responsive panel.
- [x] 2.4 Add tests for mobile mode switching, day detail opening/closing and agenda grouped rendering.

## Work Unit 3: Quick schedule vet visit from calendar

- [x] 3.1 Extend `VetVisitDialogData` to accept optional `initialVisitDate` if needed.
- [x] 3.2 Ensure `VetVisitFormDialogComponent` pre-fills the visit date when `initialVisitDate` is provided.
- [x] 3.3 Add calendar action to open the existing vet visit dialog for the selected date.
- [x] 3.4 Reuse the existing create flow from vet visits without duplicating business validation.
- [x] 3.5 Refresh/rebuild calendar agenda after successful create so the scheduled visit appears in the selected month/day.
- [x] 3.6 Add focused specs for initial date prefill and calendar scheduling action.

## Verification

- [x] 4.1 Run targeted helper spec: `cd hato-fe && npx ng test --include src/app/features/admin/calendar/data-access/calendar-month-view.spec.ts --include src/app/features/admin/calendar/calendar-page.component.spec.ts`.
- [x] 4.2 Run targeted calendar component spec.
- [x] 4.3 Run vet visit form dialog spec if `VetVisitDialogData` changes.
- [ ] 4.4 Manual smoke: open `http://localhost:8080`, login as `root-admin`, navigate to Calendario, switch month/agenda, select a day, open schedule visit, verify date prefill.

## Notes

- Strict TDD is active in `openspec/config.yaml`; implementation must add/adjust tests before code changes where feasible.
- If Work Unit 1 alone approaches 600 changed lines, stop before Work Unit 2 and split delivery.
