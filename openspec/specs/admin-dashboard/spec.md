# Specification: Admin Dashboard

## Requirements

### Requirement: Dashboard charts for metrics

The system MUST display at least two visual charts (bar or doughnut) on the `/admin/dashboard` page for admin and ganadero totals.

#### Scenario: Dashboard shows admin count chart

- GIVEN authenticated user is on `/admin/dashboard`
- WHEN dashboard loads
- THEN a bar or doughnut chart renders showing total ADMIN count vs total GANADERO count

#### Scenario: Dashboard shows ganadero distribution chart

- GIVEN authenticated user is on `/admin/dashboard`
- WHEN dashboard loads
- THEN a second chart displays ganadero distribution by status (active/inactive) or region

### Requirement: Chart data refreshes on load

The system MUST fetch metrics data from the backend API when the dashboard page initializes.

#### Scenario: Dashboard loads fresh data

- GIVEN user navigates to `/admin/dashboard`
- WHEN page initializes
- THEN HTTP GET `/api/admin/metrics` (or similar) is called
- AND charts render with returned data