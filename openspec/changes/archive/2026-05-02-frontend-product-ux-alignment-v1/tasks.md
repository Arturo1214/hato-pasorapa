# Tasks: frontend-product-ux-alignment-v1

## Phase 1: BE — Anti-Spam Foundation + Public Registration

- [x] 1.1 Add Caffeine dependency to `hato-be/pom.xml`
- [x] 1.2 Create `RateLimitCache.java` in `hato-be/.../repository/` — Caffeine cache, TTL 15min, max 3/IP
- [x] 1.3 Create `AntiSpamValidator.java` in `hato-be/.../service/validator/` — honeypot null-check, timing >= 3s, rate-limit call
- [x] 1.4 Add `email` and `contactInfo` fields to `Ganadero.java` entity
- [x] 1.5 Create `GanaderoPublicCreateRequest.java` DTO with businessIdentifier, name, email, password, website, formIssuedAt
- [x] 1.6 Create `GanaderoPublicResponse.java` DTO with accessToken, tokenType, expiresInSeconds, PublicUserDto
- [x] 1.7 Create `PublicGanaderoService.java` — creates Ganadero + Usuario(GANADERO), username=email, anti-spam validate
- [x] 1.8 Create `PublicGanaderosResource.java` — `POST /api/public/ganaderos` (public), returns JWT + 201/400/409/429
- [x] 1.9 TDD: Write `AntiSpamValidatorTest` — reject filled honeypot, reject timing < 3s, reject rate limit exceeded
- [x] 1.10 TDD: Write `PublicGanaderoServiceTest` — duplicate email/CI reject, atomic creation, username=email set

## Phase 2: BE — Auth CI-Fallback + Admin Endpoints

- [x] 2.1 Resolve as not applicable: CI fallback already lives in `AuthService` + `GanaderoRepository.findByBusinessIdentifier()`; forcing `businessIdentifier` lookup into `UserRepository` would duplicate data ownership outside `Ganadero`
- [x] 2.2 Modify `AuthService.login()` — if identifier not in User, check Ganadero.businessIdentifier → resolve email → re-auth
- [x] 2.3 TDD: Write `AuthServiceTest` — login with email, login with CI (ganadero), invalid identifier generic error
- [x] 2.4 Create admin endpoints for `/admin/ganaderos` (list, update, disable, reset-password to `112345AB`)
- [x] 2.5 TDD: Write `GanaderosAdminResourceTest` — list filter, reset password, disable toggle
- [x] 2.6 Create admin endpoints for `/admin/usuarios` (list, create, update, disable) — ADMIN only
- [x] 2.7 TDD: Write `UsersAdminResourceTest` — create user, validation errors, non-admin 403

## Phase 3: FE — Shell, Layout, Auth, Registration

- [x] 3.1 Add `ng2-charts` and `chart.js` to `hato-fe/package.json`
- [x] 3.2 Modify `app.routes.ts` — add `/perfil` route; change redirect `/` → `/admin/dashboard`
- [x] 3.3 Expose `logout()` public in `auth.service.ts`; clear JWT + redirect to `/login`
- [x] 3.4 Build `header.component.ts` — branding, user display name, theme toggle, logout button
- [x] 3.5 Build `sidebar.component.ts` — branding, role-based nav items
- [x] 3.6 Build `ganadero-registration-page.component.ts` — Reactive Form: businessIdentifier, name, email, password, confirmPassword + honeypot website + formIssuedAt timing
- [x] 3.7 On registration success: store JWT, navigate `/admin/dashboard`; on anti-spam failure: generic error
- [x] 3.8 TDD: Write `ganadero-registration-page.spec.ts` — form validation, honeypot field, submit with anti-spam payload
- [x] 3.9 TDD: Write `auth.service.spec.ts` — login email, login CI, logout clears session

## Phase 4: FE — Profile, Dashboard Charts, Admin Tables

- [x] 4.1 Create `profile-page.component.ts` — Reactive Form: telefono, direccion + currentPassword, newPassword, confirmPassword
- [x] 4.2 Create `profile.service.ts` — `PUT /api/admin/profile` (data), `PUT /api/admin/profile/password` (password change)
- [x] 4.3 TDD: Write `profile-page.spec.ts` — complete data, change password (wrong currentPassword shows error)
- [x] 4.4 Build lazy `charts-lazy.component.ts` using ng2-charts — bar/doughnut for admin vs ganadero counts + distribution
- [x] 4.5 Add lazy route `loadComponent` for charts in `admin-dashboard-page.component.ts` — fetch `/api/admin/metrics`
- [x] 4.6 TDD: Write `charts-lazy.spec.ts` — renders bar chart, fetches metrics data
- [x] 4.7 Build `data-table.component.ts` in `ui/shared/` — Inputs: columns config, data; Outputs: page/sort/filter events; uses MatTableDataSource + MatPaginator
- [x] 4.8 Build `admin-users-page.component.ts` — DataTable + filters + modal create/edit (MatDialog); actions: Ver, Editar, Deshabilitar
- [x] 4.9 Build `admin-ganaderos-page.component.ts` — DataTable + filters + reset-password action (confirmation dialog)
- [x] 4.10 TDD: Write `data-table.spec.ts` — filter event, sort event, page event
- [x] 4.11 TDD: Write `admin-users-page.spec.ts` — table renders, filter by role, open create modal, disable user
- [x] 4.12 TDD: Write `admin-ganaderos-page.spec.ts` — table renders, reset password confirmation, disable toggle

## Phase 5: FE — Cleanup

- [x] 5.1 Clean `home.component.ts` — remove scaffold text; redirect authenticated to `/admin/dashboard`
- [x] 5.2 Remove `ganadero-registration-page.component.html` and `.scss` (inline template/styles)
- [x] 5.3 Verify all routes are lazy-loaded where applicable (charts module only)

## Phase 6: Integration + E2E (Playwright setup pending)

- [x] 6.1 BE integration: `POST /api/public/ganaderos` — 201 + JWT body, honeypot reject 400, timing reject 400, rate limit 429
- [x] 6.2 BE integration: `POST /api/auth/login` — email login, CI login (ganadero), invalid identifier generic error
- [x] 6.3 BE integration: admin `/admin/ganaderos` reset password → `112345AB` temp
- [x] 6.4 Defer for V1 / not applicable in this batch: Playwright/e2e target is not configured in `hato-fe` (`angular.json` only defines `build`, `serve`, `test`), so coverage stays with existing unit/integration specs for registration submit, auth session persistence, and dashboard rendering
