# calendar-month-view-v1 Specification

## Purpose

Definir una experiencia visual mensual y responsiva para la agenda operativa, permitiendo ver días del mes, detectar días con visitas o alertas, revisar detalle y agendar una visita veterinaria desde una fecha seleccionada.

## Requirements

### Requirement: Monthly calendar navigation

The system MUST display a monthly calendar grid with local-week day headers, current visible month label, previous-month navigation, next-month navigation, and a today shortcut.

#### Scenario: Navigate to next month

- GIVEN the user is viewing March 2026
- WHEN the user activates next-month navigation
- THEN the calendar shows April 2026
- AND day buckets are recalculated for April 2026

#### Scenario: Return to today

- GIVEN the user is viewing a month different from the current local month
- WHEN the user activates the today shortcut
- THEN the calendar returns to the current local month
- AND selects or highlights today's date

### Requirement: Agenda item indicators by day

The system MUST group all actionable agenda items from the current calendar projection by local date and display a visible indicator on each day with items.

#### Scenario: Day with vet visit

- GIVEN a FIELD_VET_VISIT agenda item due on 2026-06-10
- WHEN the user views June 2026
- THEN day 10 shows an agenda indicator
- AND the day detail includes the vet visit item

#### Scenario: Day with mixed agenda items

- GIVEN one health item, one reproduction item, and one general animal event item on the same local date
- WHEN the user views that month
- THEN the day shows a combined indicator/count
- AND the detail lists all three items with distinguishable labels/statuses

### Requirement: Day detail

The system MUST allow selecting a day and viewing all agenda items for that day without losing month context.

#### Scenario: Desktop day selection

- GIVEN a day has multiple agenda items
- WHEN the user selects that day on desktop/tablet width
- THEN the page shows the selected date detail with all items
- AND keeps the monthly grid visible

#### Scenario: Mobile day selection

- GIVEN the user is on mobile width
- WHEN the user taps a day with items
- THEN the detail opens in a bottom panel/sheet or equivalent mobile panel
- AND the user can close the panel and remain in the same month

### Requirement: Responsive month and agenda modes

The system MUST support both compact month view and agenda-list view on mobile.

#### Scenario: Compact month mode on mobile

- GIVEN the viewport is mobile-sized
- WHEN the user selects month mode
- THEN the calendar keeps a 7-column compact month grid
- AND day cells show compact badges/dots rather than full table content

#### Scenario: Agenda mode on mobile

- GIVEN the viewport is mobile-sized
- WHEN the user selects agenda mode
- THEN the page shows a chronological list grouped by day for the visible month
- AND the user can still navigate previous/next month

### Requirement: Quick schedule vet visit from selected date

The system MUST allow opening the existing vet-visit creation modal from the calendar and prefill the selected date.

#### Scenario: Create visit from selected day

- GIVEN the user selects 2026-06-15 in the calendar
- WHEN the user activates schedule-visit action
- THEN the existing vet-visit form dialog opens
- AND its visit date defaults to 2026-06-15

#### Scenario: Create visit without selected day

- GIVEN no explicit day is selected
- WHEN the user activates schedule-visit action
- THEN the dialog opens with today's date or the current default used by the existing visit workflow

### Requirement: Preserve reminder controls

The system MUST preserve existing calendar reminder preferences and manual refresh controls.

#### Scenario: Existing preferences remain available

- GIVEN the user opens the redesigned calendar page
- THEN horizon selection, browser-notification toggle, snooze, clear snooze, and manual refresh remain accessible
- AND existing badge totals for upcoming, due today, overdue, and total still reflect the current projection
