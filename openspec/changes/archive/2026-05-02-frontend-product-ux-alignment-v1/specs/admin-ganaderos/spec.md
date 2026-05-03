# Delta for admin-ganaderos

## ADDED Requirements

### Requirement: Admin manages ranchers via table

The system MUST provide a `/admin/ganaderos` page for ADMIN role to view, filter, edit, disable, and reset passwords of Ganadero users.

#### Scenario: Admin views ranchers table with filters

- GIVEN authenticated ADMIN is on `/admin/ganaderos`
- WHEN page loads
- THEN a table renders with columns: businessIdentifier, nombre, email, estado
- AND filter inputs in each column header
- AND pagination controls

#### Scenario: Admin filters ranchers by businessIdentifier

- GIVEN table is loaded on `/admin/ganaderos`
- WHEN admin types in businessIdentifier filter
- THEN table rows are filtered to show only matching businessIdentifiers
- AND filter is applied client-side or via API query param

### Requirement: Reset password to temporary value

The system MUST allow ADMIN to reset a Ganadero's password to a temporary value `112345AB`.

#### Scenario: Admin resets ganadero password

- GIVEN admin is viewing a row on `/admin/ganaderos`
- WHEN admin clicks "Reset Password" action
- THEN confirmation dialog appears
- WHEN admin confirms
- THEN user password is set to `112345AB`
- AND success notification is shown

#### Scenario: Reset confirmation prevents accidental action

- GIVEN admin clicked "Reset Password" on a row
- WHEN confirmation dialog appears
- THEN dialog shows the affected ganadero's name/businessIdentifier
- AND requires explicit confirmation before applying