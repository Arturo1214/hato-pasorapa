# Delta for admin-exportable-reports-v1

## ADDED Requirements

### Requirement: Admin report catalog with three MVP reports

The system SHALL provide a report catalog at `/admin/reportes` containing exactly three ADMIN-only reports: Inventario por Ganadero, Actividad Sanitaria, and Alcance de Notificaciones. Each report MUST be selectable via tabs or dropdown and SHALL render a filtered DataTable with an Excel export button. The system MUST NOT display sync/refresh controls.

#### Scenario: Admin sees report catalog with three reports

- GIVEN an authenticated ADMIN navigates to `/admin/reportes`
- WHEN the page loads
- THEN three report options are displayed: Inventario por Ganadero, Actividad Sanitaria, Alcance de Notificaciones
- AND no sync or manual refresh controls are visible

#### Scenario: Admin selects a report and sees its DataTable

- GIVEN an authenticated ADMIN has opened the report catalog
- WHEN the ADMIN selects "Inventario por Ganadero"
- THEN the system fetches `/api/admin/reports/inventory-by-ganadero`
- AND renders a DataTable with rows and column headers

#### Scenario: Loading state while fetching report data

- GIVEN an authenticated ADMIN selects a report
- WHEN the API request is in flight
- THEN a loading indicator is displayed
- AND the DataTable shows empty state with skeleton or spinner

#### Scenario: Error state when API request fails

- GIVEN an authenticated ADMIN selects a report
- WHEN the API returns an error (5xx or network failure)
- THEN an error message is displayed
- AND the export button is disabled

#### Scenario: Empty state when report returns no data

- GIVEN an authenticated ADMIN selects a report
- WHEN the API returns an empty array
- THEN the DataTable shows "No hay datos para los filtros seleccionados"

### Requirement: Client-side Excel export with Spanish headers and date-stamped filename

The system SHALL export the current DataTable dataset to XLSX using a client-side library. The exported file MUST use Spanish column headers and the filename MUST be date-stamped in format `Reporte_{Nombre}_{YYYYMMDD}.xlsx`.

#### Scenario: Export generates XLSX with Spanish headers

- GIVEN an authenticated ADMIN has loaded a report with data visible
- WHEN the ADMIN clicks "Exportar Excel"
- THEN the browser downloads a file named `Reporte_InventarioPorGanadero_20260510.xlsx`
- AND column headers in the sheet use Spanish labels

#### Scenario: Export uses currently filtered dataset

- GIVEN an authenticated ADMIN has applied filters to a report
- WHEN the ADMIN clicks "Exportar Excel"
- THEN the exported XLSX contains only the currently filtered rows
- AND the filename reflects the selected report name

### Requirement: Report filters per report type

The system SHALL support filters specific to each report: date range for Actividad Sanitaria, ganadero selector for Inventario, and date range for Alcance.

#### Scenario: Filter by date range on Actividad Sanitaria

- GIVEN an authenticated ADMIN has selected "Actividad Sanitaria"
- WHEN the ADMIN sets a date range filter and applies it
- THEN the DataTable updates to show only events within that range
- AND the export reflects the filtered dataset

#### Scenario: Filter by ganadero on Inventario

- GIVEN an authenticated ADMIN has selected "Inventario por Ganadero"
- WHEN the ADMIN selects a specific ganadero from a dropdown
- THEN the DataTable shows only inventory for that ganadero

### Requirement: ADMIN-only access; GANADERO forbidden

The system MUST reject any request to `/api/admin/reports/*` with 403 if the authenticated user lacks the ADMIN role. The FE report catalog MUST redirect GANADERO users to an unauthorized page or show empty state.

#### Scenario: GANADERO receives 403 on report endpoint

- GIVEN an authenticated GANADERO (non-ADMIN) calls `GET /api/admin/reports/inventory-by-ganadero`
- WHEN the request is evaluated
- THEN the system returns HTTP 403
- AND the response body contains an error message

#### Scenario: GANADERO accessing FE report page sees unauthorized

- GIVEN an authenticated GANADERO (non-ADMIN) navigates to `/admin/reportes`
- WHEN the route guard evaluates the role
- THEN the user is redirected to an unauthorized page or shown a "No tienes acceso" message
- AND no report data is fetched