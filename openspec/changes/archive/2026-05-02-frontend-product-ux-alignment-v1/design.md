# Design: frontend-product-ux-alignment-v1

## Technical Approach

Alinear `hato-fe` con producto real: registro público ganadero con autologin, dashboard con gráficos, layout con branding, y gestión de usuarios/ganaderos con tablas estilo `pd-fe`. Anti-spam V1 (honeypot + timing + rate limiting) sin CAPTCHA externo.

## Architecture Decisions

### Decision: BE — Nuevo endpoint público para registro ganadero

**Choice**: Nuevo `PublicGanaderosResource` en `hato-be` con `POST /api/public/ganaderos` (sin auth), que crea `Ganadero` + `Usuario` con rol `GANADERO` y retorna JWT para autologin.

**Alternatives considered**:
- Reutilizar `GanaderosResource` existente relajando `@RolesAllowed` — descartado por mezcla de concerns y riesgo de seguridad.
- Crear `Usuario` sin `Ganadero` primero — descartado porque el registro público requiere el ganadero asociado.

**Rationale**: Separa claramente el flujo público del flujo admin. El nuevo resource vive en `web.rest.public` y no tiene annotaciones `@RolesAllowed`. El service crea ambas entidades atómicamente.

### Decision: Anti-spam V1 — Honeypot + Timing + Rate Limiting In-Memory

**Choice**: Honeypot field (`website`) + timing validation (`formIssuedAt`, mínimo 3s) + rate limiting por IP/email usando Caffeine Cache (in-memory, TTL 15min).

**Alternatives considered**:
- Redis para rate limiting — descartado V1 (no hay infraestructura Redis desplegada).
- CAPTCHA externo (Turnstile/hCaptcha) — reservado para V2+.

**Rationale**: Honeypot + timing frenan bots casuales. Rate limiting in-memory (Caffeine) protege contra floods. La estructura permite agregar CAPTCHA como validator separable en V2.

### Decision: FE — ng2-charts para dashboard con lazy-load

**Choice**: `ng2-charts` (wrapper Chart.js) integrado en un feature module `features/admin/charts/` cargado lazily, con tree-shake de imports Chart.js.

**Alternatives considered**:
- ApexCharts — más moderno pero ecosystem más pequeño.
- D3.js puro — demasiado bajo nivel para el uso esperado.
- No agregar librería — descartado porque el requerimiento explícito pide gráficos.

**Rationale**: `ng2-charts` tiene soporte Angular directo, es liviano si se importan solo los componentes usados (Bar, Doughnut), y permite lazy-load del módulo de charts para no inflar el bundle inicial.

### Decision: FE — DataTableComponent propio inspirado en patrón pd-fe

**Choice**: Construir `ui/shared/data-table/` con Inputs: columns config, data source, filter fields; Output: page/sort/filter events;Internally usa `MatTableDataSource` + `MatPaginator`.

**Alternatives considered**:
- Copiar `DataTableComponent` de pd-fe literalmente — descartado por diferencias en estructura de datos y deuda técnica.
- Usar Ngx-datatable — requiere dependencia adicional.

**Rationale**: El patrón es claro (header con filtros, paginación, sort, fila con acciones). Un componente propio permite adaptar los Inputs/Outputs al modelo de `hato-fe` sin deuda de copiar lógica de otro proyecto.

### Decision: BE — Entidad Ganadero extiende con email/contact fields

**Choice**: Agregar `email` y `contactInfo` a la entidad `Ganadero` y al DTO `GanaderoCreateRequest`.

**Alternatives considered**:
- Crear tabla separada `GanaderoProfile` — descartado, no hay relación 1:1 clara.
- No agregar campos — descartado porque el registro público requiere email para contacto.

**Rationale**: El `Ganadero` necesita email para el registro público. `contactInfo` permite almacenar teléfono/dirección para el perfil ganadero.

### Decision: BE — Login con email o CI para usuarios ganadero

**Choice**: `AuthService.login()` ya resuelve `username` como email OR username usando `findByUsernameOrEmail()` en `UserRepository`. Para usuarios GANADERO creados vía registro público, el `username` del `Usuario` se setea al `email` del registro. El `businessIdentifier` (CI) se almacena exclusivamente en `Ganadero` (no en `Usuario`) y NO se usa como credential directo — el login resuelve contra `email` o `username` en la entidad `User`.

**Alternatives considered**:
- Agregar `businessIdentifier` a `Usuario` como credential alternativo — descartado porque mezcla responsabilidades.
- Crear resolver `findByBusinessIdentifier` en `UserRepository` — descartado porque el `Usuario` no tiene `businessIdentifier`.
- Cambiar el DTO `AuthLoginRequest.username` a `identifier` con lógica de tipo — descartado por ser más invasivo sin necesidad.

**Rationale**: Elinke ya existente `findByUsernameOrEmail` cubre email → fine. Para CI-login, el `Usuario` del ganadero usa `username = email`, entonces entrar con CI no funciona nativamente — se necesita que el registro público setee `username = email` y que el campo CI sea único en `Ganadero`. El login sigue siendo `username` (que es email) como credential, sin cambios en el resource ni en el DTO.

