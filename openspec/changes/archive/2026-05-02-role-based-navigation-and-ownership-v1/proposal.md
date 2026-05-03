# Proposal: role-based-navigation-and-ownership-v1

## Intent

Implementar navegación diferenciada por rol (ADMIN / GANADERO) con orden exacto de vistas, redirect role-aware al dashboard correcto, y enforcement de ownership en BE sin que FE pase `ganaderoId`. Cerrar gaps de guard y sidebar descubiertos en exploración.

## Scope

### In Scope
- Dashboard ganadero dedicado (`/ganadero/dashboard`) separado del admin
- Redirect role-aware: `'' → admin/dashboard` (ADMIN) o `'' → vendedor/dashboard` (GANADERO) según rol
- Sidebar con orden exacto por rol confirmado por producto
- Guard corregido en `/admin/conflictos` → `ADMIN_ONLY_ROLES` (GANADERO-only)
- Backups visible SOLO para GANADERO (ruta `/ganadero/backups`)
- Notificaciones diferenciadas: ADMIN ve (Administración, Creación, Historial); GANADERO ve solo Recibidas
- BE: todas las operaciones propias del GANADERO derivan `ganaderoId` desde JWT — FE NO pasa `ganaderoId`
- Sincronización visible SOLO para GANADERO

### Out of Scope
- Layout segmentation (AdminLayout vs GanaderoLayout) — diferido a V2
- Layout con scaffold genérico sin role context — no aplica
- ADMIN offline — hard blocked con guard enrutamiento + BE JWT

## Capabilities

### New Capabilities
- `ganadero-dashboard`: Ruta `/ganadero/dashboard` con componente standalone `GanaderoDashboardPageComponent`. Muestra operaciones propias del ganadero (resumen animales, visitas pendientes, calendario próximo). Solo rol GANADERO.
- `role-based-redirect`: Redirección desde `''` al dashboard apropiado según rol extraído del JWT en `authGuard`. ADMIN → `/admin/dashboard`, GANADERO → `/ganadero/dashboard`.
- `ganadero-backups`: Ruta `/ganadero/backups` visible solo para GANADERO. Admin NO ve esta ruta.
- `ganadero-sync`: Ruta `/ganadero/sincronizacion` visible solo para GANADERO.
- `ganadero-conflicts`: Ruta `/ganadero/conflictos` scoped a operaciones propias del ganadero logueado. ADMIN no tiene acceso.
- `role-ordered-sidebar`: Sidebar con itemsordenados por rol según lista confirmada. ADMIN: Dashboard, Usuarios, Ganaderos, Notificaciones, Reportes. GANADERO: Dashboard, Animales, Visitas veterinarias, Ganaderos, Calendario, Notificaciones, Sincronización, Backups, Conflictos.

### Modified Capabilities
- `role-admin-notifications` (existing): Notificaciones ADMIN ahora muestra tabs: Administración, Creación, Historial.
- `role-ganadero-notifications` (existing): Notificaciones GANADERO ahora muestra solo bandeja de recibidas (sin tabs de creación/administración).

## Approach

1. **FE — nueva ruta GANADERO dashboard**: crear `GanaderoDashboardPageComponent` standalone en `hato-fe/src/app/features/ganadero/dashboard/`. Ruta `/ganadero/dashboard` con `Roles: ['GANADERO']`.

2. **FE — redirect role-aware**: modificar `authGuard` (o crear `roleRedirectGuard`) para que alResolver `''`.redirija según `authService.currentUser()?.role`:
   - ADMIN → `/admin/dashboard`
   - GANADERO → `/ganadero/dashboard`

3. **FE — sidebar ordered by role**: refactorizar `sidebar.ts` para que `menuItems` use array estático ordenado por rol en lugar de spread computado. ADMIN usa array1, GANADERO usa array2 (orden exacto confirmado).

4. **FE — guard fixes**:
   - `/admin/conflictos` → cambiar de `ALLOWED_ROLES` a `['ADMIN']` (no es ganadero-route)
   - `/admin/backups` → eliminar (no existe para ADMIN, mover a `/ganadero/backups`)
   - `/ganadero/conflictos` → `['GANADERO']`

