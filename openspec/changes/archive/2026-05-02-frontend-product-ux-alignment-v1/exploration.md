# Exploration: frontend-product-ux-alignment-v1

## Current State

- **FE** (`hato-fe`): Angular 21 standalone, Angular Material, offline-first sync layer already in place
- **BE** (`hato-be`): Quarkus 3, Panache, JWT auth, offline sync already implemented
- **pd-fe reference**: Located at `/Users/arturoherrera/Documents/proyectos/sintesis/dispersor/code/payment-disbursement/pd-fe` — provides DataTableComponent with full filtering, sorting, pagination (client + server), date-range filters, and row selection

## Affected Areas

- `hato-fe/src/app/features/public/ganadero-registration-page/` — empty shell, informational HTML only
- `hato-fe/src/app/features/admin/auth/login-page.component.ts` — returnUrl defaults to `/` (home)
- `hato-fe/src/app/ui/home/home.component.ts` — placeholder with "Inicio / Base visual y técnica..." tech text
- `hato-fe/src/app/features/admin/dashboard/admin-dashboard-page.component.ts` — plain text metrics cards, no charts
- `hato-fe/src/app/features/admin/users/admin-users-page.component.ts` — cards-grid, no table, no modal creation
- `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts` — cards-grid layout
- `hato-fe/src/app/ui/layout/main-layout/header/header.ts` — shows user name + theme toggle, no logout visible in template
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/GanaderosResource.java` — all endpoints `@RolesAllowed("ADMIN")` (no public access)
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/ganadero/GanaderoCreateRequest.java` — only `businessIdentifier` + `name` fields
- `hato-be/src/main/java/bo/pasorapa/hato/domain/Ganadero.java` — entity has no email/contact fields

## Key Findings

### 1. Public Registration is Informational Only

- `ganadero-registration-page.component.ts` is an empty shell
- HTML shows static text "Estamos habilitando el alta online..." with step icons
- No Reactive Form, no API call, no BE endpoint for public (non-auth) ganadero creation

### 2. BE has GanaderoService.create() but requires ADMIN role

- `GanaderosResource` is protected with `@RolesAllowed("ADMIN")`
- A new public-facing endpoint (or relax existing) is needed for self-registration
- Current `GanaderoCreateRequest` lacks email/contact fields needed for a real registration

### 3. Login → Home → Dashboard flow

- After login, `router.navigateByUrl(this.returnUrl())` where `returnUrl` defaults to `/`
- HomeComponent is a placeholder that shows technical scaffold text
- Need to redirect to `/admin/dashboard` after successful login

### 4. Dashboard is Plain Text

- Uses `<p>Total: {{ metrics()!.admins.total }}</p>` style cards
- No charts, no visual aggregation
- User wants graphs

### 5. /admin/usuarios is Card-Grid, Not Table

- Uses `cards-grid` (auto-fit minmax 240px) instead of a proper data table
- No filter header row
- Creation form is inline in the page, not a modal
- No "Crear usuario" button at top
- Actions (view/edit/disable) are button-per-card

### 6. Header has Theme Toggle but Logout is Missing

- `header.ts` template not fully read, but component has `themeService` injected
- Need to verify logout button exists in template

### 7. pd-fe DataTable is the Reference Pattern

- `DataTableComponent` (1045 lines) supports: column config, sort, paginate, filter (text/numeric/date/date-range/multi-select), row actions, selection, client+server mode
- This is the architectural reference for `/admin/usuarios` table upgrade

## Approaches

### 1. Public Ganadero Registration

**Approach A** — New public REST endpoint `POST /api/public/ganaderos` with `businessIdentifier`, `name`, `email`, `contactInfo`. Creates ganadero in PENDING status (not active). No auth required.
- Pros: Clean separation, follows existing BE layering
- Cons: Requires new endpoint + DTO + service method
- Effort: Medium

**Approach B** — Reuse existing `GanaderosResource.create()` but relax `@RolesAllowed` to permit public, add a `PUBLIC` role or IP-based allowlist
- Pros: Reuses existing logic
- Cons: Mixes concerns, security risk if not carefully done
- Effort: Low (but risky)

### 2. Login Post-Auth Redirect

- Change `returnUrl` default from `/` to `/admin/dashboard` in login component
- Effort: Low

### 3. Dashboard Charts

- Integrate a charting library (Chart.js via ng2-charts or similar lightweight wrapper)
- Replace plain metrics cards with bar/doughnut charts for admin/ganadero counts
- Effort: Medium

### 4. /admin/usuarios Table with Filters

- Build or adapt a `DataTableComponent` pattern from pd-fe
- Header filter row with text inputs / select for username, role, status
- "Crear usuario" button opening a modal dialog (MatDialog)
- Table actions: Ver (view details), Edit (edit modal), Deshabilitar (toggle status)
- Effort: High

### 5. Header Improvements

- Add logout button (calls `authService.logout()`)
- Keep display name and theme toggle
- Effort: Low

### 6. Remove Scaffold Text

- Update HomeComponent or redirect to dashboard entirely
- Remove "Inicio / Base visual y técnica para el frontend de Hato" from route data
- Effort: Low

## Recommendation

Prioritize in this order:
1. Login redirect to dashboard (low effort, high impact)
2. Header logout + theme toggle (low effort)
3. Remove scaffold tech text from home (low effort)
4. Public ganadero registration BE endpoint + FE form (medium-high effort) — this is the core new feature
5. /admin/usuarios table upgrade with filters + modal creation (high effort, can reuse DataTable pattern)
6. Dashboard charts (medium effort, visual polish)

## Risks

- New public BE endpoint requires careful security review (spam/abot protection consideration)
- DataTable component adaptation from pd-fe to hato-fe may need significant refactoring for standalone use
- Chart library addition increases bundle size — need to evaluate lightweight option
- Offline-first: public registration should probably be online-only (like user creation) to avoid syncing half-baked registrations

## Questions Open

1. Should public ganadero registration require email verification?
2. Should new registrations be auto-approved or require admin approval?
3. What fields are REQUIRED for registration beyond businessIdentifier + name?
4. Should `/home` route be replaced entirely or just cleaned up?
5. Is there a charting library already in the project, or does one need to be added?
6. Should `/admin/usuarios` table support server-side pagination or is client-side sufficient for expected user count?