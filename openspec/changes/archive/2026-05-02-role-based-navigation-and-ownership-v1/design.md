# Design: role-based-navigation-and-ownership-v1

## Technical Approach

Implementación de navegación diferenciada por rol (ADMIN / GANADERO) mediante:
1. Rutas GANADERO dedicadas bajo prefijo `/ganadero/` con guards propios
2. Redirect role-aware en empty path `''` que derive del JWT sin Zustand/servicio intermedio
3. Sidebar con arrays estáticos por rol — eliminamos el computed spread
4. Notificaciones diferenciadas con component splitting (ADMIN con tabs, GANADERO con bandeja recibida)
5. Verificación BE de ownership sin parámetro `ganaderoId` externo

## Architecture Decisions

### Decision: Route prefix strategy (`/ganadero/` vs sub-routes under same prefix)

**Choice**: Nueva sección de rutas bajo prefijo `/ganadero/` paralelo a `/admin/`
**Alternatives considered**: Usar guards dinámicos en rutas existentes (`ALLOWED_ROLES` filtrado). Se descarta porque mezcla scopes de rol en una misma ruta y complica el sidebar determinista.
**Rationale**: producto define orden exacto de vistas por rol confirmado. Paths separados permiten guards granulares y sidebar determinista sin lógica condicional en tiempo de render.

### Decision: Role-aware redirect mechanism

**Choice**: `CanActivateFn` inyectable que lee `authService.currentUser()?.role` y redirige `'' → /admin/dashboard` o `'' → /ganadero/dashboard`
**Alternatives considered**: Lazy redirect con signal `afterNextRender`. Se descarta — requiere estado global, introduce async race condition en guards.
**Rationale**: Guard es síncrono, corre antes de cualquier navegación. `authGuard` ya tiene la sesión cargada antes del redirect. No necesita señal reactiva.

### Decision: Sidebar ordering

**Choice**: Arrays estáticos paralelos `ADMIN_MENU_ITEMS` y `GANADERO_MENU_ITEMS` — sin computed, sin spread
**Alternatives considered**: `menuItems = role === 'ADMIN' ? ADMIN_MENU : GANADERO_MENU`. El computed spread actual produce re-render en cada cambio de señal y dificulta testing determinista.
**Rationale**: Arrays estáticos eliminan el computed — el sidebar solo recalcula cuando cambia el rol (navegación entre usuarios). Testing determinista: snapshot del array por rol.

### Decision: Notification component splitting

**Choice**: `NotificationInboxPageComponent` actual → GANADERO-only (solo bandeja Received). Crear `AdminNotificationsPageComponent` nuevo con tabs (Administración, Creación, Historial).
**Alternatives considered**: Un solo componente con `computed` para conditionally render tabs vs received-only. Se descarta — viola single responsibility y complica el template.
**Rationale**: ADMIN y GANADERO tienen UX completamente distinta. Componentes separados permiten evolución independiente sin flags de rol en template.

### Decision: BE ownership guard pattern

**Choice**: Auditoría de métodos existentes + convención de que ninguna operación propia del GANADERO acepta `ganaderoId` como parámetro. El service deriva desde `SecurityContext.getPrincipal()` o `JsonWebToken.getSubject()`.
**Alternatives considered**: Crear `@OwnershipGuarded` annotation. Se descarta — requiere desarrollo adicional y cambios en el codebase mapping. La verificación manual es suficiente para V1.
**Rationale**: `SyncService`, `AdminProfileService` y `AnimalEventService` ya derivan correctamente. La auditoría confirma que no hay `ganaderoId` en request params/body de operaciones propias.

## Data Flow

```
FE: '' (empty path)
  authGuard → roleRedirectGuard (new CanActivateFn)
    ├─ role === 'ADMIN' → /admin/dashboard
    └─ role === 'GANADERO' → /ganadero/dashboard

FE: /ganadero/backups, /ganadero/conflictos, /ganadero/sincronizacion
  roleGuard(['GANADERO']) → componente

BE: Sync push/pull
  JsonWebToken.getSubject() → currentUserId (UUID)
  → usado en todas las operaciones propias del GANADERO

BE: AdminProfileService
  user.getEmail() → ganaderoRepository.findByEmail()
  → SIN ganaderoId en request
```