5. **FE — route additions**: agregar rutas `/ganadero/backups`, `/ganadero/sincronizacion`, `/ganadero/conflictos` bajo layout GANADERO.

6. **FE — notificaciones diferenciadas**:
   - Crear `AdminNotificationsPageComponent` con tabs (Administración, Creación, Historial)
   - Ganadero ve `NotificacionesPageComponent` existente pero solo tab Recibidas (componente ya existe, se ajusta visibility)

7. **BE — ownership enforcement**: auditar que todos los endpoints de operaciones propias (Animales, Eventos, Visitas, Sync) derivan `ganaderoId` desde `SecurityContext.getPrincipal()` y NO aceptan `ganaderoId` como parámetro request. Confirmar que `SyncResource.resolveConflict` scoped by `currentUserId`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/app.routes.ts` | Modified | Nuevas rutas GANADERO, redirect role-aware |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modified | Ordenamiento explícito por rol |
| `hato-fe/src/app/features/ganadero/dashboard/` | New | Componente dashboard ganadero |
| `hato-fe/src/app/features/admin/notifications/` | Modified | Tabs admin vs solo recibidas ganadero |
| `hato-fe/src/app/guards/auth.guard.ts` | Modified | Redirect role-aware en empty path |
| `hato-be/src/main/java/.../web/rest/SyncResource.java` | Modified | Confirmar scope conflict por currentUserId |
| `hato-be/src/main/java/.../web/rest/AnimalesResource.java` | Audit | Verificar ownership (no ganaderoId en request) |
| `hato-be/src/main/java/.../service/*Service.java` | Audit | Derivation from JWT para todas las operaciones propias |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sidebar computed signal re-sort causes UI flicker | Med | Usar懒加载 establecida sin watcher de rol; cachear menuItems por rol |
| Redirect loop si JWT expira durante redirect | Med | Guard redirige a `/login` primero; catch `NavigationCancel` |
| ADMIN accede a conflictos por cache de ruta antigua | Low | Hard redirect en guard + verificar que `ALLOWED_ROLES` no esté en otra ruta |
| GANADERO ve notificaciones de otros en bandeja compartida | Low | BE filtra por `ganaderoId` derivado del JWT en `NotificacionesResource` |

## Rollback Plan

1. Revertir `app.routes.ts` a estado anterior (rutas sin prefijo `/ganadero/`)
2. Restaurar `sidebar.ts` a array único sin separación por rol
3. Deshabilitar redirect role-aware en guard (volver a `redirectTo: 'admin/dashboard'`)
4. Revertir `ADMIN_ONLY_ROLES` en `/admin/conflictos` si fue cambiado
5. BE: revert a accept `ganaderoId` parameter en endpoints afectados si lo agregamos

## Dependencies

- Auth service existente con `currentUser()` signal y rol — sin cambios
- Sync service con `currentUserId()` desde JWT — confirmado working
- AdminProfileService con derivación por email — confirmado working

## Success Criteria

- [ ] ADMIN ve sidebar en orden: Dashboard, Usuarios, Ganaderos, Notificaciones, Reportes
- [ ] GANADERO ve sidebar en orden: Dashboard, Animales, Visitas veterinarias, Ganaderos, Calendario, Notificaciones, Sincronización, Backups, Conflictos
- [ ] Navegación a `''` redirige ADMIN a `/admin/dashboard` y GANADERO a `/ganadero/dashboard`
- [ ] `/admin/conflictos` responde 403 para GANADERO
- [ ] `/ganadero/backups` responde 403 para ADMIN
- [ ] BE: endpoints de operaciones propias NO aceptan `ganaderoId` como body/param; derivan desde JWT
- [ ] Notificaciones ADMIN muestra tabs (Administración, Creación, Historial)
- [ ] Notificaciones GANADERO muestra solo bandeja recibidas
- [ ] Tests: `authGuard` redirect tests, sidebar order tests, BE ownership unit tests