# Delta for role-based-navigation-and-ownership-v1

## ADDED Requirements

### Requirement: Ganadero dedicated dashboard

The system MUST expose a route `/ganadero/dashboard` accessible ONLY to role GANADERO, displaying a summary of the ganadero's own operations (animal count, pending visits, upcoming calendar events).

#### Scenario: Ganadero navigates to dashboard

- GIVEN authenticated GANADERO navigates to `/ganadero/dashboard`
- WHEN page loads
- THEN ganadero sees own animal count, pending visits count, and next 5 calendar events
- AND route redirects to 403 for ADMIN

#### Scenario: Admin cannot access ganadero dashboard

- GIVEN authenticated ADMIN navigates to `/ganadero/dashboard`
- WHEN guard evaluates roles
- THEN route is blocked with 403

### Requirement: Role-aware redirect on empty path

The system MUST redirect authenticated users from `''` (root) to the appropriate dashboard based on their role: ADMIN → `/admin/dashboard`, GANADERO → `/ganadero/dashboard`.

#### Scenario: Admin redirect from empty path

- GIVEN authenticated ADMIN accesses `''`
- WHEN authGuard resolves
- THEN redirect goes to `/admin/dashboard`

#### Scenario: Ganadero redirect from empty path

- GIVEN authenticated GANADERO accesses `''`
- WHEN authGuard resolves
- THEN redirect goes to `/ganadero/dashboard`

### Requirement: Ganadero-only backups route

The system MUST expose `/ganadero/backups` visible ONLY to GANADERO role; ADMIN MUST NOT have access to this route.

#### Scenario: Ganadero accesses backups

- GIVEN authenticated GANADERO navigates to `/ganadero/backups`
- WHEN page loads
- THEN ganadero sees local backup/export/import UI

#### Scenario: Admin blocked from backups

- GIVEN authenticated ADMIN navigates to `/ganadero/backups`
- WHEN guard evaluates
- THEN 403 is returned

### Requirement: Ganadero-only sync route

The system MUST expose `/ganadero/sincronizacion` visible ONLY to GANADERO role.

#### Scenario: Ganadero accesses sync

- GIVEN authenticated GANADERO navigates to `/ganadero/sincronizacion`
- WHEN page loads
- THEN sync status and controls are shown

#### Scenario: Admin blocked from sync

- GIVEN authenticated ADMIN navigates to `/ganadero/sincronizacion`
- WHEN guard evaluates
- THEN 403 is returned

### Requirement: Ganadero-only conflicts route

The system MUST expose `/ganadero/conflictos` scoped to the authenticated GANADERO's own operations; ADMIN MUST NOT have access.

#### Scenario: Ganadero accesses conflicts

- GIVEN authenticated GANADERO navigates to `/ganadero/conflictos`
- WHEN page loads
- THEN only conflicts belonging to this ganadero are shown

#### Scenario: Admin blocked from conflicts

- GIVEN authenticated ADMIN navigates to `/ganadero/conflictos`
- WHEN guard evaluates
- THEN 403 is returned

### Requirement: Role-ordered sidebar

The system MUST render sidebar menu items in explicit role-defined order. ADMIN order: Dashboard, Usuarios, Ganaderos, Notificaciones, Reportes. GANADERO order: Dashboard, Animales, Visitas veterinarias, Ganaderos, Calendario, Notificaciones, Sincronización, Backups, Conflictos.

#### Scenario: Admin sidebar order

- GIVEN authenticated ADMIN renders sidebar
- WHEN menu renders
- THEN items appear in order: Dashboard, Usuarios, Ganaderos, Notificaciones, Reportes

#### Scenario: Ganadero sidebar order

- GIVEN authenticated GANADERO renders sidebar
- WHEN menu renders
- THEN items appear in order: Dashboard, Animales, Visitas veterinarias, Ganaderos, Calendario, Notificaciones, Sincronización, Backups, Conflictos

### Requirement: Role-differentiated notification pages

The system MUST display ADMIN notifications page with tabs: Administración, Creación, Historial. GANADERO notifications page MUST show only Received tab.

#### Scenario: Admin notification page with tabs

- GIVEN authenticated ADMIN opens Notificaciones
- WHEN page renders
- THEN three tabs are visible: Administración, Creación, Historial

#### Scenario: Ganadero notification page received-only

- GIVEN authenticated GANADERO opens Notificaciones
- WHEN page renders
- THEN only Received tab is shown (no Administración/Creación/Historial tabs)

## MODIFIED Requirements

### Requirement: Internal notification canonical record

**(Unchanged from admin-notification-ledger-v1)** — The system MUST persist each ADMIN notification as an immutable canonical record with unique ID, title/body, creator identity, timestamps, and publish status.

#### Scenario: Admin creates a publishable notification

- GIVEN an authenticated ADMIN with valid content
- WHEN the ADMIN submits a new internal notification
- THEN the system stores a canonical notification record with audit fields
- AND the notification becomes eligible for recipient distribution

#### Scenario: Invalid notification payload is rejected

- GIVEN an authenticated ADMIN with missing required fields
- WHEN the ADMIN submits the notification
- THEN the system rejects the request with validation errors

### Requirement: Targeting V1 with explicit includes and excludes

**(Unchanged from admin-notification-ledger-v1)** — The system MUST support V1 targeting modes for GANADERO recipients: `ALL_ACTIVE_GANADEROS` and `EXPLICIT_LIST`, and MUST support explicit exclusion IDs where exclusion precedence is final.

#### Scenario: Broadcast to all active GANADERO except excluded IDs

- GIVEN a notification targeted to `ALL_ACTIVE_GANADEROS` with exclusion list [U2]
- WHEN recipient targeting is resolved
- THEN all active GANADERO except U2 are selected

#### Scenario: Explicit list with overlapping include/exclude

- GIVEN a notification with explicit include list [U1, U2, U3] and exclusion list [U2]
- WHEN recipient targeting is resolved
- THEN U1 and U3 remain recipients
- AND U2 is not a recipient

### Requirement: Sender and recipient listing contract

**(Unchanged from admin-notification-ledger-v1)** — The system SHALL provide list views for ADMIN issuance history and recipient-resolved notifications with deterministic ordering for verification and support operations.

#### Scenario: Admin lists recently issued notifications

- GIVEN multiple canonical notifications exist
- WHEN ADMIN requests the issuance list
- THEN notifications are returned in deterministic newest-first order
- AND each item includes targeting summary and audit metadata

## REMOVED Requirements

### Requirement: Export Payload Contract and Explicit Exclusions — ADMIN trigger

(Reason: Backup export trigger changes from ADMIN to GANADERO-only; ADMIN no longer triggers exports)

### Requirement: Strong Import Validation Before Mutation

(Reason: Scope unchanged but trigger is now GANADERO only; requirement remains valid but restricted to GANADERO context)

### Requirement: Transactional Restore and Ordered Rehydration

(Reason: Scope unchanged but trigger is now GANADERO only; requirement remains valid but restricted to GANADERO context)

### Requirement: Image Integrity Handling

(Reason: Scope unchanged but trigger is now GANADERO only; requirement remains valid but restricted to GANADERO context)

### Requirement: Visual conflict diff and manual workflow

(Reason: Conflicts route is now GANADERO-only; ADMIN must not access conflict resolution workflow; visual diff and manual resolution remain for GANADERO users scoped to own operations only)