## File Changes

### Frontend (hato-fe)

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/auth/guards/role-redirect.guard.ts` | Create | `CanActivateFn` role-aware redirect para `''` |
| `src/app/app.routes.ts` | Modify | Nueva sección `/ganadero/` (dashboard, backups, conflictos, sincronizacion). Redirect `''` usa `roleRedirectGuard` |
| `src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Arrays estáticos `ADMIN_MENU_ITEMS` / `GANADERO_MENU_ITEMS` — sin computed spread |
| `src/app/features/ganadero/dashboard/ganadero-dashboard-page.component.ts` | Create | Dashboard dedicado GANADERO |
| `src/app/features/ganadero/dashboard/data-access/ganadero-dashboard.service.ts` | Create | Service para métricas ganadero (derivado de admin-dashboard simplificado) |
| `src/app/features/admin/notifications/admin-notifications-page.component.ts` | Create | ADMIN notifications con tabs (Administración, Creación, Historial) |
| `src/app/features/admin/notifications/notification-inbox.page.ts` | Modify | Refactor a GANADERO-only — solo bandeja Received |
| `src/app/core/auth/auth-rules.ts` | Modify | Exportar `GANADERO_ONLY_ROLES = ['GANADERO']` |

### Backend (hato-be)

| File | Action | Description |
|------|--------|-------------|
| `src/main/java/.../service/AnimalEventService.java` | Audit | Confirmar que `create(request, authenticatedUserId)` — sin ganaderoId en request |
| `src/main/java/.../service/AnimalHealthEventService.java` | Audit | Mismo patrón que AnimalEventService |
| `src/main/java/.../service/AnimalReproductionEventService.java` | Audit | Mismo patrón |
| `src/main/java/.../service/SyncService.java` | Audit | Confirmar que `resolveConflict(operationId, request, currentUserId)` deriva de JWT |
| `src/main/java/.../web/rest/SyncResource.java` | Audit | Confirmar que `currentUserId()` desde JWT — no param request |
| `src/main/java/.../service/AdminProfileService.java` | Audit | Confirmar `findGanaderoForProfile(user)` — derivación por email |

## Interfaces / Contracts

### Frontend Role Guard

```typescript
// src/app/core/auth/guards/role-redirect.guard.ts
export const roleRedirectGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.currentUser()?.role;

  if (role === 'GANADERO') {
    return router.createUrlTree(['/ganadero/dashboard']);
  }
  // ADMIN and any other role → admin dashboard
  return router.createUrlTree(['/admin/dashboard']);
};
```

### Auth Rules Extension

```typescript
// src/app/core/auth/auth-rules.ts
export const ALLOWED_ROLES = ['ADMIN', 'GANADERO'] as const satisfies readonly Role[];
export const ADMIN_ONLY_ROLES = ['ADMIN'] as const satisfies readonly Role[];
export const GANADERO_ONLY_ROLES = ['GANADERO'] as const satisfies readonly Role[];
```

### Route Addition Pattern

```typescript
// app.routes.ts — new section
{
  path: 'ganadero',
  canActivate: [authGuard],
  children: [
    {
      path: 'dashboard',
      canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
      loadComponent: () => import('./features/ganadero/dashboard/ganadero-dashboard-page.component')
        .then(m => m.GanaderoDashboardPageComponent),
      data: { title: 'Dashboard', subtitle: '...' }
    },
    {
      path: 'backups',
      canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
      loadComponent: () => import('./features/admin/backup/backup-page.component')
        .then(m => m.BackupPageComponent),
      data: { title: 'Backups', subtitle: '...' }
    },
    {
      path: 'conflictos',
      canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
      loadComponent: () => import('./features/admin/conflicts/conflict-resolution-page.component')
        .then(m => m.ConflictResolutionPageComponent),
      data: { title: 'Conflictos', subtitle: '...' }
    },
    {
      path: 'sincronizacion',
      canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
      loadComponent: () => import('./features/sync-observability/sync-observability.component')
        .then(m => m.SyncObservabilityComponent),
      data: { title: 'Sincronización', subtitle: '...' }
    },
  ]
}
```

### Backend Ownership Contract

Todas las operaciones propias del GANADERO en services/eventos deben seguir este patrón:

