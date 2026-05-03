# Delta for layout-home

## ADDED Requirements

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