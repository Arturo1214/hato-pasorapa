# Proposal: frontend-product-ux-alignment-v1

## Intent

Alinear `hato-fe` con producto real: registro público ganadero con autologin, dashboard con gráficos, layout con branding, y gestión de usuarios/ganaderos con tablas estilo `pd-fe`. Incluir anti-spam V1 en el registro público sin usar proveedores externos (Turnstile/hCaptcha postergado a V2+).

## Scope

### In Scope
- Registro público ganadero (FE + BE) con autologin post-registro
- **Anti-spam V1 en registro público**: honeypot + timing + rate limiting básico (sin terceros)
- Perfil ganadero: completar datos faltantes + cambio de contraseña con contraseña actual
- Login post-auth redirect a `/admin/dashboard`
- Dashboard con librería de gráficos (Chart.js / ng2-charts)
- Layout/header/sidebar con branding y logout
- `/admin/usuarios` — tabla con filtros, paginación, modal de creación/edición (solo ADMIN)
- Nueva vista admin `/admin/ganaderos` — gestión de usuarios GANADERO con reset de contraseña (temp: `112345AB`)
- Limpieza de scaffold y texto técnico del home
- Adaptación visual estilo `pd-fe` (DataTable, formularios, modales)

### Out of Scope
- Email verification en registro
- Aprobación manual de registros (auto-habilitados)
- Gráficos complejos o dashboards configurables
- Offline sync de registro público (online-only)
- Funcionalidad móvil responsive completa
- **CAPTCHA/proveedores externos (Turnstile, hCaptcha, reCAPTCHA) — reservado para V2+**

## Capabilities

### New Capabilities
- `ganadero-public-registration`: Registro público de ranchers con rol GANADERO, autologin tras crear usuario
- `anti-spam-registration-v1`: Honeypot + timing + rate limiting en registro público; preparado para CAPTCHA externo en V2
- `ganadero-profile`: Completar datos faltantes y cambio de contraseña con contraseña actual
- `admin-user-management-table`: Tabla `/admin/usuarios` con filtros, paginación, modal CRUD (solo ADMIN)
- `admin-ganadero-management`: Vista dedicada a gestionar ranchers con reset de contraseña temporal
- `dashboard-charts`: Dashboard con gráficos de métricas usando librería (Chart.js/ng2-charts)

### Modified Capabilities
- `login-redirect`: Cambiar redirect post-login de `/` a `/admin/dashboard`
- `header-logout`: Agregar botón logout al header

## Approach

### BE — Public Ganadero Registration + Anti-Spam
- Nuevo endpoint `POST /api/public/ganaderos` (sin auth) con DTO mínimo: `businessIdentifier`, `name`, `email`, `password`
- Service crea `Ganadero` + `Usuario` con rol `GANADERO`, usuario queda habilitado directamente
- **El `username` del `Usuario` se setea al `email`** — necesario para que login acepte email como credential
- El `businessIdentifier` (CI) queda en `Ganadero` como identificador único del ranchero, no como credential
- Retourne JWT para autologin inmediato
- **Anti-spam backend**:
  - Rate limiting por IP + email (in-memory Guava Cache o map, TTL 15min, máx 3 registros/IP/email)
  - Validación: honeypot field (`website`) debe venir vacío o null
  - Timestamp mínimo: `formIssuedAt` en request, rechazar si < 3 segundos desde issuance (protege contra bots rápidos)
  - Logs de intento rechazado para monitoreo futuro

### FE — Registration + Autologin + Anti-Spam
- Reactive Form en `ganadero-registration-page` con validación
- **Honeypot**: campo oculto `website` (visually hidden, tabindex=-1, autocomplete=off) — el usuario real no lo ve ni llena
- **Timing**: generar `formIssuedAt = Date.now()` al renderizar el form; enviar en request; BE valida > 3s
- tras registro exitoso, guardar token y navegar a `/admin/dashboard`
- Campos: `businessIdentifier`, `name`, `email`, `password`, `confirmPassword` (+ honeypot `website`)
- Mostrar error genérico si rate limit o timing falla (no revelar causa específica)

### FE — Perfil Ganadero
- Nueva ruta `/perfil` con formulario para completar datos faltantes (`telefono`, `direccion`, etc.)
- Cambio de contraseña: requiere `currentPassword` + `newPassword` + `confirmPassword`

### FE — Dashboard Charts
- Integrar `ng2-charts` (wrapper Chart.js)
- Reemplazar métricas de texto por gráficos de barras/doughnut para totales de admins y ranchers

### FE — /admin/usuarios Table
- Adaptar patrón `DataTableComponent` de `pd-fe`: filtros por username/rol/estado, paginación, sort
- Modal de creación/edición con Reactive Form (MatDialog)
- Acciones: Ver, Editar, Deshabilitar

### FE — /admin/ganaderos Table
- Tabla con filtros por `businessIdentifier`, `nombre`, `estado`
- Acciones: Ver, Editar, Deshabilitar, Reset Password (genera temp `112345AB`)