### Decision: FE — Perfil ganadero en `/perfil` con cambio de contraseña

**Choice**: Nueva ruta `/perfil` (protegida, roles `ADMIN` y `GANADERO`) con formulario para completar datos faltantes y cambio de contraseña que requiere `currentPassword`.

**Alternatives considered**:
- Perfil inline en dashboard — descartado por separación de concerns.
- Modificar Ganadero desde `/admin/ganaderos` — el ganadero debe poder editar sus propios datos.

**Rationale**: El propio ganadero necesita completar sus datos de contacto sin depender de un admin.

## Data Flow

### Public Registration Flow

```
FE: GanaderoRegistrationPage
  → POST /api/public/ganaderos {businessIdentifier, name, email, password,
                                  website (honeypot), formIssuedAt}
  → BE: PublicGanaderosResource.create()
      → AntiSpamValidator.validate(honeypot, formIssuedAt, ip, email)
         → GanaderoService.createPublic() → persist Ganadero + Usuario(GANADERO)
      → returns {accessToken, user}
  → FE: AuthService.persistSession() → navigate /admin/dashboard
```

### Anti-Spam Validation Flow (BE)

```
1. Honeypot check:   website == null || website.isBlank() ? continue : REJECT
2. Timing check:     Duration.between(formIssuedAt, now).getSeconds() >= 3 ? continue : REJECT
3. Rate limit check: cache.get(ip) >= 3 || cache.get(email) >= 3 ? REJECT : increment
4. All pass → proceed with registration
```

## File Changes

### New Files (BE)

| File | Description |
|------|-------------|
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/public/PublicGanaderosResource.java` | Endpoint público `POST /api/public/ganaderos` |
| `hato-be/src/main/java/bo/pasorapa/hato/service/public/PublicGanaderoService.java` | Lógica de registro + anti-spam |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/public/ganadero/GanaderoPublicCreateRequest.java` | DTO con honeypot + timing fields |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/public/ganadero/GanaderoPublicResponse.java` | DTO respuesta con JWT + datos usuario |
| `hato-be/src/main/java/bo/pasorapa/hato/service/validator/AntiSpamValidator.java` | Honeypot + timing + rate limiting |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/RateLimitCache.java` | Caffeine cache para rate limiting |

### New Files (FE)

| File | Description |
|------|-------------|
| `hato-fe/src/app/ui/shared/data-table/` | DataTableComponent reutilizable |
| `hato-fe/src/app/features/admin/profile/profile-page.component.ts` | Página de perfil ganadero |
| `hato-fe/src/app/features/admin/profile/data-access/profile.service.ts` | Service para perfil + password |
| `hato-fe/src/app/features/admin/charts/` | Módulo lazy-load para charts |

### Modified Files

| File | Action | Description |
|------|--------|-------------|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Ganadero.java` | Modify | Agregar `email` y `contactInfo` |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/ganadero/GanaderoCreateRequest.java` | Modify | Agregar `email` |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Usuario.java` | Modify | Asegurar campos necesarios para usuario ganadero |
| `hato-be/pom.xml` | Modify | Agregar dependencia `caffeine` |
| `hato-fe/src/app/app.routes.ts` | Modify | Agregar `/perfil` route; cambiar redirect `/` → `/admin/dashboard` |
| `hato-fe/src/app/features/public/ganadero-registration-page/ganadero-registration-page.component.ts` | Replace | Componente completo con Reactive Form + honeypot + timing |
| `hato-fe/src/app/features/admin/dashboard/admin-dashboard-page.component.ts` | Replace | Reemplazar métricas de texto por gráficos ng2-charts |
| `hato-fe/src/app/features/admin/users/admin-users-page.component.ts` | Replace | Cards-grid → DataTable con filtros + modal creation |
| `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts` | Replace | Cards-grid → DataTable con filtros + reset password action |
| `hato-fe/src/app/ui/layout/main-layout/header/header.ts` | Modify | Agregar logout button al template |
| `hato-fe/src/app/ui/home/home.component.ts` | Modify | Limpiar texto scaffold; redirect a dashboard |
| `hato-fe/package.json` | Modify | Agregar `ng2-charts` |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modify | `logout()` público y accesible desde header |

### Deleted Files

| File | Reason |
|------|--------|
| `hato-fe/src/app/features/public/ganadero-registration-page/ganadero-registration-page.component.html` | Template inline en component |
| `hato-fe/src/app/features/public/ganadero-registration-page/ganadero-registration-page.component.scss` | Styles inline |

## Interfaces / Contracts

### BE — Public Ganadero Registration

```java
// POST /api/public/ganaderos
// Request:
public record GanaderoPublicCreateRequest(
    @NotBlank String businessIdentifier, // CI — único en Ganadero
    @NotBlank String name,
    @NotBlank @Email String email,        // usado también como username del Usuario
    @NotBlank String password,
    String website,        // honeypot — debe ser null/vacío
    Instant formIssuedAt   // timestamp de issuance del form
)

// Response (201 Created):
public record GanaderoPublicResponse(
    String accessToken,
    String tokenType,
    int expiresInSeconds,
    PublicUserDto user
)