```java
// ✅ Correcto — deriva ganaderoId desde authenticatedUserId (JWT)
public AnimalEvent create(AnimalEventRequest request, UUID authenticatedUserId) {
    // derivación interna — sin param ganaderoId
}

// ❌ Incorrecto — acepta ganaderoId externo
// public AnimalEvent create(AnimalEventRequest request, UUID ganaderoId) { ... }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit FE | `roleRedirectGuard` redirect logic | `TestBed` + `RouterTestingModule` — verificar que ADMIN→/admin/dashboard, GANADERO→/ganadero/dashboard |
| Unit FE | Sidebar `ADMIN_MENU_ITEMS` vs `GANADERO_MENU_ITEMS` arrays | Snapshot o `toEqual` directo — verificar orden determinista |
| Unit FE | `NotificationInboxPageComponent.isAdmin()` false for GANADERO | Component test con mock `authService.currentUser()` returning GANADERO role |
| Unit BE | Ownership en AnimalEventService | Unit test: invocar `create()` y verificar que no acepta `ganaderoId` como param |
| Integration BE | `SyncResource.resolveConflict` scoped by `currentUserId` | rest-assured: crear conflicto con USER_A, resolver con USER_B → verificar 403 |
| Integration BE | Endpoint de operaciones propias sin `ganaderoId` en request body | rest-assured: POST sin `ganaderoId` → 200 OK |

## Migration / Rollout

**No migration required.** Cambiosson exclusivamente de routing y comportamiento de UI. Los datos existentes no se tocan. Feature flag `offlineBackupV1Enabled` sigue controlando la visibilidad de backups en sidebar (ya existe).

## Open Questions

- [ ] ¿El dashboard ganadero necesita métricas específicas distintas al admin? Se propone inicial un componente que reuse el mismo service con filtro `currentUserId` derivado del JWT en BE.
- [ ] ¿La página `/admin/notificaciones` actual debe renombrarse a `/ganadero/notificaciones` o se mantiene compartida? El diseño propone mantener `/admin/notificaciones` con split interno de componente según rol (la ruta existe y tiene guard `ALLOWED_ROLES`).
- [ ] ¿La clasificación por sexo de animales existe en el modelo actual? Animal entity no tiene campo `sexo` — la categorización Machos/Hembras requiere agregar campo `sex` a Animal o derivarlo. **Pendiente de decisión de modelo.**

---

# Design: Ganadero Dashboard — Delta

## Ganadero Dashboard BE Endpoints

### Endpoint: GET /api/ganadero/dashboard/animals-summary

**Service**: `GanaderoDashboardService` (new)
**DTO**: `AnimalsSummaryResponse`
**Path**: `src/main/java/bo/pasorapa/hato/web/rest/GanaderoDashboardResource.java` (new)
**Security**: JWT-derived `ganaderoId` from `SecurityContext.getPrincipal()` — no query param

**AnimalsSummaryResponse**:
```java
public record AnimalsSummaryResponse(
    CategoryCount machas,
    CategoryCount hembas
) {}

