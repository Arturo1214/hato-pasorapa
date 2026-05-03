# Exploration: role-based-navigation-and-ownership-v1

## Current State

### 1. Routes (`hato-fe/src/app/app.routes.ts`)

All routes live under `MainLayout` with `authGuard`. Role guards use `ALLOWED_ROLES` (ADMIN + GANADERO) for most routes, `ADMIN_ONLY_ROLES` for admin-only routes.

**Problem**: ALL routes are prefixed `/admin/...` regardless of role. The current guard system blocks access but doesn't redirect to role-appropriate default routes.

| Route | Guard | Current Access |
|-------|-------|----------------|
| `/admin/dashboard` | ALLOWED_ROLES | ADMIN + GANADERO (SAME dashboard) |
| `/admin/reportes` | ADMIN_ONLY_ROLES | ADMIN only ✓ |
| `/admin/backups` | ADMIN_ONLY_ROLES | ADMIN only ✓ |
| `/admin/usuarios` | ADMIN_ONLY_ROLES | ADMIN only ✓ |
| `/admin/ganaderos` | ADMIN_ONLY_ROLES | ADMIN only ✓ |
| `/admin/conflictos` | ALLOWED_ROLES | ADMIN + GANADERO |
| `/admin/sync-observability` | ALLOWED_ROLES | ADMIN + GANADERO |
| `/admin/animales` | ALLOWED_ROLES | ADMIN + GANADERO |
| `/admin/visitas-veterinarias` | ALLOWED_ROLES | ADMIN + GANADERO |
| `/admin/calendario` | ALLOWED_ROLES | ADMIN + GANADERO |
| `/admin/notificaciones` | ALLOWED_ROLES | ADMIN + GANADERO |

**Gap**: No dedicated GANADERO dashboard exists. Both roles land on the same `/admin/dashboard` (admin dashboard component).

### 2. Sidebar (`hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts`)

The sidebar dynamically computes `menuItems` based on `authService.currentUser()?.role`. ADMIN sees more items (Reportes, Backups, Usuarios, Ganaderos). The order is NOT explicitly defined by role ordering rules — it just renders the array in whatever order the computed signal produces.

**Gap**: No explicit role-based ordering. The confirmed order from producto rules is NOT enforced in code.

### 3. Ownership in BE — Current State

The BE already derives GANADERO from the authenticated user in several places:

- **`AdminProfileService`** (`hato-be/src/main/java/.../service/AdminProfileService.java`): `findGanaderoForProfile(User user)` derives ganadero by `user.getEmail()` — NO `ganaderoId` parameter needed. ✓
- **`GanaderoService`** (`hato-be/src/main/java/.../service/GanaderoService.java`): Methods like `updateStatus`, `update`, `resetPassword` take `UUID ganaderoId` as parameter. These are admin-only endpoints (GanaderosResource has `@RolesAllowed("ADMIN")`).
- **`SyncService`** (`hato-be/src/main/java/.../service/SyncService.java`): `currentUserId()` is derived from JWT. Sync push/pull operations use `currentUserId` for audit. Conflict resolution uses `currentUserId` to scope resolution ownership.
- **`AnimalEventService`** (`hato-be/src/main/java/.../service/AnimalEventService.java`): `create(AnimalEventRequest request, UUID authenticatedUserId)` — derives actor from auth context, not request payload. ✓

**FE services** (`animals-events.service.ts`, `animals-health-events.service.ts`, `animals-reproduction-events.service.ts`): All send `performedByUserId: currentUser.id` from `authService.currentUser()`.

### 4. Backups and Conflicts

- **Backups**: Route at `/admin/backups` with `ADMIN_ONLY_ROLES` guard. Component: `backup-page.component.ts`. According to producto rules, backups are GANADERO-only. Currently exposed to ADMIN only (coincidentally correct but not by design).
- **Conflicts**: Route at `/admin/conflictos` with `ALLOWED_ROLES` guard. This means ADMIN can see conflicts. According to producto rules, conflicts are GANADERO-only (scoped to their own operations).

### 5. Offline Sync — Ownership

`SyncResource` (`/api/sync/push`, `/api/sync/pull`, `/api/sync/conflicts/.../resolve`) uses `@RolesAllowed({"ADMIN", "GANADERO"})`. Both roles can push/pull. Conflict resolution (`resolveConflict`) is scoped by `currentUserId()` derived from JWT.

**Good**: No `ganaderoId` passed from FE. BE derives from auth.

### 6. Auth Service (`hato-fe/src/app/core/auth/data-access/auth.service.ts`)