public record PublicUserDto(
    String id,
    String username,   // = email del registro
    String email,
    String displayName,
    String role,
    String status
)
```

### BE — Login con email o CI (AuthLoginRequest)

```java
// POST /api/auth/login
// Request: el campo `username` del existing DTO se reutiliza como `identifier`
// Acepta email (username) o CI (businessIdentifier del Ganadero asociado)
public record AuthLoginRequest(
    @NotBlank String username   // puede ser email o CI — ambos resuelven contra username en User
)
```

**Nota**: El DTO `AuthLoginRequest.username` actúa como identificador genérico. La lógica `UserRepository.findByUsernameOrEmail()` ya maneja email → username. Para resolver CI → username, se requiere que el `Usuario` del ganadero tenga `username = email`, y que `Ganadero.businessIdentifier` sea único — la UI puede enviar el CI en el campo `username` y el `AuthService` necesita agregar un paso de resolución: si `identifier` no es email y no matchea `username`, buscar si es `businessIdentifier` de algún `Ganadero` activo y obtener el `Usuario.email` correspondiente para luego llamar recursivamente a `findByUsernameOrEmail()`.

> **Acción pendiente en sdd-tasks**: Implementar lógica de resolución CI→email en `AuthService.login()`.

### Anti-Spam Validator Interface

```java
public interface AntiSpamValidator {
    void validate(HoneypotResult honeypot, Instant formIssuedAt, String ip, String email);
}

public record HoneypotResult(boolean isBot, String website) {}
```

### FE — Profile Change Password

```typescript
// PUT /api/admin/profile/password
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| BE Unit | `PublicGanaderoService.createPublic()` — duplicados, creación atómica | JUnit 5, mocked `GanaderoRepository`, `UsuarioRepository` |
| BE Unit | `AntiSpamValidator` — honeypot reject, timing reject, rate limit | JUnit 5 parameterized tests |
| BE Integration | `POST /api/public/ganaderos` endpoint | quarkus-junit5 + rest-assured, validar 201 + JWT en body |
| BE Integration | Anti-spam: reject requests con honeypot lleno, timing < 3s | rest-assured, validar 400 + código `ANTI_SPAM_REJECTED` |
| FE Unit | `GanaderoRegistrationPageComponent` form validation | Vitest, simulate form submit |
| FE Unit | `DataTableComponent` filter/sort/paginate events | Vitest |
| FE Unit | Profile `changePassword()` with wrong currentPassword | Vitest, mock `HttpTestingController` |
| FE E2E | Registro público → autologin → dashboard visible | Playwright (pendiente setup) |

## Migration / Rollout

No migration required. Los cambios son aditivos:
- Nuevo endpoint público no afecta endpoints existentes.
- Entidad `Ganadero` con nuevos campos `email` y `contactInfo` — nullable, no afecta datos existentes.
- Rate limiting in-memory solo requiere agregar dependencia Caffeine.

Fase de rollout sugerida:
1. Deploy BE con nuevo endpoint + anti-spam
2. Deploy FE con registration + redirect
3. Deploy FE con dashboard charts + tables
4. Deploy FE con profile + header logout

## Open Questions

- [x] ¿El campo `businessIdentifier` del registro público es el mismo NIT/CI del `Ganadero` existente o es un campo nuevo? → Sí, es el mismo del `Ganadero` existente.
- [x] ¿El `username` del `Usuario` creado para el ganadero público es el `email` o el `businessIdentifier`? → Se usa `email` como username del `Usuario`, el `businessIdentifier` queda en `Ganadero`.
- [x] ¿La librería `ng2-charts` está aprobada o necesita confirmación antes de instalar? → Pendiente confirmar.
- [ ] ¿El perfil ganadero (`/perfil`) permite cambiar `businessIdentifier` o solo contacto? → Solo contacto.
- [ ] ¿Hay necesidad de un endpoint `/admin/profile` para cambiar password, o alcanza con `/admin/usuarios` reset flow? → Se necesita endpoint propio.

## Charts Library Choice

| Library | Bundle Impact | Angular Support | Decision |
|---------|--------------|-----------------|----------|
| ng2-charts (Chart.js) | ~200KB tree-shaken | Official wrapper, standalone components | **Selected** |
| ApexCharts | ~300KB | `ng-apexcharts`第三方 | Descartado — más pesado |
| D3.js | ~900KB minified | No wrapper oficial | Descartado — overkill |

Charts se cargan via lazy route: `loadComponent: () => import('./features/admin/charts/chartslazy.component')` — el módulo solo se descarga cuando el usuario accede al dashboard.

## Security Notes

1. Registro público NO crea usuarios ADMIN — el rol `GANADERO` es hardcodeado en `PublicGanaderoService`.
2. Reset password temporal (`112345AB`) solo ejecutable por ADMIN desde `/admin/ganaderos`.
3. Endpoint `/api/public/ganaderos` es `online-only` — no hay sync offline para registro público.
4. Rate limiting es in-memory (Caffeine) — se pierde en restart. Para V2 evaluar Redis.