public record CategoryCount(
    int vaquillas,  // HEIFER
    int vacas,      // COW
    int toros,      // BULL
    int terneros,   // CALF
    int bueyes     // future / castrated BULL
) {}
```

**Implementation note**: `Animal.category` enum (COW, BULL, CALF, HEIFER) existe. No existe campo `sex` en Animal — la categorización Machos/Hembras requiere agregar `sex` field. **Decisión de modelo: agregar `Animal.sex` obligatorio con backfill por categoría.**

### Endpoint: GET /api/ganadero/dashboard/upcoming-events

**Path**: `GanaderoDashboardResource`
**DTO**: `UpcomingEventResponse`
**Security**: JWT-derived `ganaderoId`

**UpcomingEventResponse** (lista):
```java
public record UpcomingEventResponse(
    UUID id,
    String eventType,      // SALUD | REPRODUCCION | GENERAL (derivado de AnimalEventType)
    LocalDate eventDate,
    String description
) {}
```

**Query param**: `limit` (default 5, max 10)

**Source**: Consulta `AnimalEvent` join `Animal` filtrado por `ownerGanadero.id = currentGanaderoId` y `eventDate >= today`. Ordena ASC.

### Endpoint: GET /api/ganadero/dashboard/unread-count

**Path**: `GanaderoDashboardResource`
**DTO**: `UnreadCountResponse`
**Security**: JWT-derived `userId`

**UnreadCountResponse**:
```java
public record UnreadCountResponse(int count) {}
```

**Source**: `AdminNotificationRecipient.countByRecipientUserIdAndReadFalse(currentUserId)`

**Important gap**: `AdminNotificationRecipient` NO tiene campo `read` actualmente. Se necesita agregar `read` boolean column + endpoint para marcar como leído al entrar a notificaciones.

### Endpoint: GET /api/ganadero/dashboard/upcoming-visits

**Path**: `GanaderoDashboardResource`
**DTO**: `UpcomingVisitResponse`
**Security**: JWT-derived `ganaderoId`

**UpcomingVisitResponse** (lista):
```java
public record UpcomingVisitResponse(
    UUID id,
    String controlType,     // VACCINATION | DEWORMING | FIELD_VET_VISIT | etc.
    LocalDate plannedDate,
    String status           // PENDIENTE | COMPLETADA
) {}
```

**Source**: `AnimalHealthEvent` donde `eventType = FIELD_VET_VISIT` y `plannedDate >= today` (futuro). Ordena por `plannedDate` ASC.

## New File Structure (BE)

| File | Action | Description |
|------|--------|-------------|
| `src/main/java/.../web/rest/GanaderoDashboardResource.java` | Create | REST endpoint para los 4 endpoints del dashboard |
| `src/main/java/.../service/GanaderoDashboardService.java` | Create | Lógica de negocio para dashboard metrics |
| `src/main/java/.../service/dto/ganadero/dashboard/AnimalsSummaryResponse.java` | Create | DTO animals summary |
| `src/main/java/.../service/dto/ganadero/dashboard/UpcomingEventResponse.java` | Create | DTO upcoming events |
| `src/main/java/.../service/dto/ganadero/dashboard/UnreadCountResponse.java` | Create | DTO unread count |
| `src/main/java/.../service/dto/ganadero/dashboard/UpcomingVisitResponse.java` | Create | DTO upcoming visits |
| `src/main/java/.../repository/AdminNotificationRecipientRepository.java` | Create/Modify | Agregar `countUnreadByRecipientUserId` |
| `src/main/resources/db/migration/VNNN__add_admin_notification_read.sql` | Create | Add `read` column to `admin_notification_recipients` |
| `src/main/java/.../domain/enumeration/AnimalSex.java` | Create | Enum MACHO/HEMBRA |
| `src/main/java/.../service/dto/animal/CreateAnimalRequest.java` | Modify | Add `@NotNull AnimalSex sex` |
| `src/main/resources/db/migration/VNNN__add_animal_sex.sql` | Create | Add `sex` column + backfill |

## Frontend Changes (Dashboard)

| File | Action | Description |
|------|--------|-------------|
| `src/app/features/ganadero/dashboard/ganadero-dashboard-page.component.ts` | Create | Componente standalone con 4 widgets |
| `src/app/features/ganadero/dashboard/data-access/ganadero-dashboard.service.ts` | Create | Service con 4 signals para métricas |
| `src/app/features/ganadero/dashboard/widgets/` | Create | Carpeta para widgets del dashboard |

## Angular Component Structure

```typescript
// ganadero-dashboard-page.component.ts
@Component({
  selector: 'app-ganadero-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard-grid">
      <app-animals-summary-widget [data]="animalsSummary()" />
      <app-upcoming-events-widget [events]="upcomingEvents()" />
      <app-unread-notifications-widget [count]="unreadCount()" />
      <app-upcoming-visits-widget [visits]="upcomingVisits()" />
    </div>
  `
})
export class GanaderoDashboardPageComponent {
  private readonly service = inject(GanaderoDashboardService);

  readonly animalsSummary = this.service.animalsSummary;
  readonly upcomingEvents = this.service.upcomingEvents;
  readonly unreadCount = this.service.unreadCount;
  readonly upcomingVisits = this.service.upcomingVisits;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit BE | `GanaderoDashboardService.animalsSummary()` | Mock repo, verificar conteo por categoría |
| Unit BE | `GanaderoDashboardService.upcomingEvents()` | Mock repo, verificar límite y orden ASC |
| Integration BE | `GET /api/ganadero/dashboard/unread-count` | rest-assured: crear recipients, verificar count |
| Integration BE | Unauthorized sin JWT → 401 | rest-assured: sin Bearer token |
| Unit FE | `GanaderoDashboardPageComponent` renders all 4 widgets | TestBed con mock service |
| Unit FE | `GanaderoDashboardService` calls correct endpoints | HttpTestingController mock |

---

# Design: Animal Sex — Delta

## Model Changes

### Animal Entity Update

```java
// src/main/java/bo/pasorapa/hato/domain/Animal.java
@Enumerated(EnumType.STRING)
@Column(name = "sex", length = 10, nullable = false)
private AnimalSex sex;
```

### AnimalSex Enum (new)

```java
// src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalSex.java
package bo.pasorapa.hato.domain.enumeration;

public enum AnimalSex {
    MACHO,
    HEMBRA
}
```

## Migration

**File**: `hato-be/src/main/resources/db/migration/VNNN__add_animal_sex.sql`

```sql
-- Step 1: Add nullable column
ALTER TABLE animals ADD COLUMN sex VARCHAR(10);

-- Step 2: Backfill existing animals based on category
UPDATE animals SET sex = 'HEMBRA' WHERE category IN ('COW', 'HEIFER', 'CALF') AND sex IS NULL;
UPDATE animals SET sex = 'MACHO' WHERE category = 'BULL' AND sex IS NULL;

-- Step 3: Set NOT NULL constraint (handled by JPA @Column(nullable = false) after backfill)
-- If Postgres supports adding NOT NULL without default, do it after backfill
-- Otherwise, column stays nullable until next migration
```

**Rollback**: `ALTER TABLE animals DROP COLUMN sex;`

## DTO Changes

### CreateAnimalRequest (modify)

```java
// hato-be/src/main/java/.../service/dto/animal/CreateAnimalRequest.java
public record CreateAnimalRequest(
    @NotBlank String code,
    @NotBlank String tag,
    @NotNull AnimalCategory category,
    @NotNull AnimalSex sex,    // NEW — required
    LocalDate admissionDate,
    BigDecimal weightKg,
    String arete, String marca, String tatuaje,
    UUID motherAnimalUuid, UUID fatherAnimalUuid,
    LocalDate birthDate
) {}
```

### AnimalsSummaryResponse (update categorization logic)

```java
// The AnimalsSummaryResponse now filters by sex field directly:
// MACHO → machas.{category}, HEMBRA → hembas.{category}
// Excludes animals where sex IS NULL
```

## Repository Query

### AnimalRepository: countByOwnerGanaderoIdAndSexAndCategory

```java
// hato-be/src/main/java/.../repository/AnimalRepository.java
public long countByOwnerGanaderoIdAndSexAndCategory(UUID ownerId, AnimalSex sex, AnimalCategory category);
```

Used by `GanaderoDashboardService.animalsSummary()` to count each (sex × category) combination.

## Validation

- CreateAnimalRequest: `@NotNull AnimalSex sex` → 400 if null or absent
- UpdateAnimalRequest: sex is optional on update (ganadero may not change sex), but if provided must be valid enum value

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/main/java/.../domain/enumeration/AnimalSex.java` | Create | Enum MACHO/HEMBRA |
| `src/main/java/.../domain/Animal.java` | Modify | Add `sex` field + getter/setter |
| `src/main/java/.../service/dto/animal/CreateAnimalRequest.java` | Modify | Add `@NotNull AnimalSex sex` field |
| `src/main/resources/db/migration/VNNN__add_animal_sex.sql` | Create | Add column + backfill |
| `src/main/java/.../repository/AnimalRepository.java` | Modify | Add count query with sex filter |
| `src/main/java/.../service/GanaderoDashboardService.java` | Modify | Animals summary uses sex field for grouping |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit BE | Animal entity has sex field | `@EntityTest` |
| Unit BE | CreateAnimalRequest rejects null sex | Validator test |
| Integration BE | Migration backfills COW/HEIFER/CALF → HEMBRA, BULL → MACHO | Liquibase test |
| Integration BE | animals-summary groups by sex correctly | rest-assured: create animals with different sex/category, verify counts |
| Integration BE | Create animal without sex → 400 | rest-assured |
