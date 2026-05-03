# Specification: Admin Users

## Requirements

### Requirement: Admin users table with filters and pagination

The system MUST provide a `/admin/usuarios` page accessible only to ADMIN role, displaying a paginated data table with filter controls in column headers.

#### Scenario: Admin views users table with filters

- GIVEN authenticated user has ADMIN role
- WHEN user navigates to `/admin/usuarios`
- THEN a table renders with columns: Username, Email, Rol, Estado
- AND each column header contains a filter input
- AND pagination controls are visible

#### Scenario: Non-admin cannot access users page

- GIVEN authenticated user has GANADERO role (or no role)
- WHEN user navigates to `/admin/usuarios`
- THEN access is denied with HTTP 403 or redirect to error page

### Requirement: Create admin via modal

The system MUST allow ADMIN to create new users via a modal dialog with Reactive Form validation.

#### Scenario: Admin creates user via modal

- GIVEN authenticated user has ADMIN role on `/admin/usuarios`
- WHEN user clicks "Crear usuario" button
- THEN a modal opens with fields: username, email, password, rol (select)
- WHEN user fills valid data and submits
- THEN user is created with specified role and modal closes
- AND table refreshes to show new user

#### Scenario: Create form validation

- GIVEN modal is open with empty or invalid fields
- WHEN user submits
- THEN inline validation errors display under each invalid field
- AND form is not submitted

### Requirement: View, edit, and disable user actions

The system MUST provide per-row actions: Ver (view details), Edit (open edit modal), Deshabilitar (toggle enabled/disabled).

#### Scenario: Admin disables a user

- GIVEN user is on `/admin/usuarios` viewing an enabled user
- WHEN admin clicks "Deshabilitar" action on that row
- THEN user's `enabled` status toggles to false
- AND table refreshes to reflect new state

#### Scenario: Admin edits a user

- GIVEN user is on `/admin/usuarios`
- WHEN admin clicks "Editar" action on a row
- THEN edit modal opens pre-filled with user's current data
- WHEN admin modifies data and submits
- THEN user record is updated and modal closes