- `currentUser` signal holds the authenticated user with role.
- `isAuthenticated()`, `getOfflineSessionStatus()` for guard checks.
- No `ganaderoId` stored in session — the BE relationship User→Ganadero is via email.

---

## Affected Areas

| File | Issue |
|------|-------|
| `hato-fe/src/app/app.routes.ts` | All routes prefixed `/admin/` — need role-based default redirect (GANADERO → different dashboard). No explicit role route ordering. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Computed menu items; order not explicitly controlled by role. ADMIN sees Conflicts+Sync+Animales+Visitas which should be GANADERO-only. |
| `hato-fe/src/app/app.routes.ts` — `/admin/conflictos` | Guard uses `ALLOWED_ROLES` — ADMIN can access conflicts. Should be GANADERO-only. |
| `hato-fe/src/app/features/admin/backup/backup-page.component.ts` | Exposed to ADMIN via `ADMIN_ONLY_ROLES`. Should be GANADERO-only. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminProfileService.java` | Already correctly derives ganadero from user email. No changes needed. ✓ |
| `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoService.java` | `updateStatus`, `update`, `resetPassword` take `ganaderoId` param — admin-only endpoints, OK. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Already uses `currentUserId()` from JWT. No `ganaderoId` required. ✓ |

---

## Approaches

### Approach 1: Minimal Role-Based Navigation (V1 targeted)

**Scope**: Only enforce the confirmed producto rules without restructuring architecture.

1. **Create dedicated GANADERO dashboard** at `/ganadero/dashboard` (separate from admin dashboard).
2. **Restrict routes**:
   - `/admin/conflictos` → `ADMIN_ONLY_ROLES` (was `ALLOWED_ROLES`)
   - `/admin/backups` → Remove from admin entirely, already GANADERO-only by config
3. **Sidebar ordering**: Explicitly sort menu items by role using a sorted array instead of computed spread.
4. **Ownership**: Keep current BE behavior — already derives from JWT where needed.

**Effort**: Low-Medium. New dashboard component + route guard fixes + sidebar sort.

### Approach 2: Full Scope Rule Enforcement with Layout Segmentation

Create separate layouts for ADMIN vs GANADERO with distinct route prefixes and sidebar sets.符合 scope-rule-architect-angular principles.

1. `AdminLayout` with `/admin/*` routes + admin sidebar.
2. `GanaderoLayout` with `/ganadero/*` routes + ganantero sidebar.
3. Root redirect `'' → role-appropriate dashboard based on `authGuard` redirect logic.
4. Ownership: all GANADERO operations derive from JWT (already in place).

**Effort**: High. New layout components, route restructure, sidebar per layout.

---

## Recommendation

**Approach 1 for V1** — Minimum viable change to satisfy producto rules:

1. Add GANADERO-specific dashboard component (new `ganadero-dashboard-page.component`)
2. Fix route guard for `/admin/conflictos` → `ADMIN_ONLY_ROLES`
3. Fix route guard for `/admin/backups` → remove (backups are offline-only, route doesn't make sense for admin)
4. Enforce sidebar item ordering by role
5. Verify BE ownership derivation for all GANADERO operations (no `ganaderoId` in request/URL)

The BE is already mostly correct — the gap is primarily FE routing + sidebar visibility + guard corrections.

---

## Risks

1. **Sidebar computed signal mutation** — if menu item order depends on role computed, changing sort order mid-session could cause UX glitch. Need to ensure stable ordering.
2. **Dashboard redirect logic** — current `redirectTo: 'admin/dashboard'` needs role-aware redirect. If guard redirects to `/login` on failure, the default redirect could still send wrong role to admin dashboard.
3. **Sync conflict visibility for ADMIN** — ADMIN currently CAN see conflicts UI (via ALLOWED_ROLES). If we restrict to GANADERO-only, admin might lose visibility into sync health. Need to confirm if observability is separate from resolution.
4. **GANADERO Dashboard scope** — the new dashboard needs to show different data than admin dashboard. Need to define what "operaciones ganadero" means for the new dashboard vs existing admin dashboard.

---

## Ready for Proposal

**Yes** — Key findings are clear:

1. Routes need role-specific default redirect + GANADERO dashboard
2. Conflicts guard needs tightening to ADMIN_ONLY_ROLES
3. Backups route is already ADMIN-only but producto says GANADERO-only — needs clarification (is backups route even reachable for GANADERO in V1?)
4. BE ownership is already correctly derived from JWT in most places
5. FE doesn't send `ganaderoId` in services — confirmed ✓

The orchestrator should proceed to `sdd-propose` with these findings.