# Design: MVP Admin + Ganaderos Offline Foundation

## Technical Approach

Implementación vertical FE/BE en 3 bloques: (1) hardening de auth + seed del primer admin, (2) gestión administrativa de usuarios/ganaderos, (3) contratos mínimos offline-first (IDs, versionado, timestamps, idempotencia). Se respeta arquitectura actual: Angular por feature con componentes standalone + signals/RxJS, y Quarkus por capas REST → Service → Repository/Domain con DTOs en borde.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Identidad de entidades nuevas | BIGSERIAL, UUID | BIGSERIAL simple pero malo para creación offline; UUID evita colisión multi-dispositivo | **UUID como ID canónico** para `users` y `ganaderos` (API usa UUID). |
| Hardening de login | Mantener `/auth/token` con roles en request, o login contra DB | Mantener actual es inseguro; DB exige hashing/migración | **Nuevo `/api/auth/login`** con `username/email + password`, roles/estado resueltos desde DB. |
| Modelo de autorización | Solo `@RolesAllowed`, o RBAC + estado de cuenta | Solo rol no contempla usuarios inactivos | **Rol + estado** (`ACTIVE/INACTIVE/BLOCKED`) validado en servicio de auth y guards FE. |
| Versionado de concurrencia | Solo `updatedAt`, o `version + updatedAt` | Solo timestamp es ambiguo; version agrega control claro | **`version` (long) + `updatedAt`** en entidades mutables; `If-Match` opcional en updates futuros. |
| Idempotencia de mutaciones | Sin idempotencia, o `operationId` persistido | Sin idempotencia rompe reintentos offline; persistir agrega tabla/índices | **`X-Operation-Id` obligatorio** en POST/PUT admin críticos, persistido en `operation_log`. |

## Data Flow

```text
Bootstrap inicial
FE admin-seed -> POST /api/admin/bootstrap -> AdminBootstrapService
  -> UserRepository (create first ADMIN) -> JWT emit -> FE session

Login normal
FE login -> POST /api/auth/login -> AuthService (verify hash + estado + rol)
  -> JWT claims (sub, role, userVersion, tenant) -> FE guarda sesión

Gestión administrativa
FE admin/users or admin/ganaderos -> guarded routes
  -> REST resources -> services (validaciones negocio)
  -> repositories (Panache) -> PostgreSQL (users, ganaderos, operation_log)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/002-admin-ganaderos-foundation.yaml` | Create | Tablas `users`, `ganaderos`, `operation_log`, índices, seed opcional controlado. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir nuevo changelog 002. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/{User,Ganadero,OperationLog}.java` | Create | Modelo persistente con `id(UUID)`, `version`, `createdAt`, `updatedAt`, estado/rol. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/{UserRepository,GanaderoRepository,OperationLogRepository}.java` | Create | Consultas de unicidad y ownership admin->ganadero. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/{AuthService,AdminBootstrapService,AdminUserService,GanaderoService}.java` | Create | Casos de uso y validaciones de negocio/autorización. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/{bootstrap,users}/**` | Modify | DTOs de bootstrap/usuarios con validación explícita `@Size(min = 8)` + `@Pattern` compartiendo regex canónica de password policy. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/{AuthResource,AdminBootstrapResource,AdminUsersResource,GanaderosResource,AdminDashboardResource}.java` | Modify/Create | Endpoints login/seed/CRUD/dashboard. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/**` | Create | DTOs request/response con Bean Validation. |
| `hato-fe/src/app/core/auth/auth-rules.ts` | Create | Fuente única de roles soportados (`ADMIN`,`GANADERO`) y roles exclusivos de rutas administrativas. |
| `hato-fe/src/app/app.routes.ts` | Modify | Rutas para `/admin/bootstrap`, `/admin/usuarios`, `/admin/ganaderos`, `/admin/dashboard`. |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modify | Alinear login con `/api/auth/login`, sesión con rol/estado/version/lastSyncedAt. |
| `hato-fe/src/app/core/auth/guards/{auth.guard.ts,role.guard.ts}` | Modify/Create | Guardas por autenticación + rol/estado. |
| `hato-fe/src/app/features/admin/**` | Create | Features standalone: bootstrap, usuarios, ganaderos, dashboard. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Menú dinámico según rol. |

## Interfaces / Contracts

```ts
type Role = 'ADMIN' | 'GANADERO';
type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

interface OfflineMeta {
  version: number;
  updatedAt: string;   // ISO-8601
  createdAt: string;   // ISO-8601
  lastSyncedAt?: string;
}

interface AdminUserDto extends OfflineMeta {
  id: string; // UUID
  username: string;
  role: Role;
  status: UserStatus;
}

const PASSWORD_POLICY_REGEX = '^(?=.*[A-Z])(?=.*\\d).{8,}$';
const ALLOWED_ROLES = ['ADMIN', 'GANADERO'] as const;
const ADMIN_ONLY_ROLES = ['ADMIN'] as const;
```

Mutaciones críticas aceptan header `X-Operation-Id` (UUID). Si una operación ya fue procesada, el backend devuelve misma respuesta semántica sin duplicar efecto.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | Guards por rol/estado, mapeo de sesión, validaciones forms admin/ganadero | `*.spec.ts` en servicios/guards/componentes standalone con mocks de HttpClient. |
| Integration FE | Flujos login->ruta protegida y bootstrap inicial | Tests de routing + componentes con TestBed y RouterTesting. |
| Unit BE | AuthService (hash/status/roles), reglas unicidad/ownership, idempotencia | JUnit5 con repositorios mock/stub. |
| REST BE | `/auth/login`, `/admin/bootstrap`, CRUD admins/ganaderos, dashboard | `quarkus-junit5` + `rest-assured` verificando 200/401/403/409. |

## Migration / Rollout

1. Liquibase 002 con nuevas tablas + índices. 2) Activar endpoints nuevos y mantener compatibilidad temporal de `/api/auth/token` behind flag interna deprecada. 3) FE migra a `/api/auth/login` y suma rutas `/admin/dashboard`, `/admin/usuarios`, `/admin/ganaderos` protegidas solo para `ADMIN`. 4) Retirar `/api/auth/token` al cerrar el rollout del login real. No requiere migración de datos legacy.

## Risks, Tradeoffs & Implementation Sequence

- **Riesgo**: cortar login actual sin transición. **Mitigación**: rollout en dos pasos con deprecación breve.
- **Riesgo**: sobre-diseñar offline. **Tradeoff**: solo foundation (metadata + operationId), sin motor sync completo.
- **Riesgo**: falta de tests BE existentes. **Mitigación**: crear suite mínima REST desde primera iteración.

Secuencia recomendada: (1) esquema + entidades + auth hardening, (2) bootstrap admin, (3) CRUD admins, (4) CRUD ganaderos + ownership, (5) dashboard, (6) guards/vistas FE, (7) cierre de endpoint legado y pruebas de regresión.

## Open Questions

- [x] Política final: password definitiva desde bootstrap y alta administrativa, mínimo 8 caracteres, al menos 1 mayúscula y 1 número.
- [x] Roles finales del MVP: solamente `ADMIN` y `GANADERO`; no existe `OPERADOR` ni roles intermedios.
