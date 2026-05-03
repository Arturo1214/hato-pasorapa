# Specification: Layout & Home

## Requirements

### Requirement: Role-based navigation and redirect

The system MUST implement role-differentiated navigation: ADMIN users see an admin-centric sidebar and are redirected to `/admin/dashboard`; GANADERO users see a ganadero-specific sidebar and are redirected to `/ganadero/dashboard`.

#### Scenario: Admin navigates to root and is redirected

- GIVEN authenticated ADMIN accesses the root path `''`
- WHEN authGuard resolves
- THEN user is redirected to `/admin/dashboard`

#### Scenario: Ganadero navigates to root and is redirected

- GIVEN authenticated GANADERO accesses the root path `''`
- WHEN authGuard resolves
- THEN user is redirected to `/ganadero/dashboard`

#### Scenario: Admin sidebar shows admin-centric items

- GIVEN authenticated ADMIN renders the sidebar
- WHEN menu items render
- THEN items appear in order: Dashboard, Usuarios, Ganaderos, Notificaciones, Reportes

#### Scenario: Ganadero sidebar shows ganadero-centric items

- GIVEN authenticated GANADERO renders the sidebar
- WHEN menu items render
- THEN items appear in order: Dashboard, Animales, Visitas veterinarias, Ganaderos, Calendario, Notificaciones, Sincronización, Backups, Conflictos

#### Scenario: Admin cannot access ganadero-only routes

- GIVEN authenticated ADMIN attempts to navigate to `/ganadero/backups`, `/ganadero/sincronizacion`, or `/ganadero/conflictos`
- WHEN route guard evaluates
- THEN request is rejected with 403

#### Scenario: Ganadero cannot access admin-only routes

- GIVEN authenticated GANADERO attempts to navigate to `/admin/usuarios`, `/admin/ganaderos`, or `/admin/conflictos`
- WHEN route guard evaluates
- THEN request is rejected with 403

### Requirement: Remove scaffold and technical text from home

The system MUST render the home page without displaying technical scaffold text or placeholder content ("Inicio / Base visual y técnica...").

#### Scenario: Home page shows product-relevant content

- GIVEN authenticated user navigates to `/home` (or `/` after login)
- WHEN home page renders
- THEN no technical scaffold text is visible
- AND user is either shown relevant dashboard content or redirected to `/admin/dashboard`

### Requirement: Layout header displays branding, user info, theme, and logout

The system MUST render a header bar containing: application logo/name (branding), authenticated user's display name, theme toggle button, and logout button.

#### Scenario: Header renders with all elements

- GIVEN user is authenticated
- WHEN any page renders
- THEN header contains: branding (app name or logo), user display name, theme toggle, logout button
- AND logout button calls authService.logout() and redirects to `/login`