### Layout
- Header: logo/app-name, user display name, theme toggle, **logout button**
- Sidebar: branding, navegación por rol (ADMIN ve más opciones)
- Limpiar HomeComponent — quitar texto scaffold

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/PublicGanaderosResource.java` | Modified | Endpoint público con validación anti-spam |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/public/ganadero/GanaderoPublicCreateRequest.java` | Modified | Agregar `website` (honeypot), `formIssuedAt` (timing) |
| `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoService.java` | Modified | Rate limiting + validación anti-spam |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Usuario.java` | Modified | Agregar campos email, contactInfo si no existen |
| `hato-fe/src/app/features/public/ganadero-registration/` | Modified | Honeypot + timing + manejo de errores anti-spam |
| `hato-fe/src/app/features/admin/profile/` | New | Perfil ganadero con completar datos + cambio password |
| `hato-fe/src/app/features/admin/dashboard/` | Modified | Gráficos con ng2-charts |
| `hato-fe/src/app/features/admin/users/` | Modified | DataTable con filtros + modal CRUD |
| `hato-fe/src/app/features/admin/ganaderos/` | Modified | Cards → DataTable, reset password |
| `hato-fe/src/app/ui/layout/main-layout/` | Modified | Header con logout, sidebar con branding |
| `hato-fe/src/app/ui/home/` | Modified | Limpiar scaffold text |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Abuso del endpoint público de registro (spam bots) | High | Honeypot + timing + rate limiting básico en V1; CAPTCHA externo en V2 |
| Honeypot evadido por bot sofisticado | Med | Rate limiting adicional por IP; logs para monitoreo |
| Bundle size increase por Chart.js | Med | Lazy-load módulo de charts; tree-shake unused Chart.js components |
| DataTable adaptación compleja desde pd-fe | High | Construir componente propio inspirado en patrón, no copia literal |
| Rate limiting in-memory puede perder estado en restart | Low | Evaluar persistencia en Redis/file en V2; V1 solo protege contra bots casuales |

## Rollback Plan

- **BE**: Revertir cambios en `PublicGanaderosResource.java` y `GanaderoService.java`; endpoint público queda deshabilitado
- **FE**: Deshabilitar rutas de registration/profile/ganaderos-table; restaurar componentes originales desde git
- **Auth**: Si autologin falla, el endpoint peut retourner error 401 y FE muestra pantalla de login

## Dependencies

- Endpoint `POST /api/public/ganaderos` necesita contrato FE/BE alineado sobre campos obligatorios
- Librería `ng2-charts` debe ser aprobada e instalada antes de implementar gráficos
- Acceso a `pd-fe/DataTableComponent` como referencia visual
- **Para V2**: evaluar Turnstile Cloudflare o hCaptcha como CAPTCHA externo

## Success Criteria

- [ ] Usuario público puede registrarse con `businessIdentifier`, `name`, `email`, `password` y queda logueado automáticamente
- [ ] Registro rechaza bots: honeypot vacío, timing > 3s, rate limit 3/IP
- [ ] Perfil permite completar datos faltantes y cambiar contraseña (requiere `currentPassword`)
- [ ] Login redirect lleva a `/admin/dashboard` (no a `/`)
- [ ] Dashboard muestra al menos 2 gráficos (barras o doughnut)
- [ ] Header tiene logout funcional + branding
- [ ] `/admin/usuarios` es tabla con filtros + modal CRUD; solo accesible para ADMIN
- [ ] `/admin/ganaderos` permite ver, editar, deshabilitar y resetear contraseña (temp `112345AB`)
- [ ] Estilo visual replicas `pd-fe` para tablas, formularios y modales
- [ ] Preparado para CAPTCHA externo (V2): campo honeypot/timing compatible con Turnstile/hCaptcha

## Anti-Spam V1 — Detalle Técnico

### Frontend (FE)
| Elemento | Implementación |
|----------|----------------|
| Honeypot field | `<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" />` — invisible para usuario real |
| Timing | `formIssuedAt = Date.now()` al renderizar form; enviar como campo oculto en POST |
| Error handling | Mensaje genérico "Error en el registro, intenta más tarde" sin revelar causa |

### Backend (BE)
| Validación | Regla |
|------------|-------|
| Honeypot | `website == null || website.isBlank()` — si viene con valor, rechazar (es bot) |
| Timing | `Duration.between(formIssuedAt, Instant.now()).getSeconds() < 3` → reject 400 |
| Rate limit | 3 registros por IP en ventana de 15 min; 3 registros por email en ventana de 1h |

### Futura Integración CAPTCHA (V2)
- Interfaz preparada: la validación anti-spam V1 coexiste con CAPTCHA futuro
- Opciones: Turnstile (Cloudflare) o hCaptcha (permite fallback offline)
- Estructura: validators separables, fácil de agregar/sacar