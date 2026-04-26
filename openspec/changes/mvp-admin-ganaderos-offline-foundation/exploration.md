## Exploration: mvp-admin-ganaderos-offline-foundation

### Current State
El monorepo `code` está en baseline técnico, no en baseline funcional de negocio ganadero:

- **Frontend (Angular)**
  - Hay login básico (`hato-fe/src/app/ui/auth/login/login.component.ts`) y sesión local en `localStorage` (`hato-fe/src/app/core/auth/data-access/auth.service.ts`).
  - No existe interceptor JWT, ni modelo de permisos por rol real, ni módulos de administración de usuarios/ganaderos.
  - No hay capacidades PWA/offline (sin `@angular/service-worker`, sin `ngsw-config`, sin cola local de sincronización).
  - Rutas actuales cubren sólo `login` + `home` (`hato-fe/src/app/app.routes.ts`).

- **Backend (Quarkus)**
  - `AuthResource` expone `/api/auth/token` con `username + roles` y firma JWT sin validar contraseña (`hato-be/src/main/java/bo/pasorapa/hato/web/rest/AuthResource.java`).
  - No existe entidad/tabla de usuarios administradores ni de ganaderos.
  - Dominio implementado hoy: `animals` (entidad + CRUD + filtros), que no cubre aún el flujo de administración inicial pedido.
  - No hay tests backend activos en `src/test/java`.

Conclusión: para este cambio inicial, el foco correcto es **fundación admin + ganaderos + contratos offline-first**, no expansión de módulos pecuarios avanzados.

### Affected Areas
- `hato-fe/src/app/app.routes.ts` — nuevas rutas de administración (seed/admin/ganaderos) y protección por rol.
- `hato-fe/src/app/core/auth/data-access/auth.service.ts` — debe evolucionar de sesión local simple a sesión con metadatos mínimos para offline-first (usuario, rol, tenant, versión de sync).
- `hato-fe/src/app/core/auth/guards/auth.guard.ts` — agregar guard por rol/capacidad para separar administración de usuarios `GANADERO` futuros sin introducir roles intermedios.
- `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` — navegación de módulos iniciales (administradores/ganaderos).
- `hato-fe` (feature nueva) — feature slices para `admin-seed`, `administradores`, `ganaderos`, y estado local preparado para cola de sync.
- `hato-be/src/main/resources/db/changelog/*` — nuevas tablas: administradores, ganaderos, y metadatos de sincronización base.
- `hato-be/src/main/java/**/web/rest` — nuevos recursos REST para bootstrap admin y CRUD de administradores/ganaderos.
- `hato-be/src/main/java/**/service` — servicios de negocio con validaciones de unicidad, estado activo, ownership y trazabilidad mínima.
- `hato-be/src/main/java/**/repository` + `**/domain` — entidades/repositorios Panache de administradores y ganaderos.
- `hato-be/src/main/java/**/service/dto` + `**/service/mapper` — DTOs/mappers para no exponer entidades en API.
- `hato-fe/src/**/*.spec.ts` y `hato-be/src/test/java/**/*.java` — base de tests obligatoria por `strict_tdd: true`.

### Approaches
1. **Vertical slice mínimo con contratos offline tempranos (recomendado)** — implementar admin seed + CRUD admin + CRUD ganaderos, incluyendo desde ya metadatos de sincronización y estrategia de IDs.
   - Pros:
     - Entrega funcional temprana del MVP inicial solicitado.
     - Evita deuda arquitectónica en offline-first (IDs, versionado, conflictos, idempotencia).
     - Deja preparado el camino para módulos pecuarios sin romper contratos.
   - Cons:
     - Requiere más diseño upfront de contratos (aunque no se implemente toda la sincronización).
     - Incrementa complejidad del primer release respecto a “CRUD puro online”.
   - Effort: **Medium**

2. **CRUD online-first y “offline después”** — entregar sólo administración/ganaderos contra API online, sin metadatos ni decisiones de sincronización.
   - Pros:
     - Menor esfuerzo inmediato.
     - Time-to-demo corto.
   - Cons:
     - Alto riesgo de reescritura de FE/BE cuando se agregue offline real.
     - Puede invalidar IDs, contratos y auditoría de cambios.
     - Choca con la visión offline-first ya validada.
   - Effort: **Low (inicial) / High (total por retrabajo)**

### Recommendation
Adoptar **Approach 1** con alcance acotado al cambio `mvp-admin-ganaderos-offline-foundation`:

1. **In scope (este cambio):**
   - Bootstrap/admin seed controlado.
   - Alta y gestión de administradores.
   - Alta y gestión/registro de ganaderos.
   - Contrato base offline-first (IDs cliente-servidor, `updatedAt/version`, `lastSyncedAt`, operación idempotente con `operationId`).
   - Seguridad mínima real para admins (no token abierto por roles arbitrarios).
   - Pruebas iniciales FE/BE para estos flujos.

2. **Out of scope (fases siguientes):**
   - CRUD pecuario completo (sanidad, genealogía, marketplace, reportes).
   - Motor completo de resolución de conflictos multi-dispositivo.
   - Sincronización de multimedia avanzada.

Este recorte preserva el objetivo MVP y protege la arquitectura futura offline-first.

### Risks
- **Seguridad crítica actual:** el endpoint `/api/auth/token` permite emitir tokens sin credenciales fuertes; si no se corrige en esta fundación, invalida cualquier control de administración.
- **Riesgo de identidad de datos:** sin estrategia de IDs globales y versionado desde el inicio, offline sync posterior puede generar duplicados y conflictos no trazables.
- **Riesgo de contrato FE/BE:** si ganaderos se modela “solo para UI” ahora, luego habrá breaking changes en DTOs y APIs.
- **Riesgo de TDD:** hoy no hay tests backend; avanzar sin baseline de pruebas contradice `strict_tdd: true`.
- **Riesgo de alcance:** mezclar este cambio con módulos pecuarios amplios diluye el objetivo del foundation sprint.

### Ready for Proposal
**Yes** — listo para `sdd-propose` con alcance cerrado en fundación admin/ganaderos + decisiones de contrato offline-first obligatorias.
