## Exploration: offline-sync-users-ganaderos-v1

### Current State
La foundation offline ya está activa y funcional para `ANIMAL` (push/pull incremental real en backend + loop/orquestador FE). Para `USER` y `GANADERO`, el estado actual es **mixto**:

- **Frontend**
  - Ya existe cola offline (`OfflineStoreService`) con `entityType` `USER|GANADERO|ANIMAL` y orquestador global (`SyncOrchestratorService`) que intenta `push` + `pull` por todas las entidades soportadas.
  - `AdminUsersService` y `GanaderosService` ya aplican patrón queue-first para mutaciones no sensibles (`STATUS_UPDATE`, `GANADERO CREATE`) y snapshots locales.
  - `createUser` y `resetPassword` están bloqueadas offline explícitamente (online-only) por política de seguridad.
  - Hoy los servicios feature todavía hacen replay HTTP directo (`/api/admin/...`) para sus colas, en paralelo al orquestador global (riesgo de solapamiento si no se unifica).

- **Backend**
  - El contrato `/api/sync` existe, pero `SyncService` sólo procesa `ANIMAL`: cualquier `USER` o `GANADERO` en `push` devuelve `validation_error` (unsupported).
  - `pull` para `USER`/`GANADERO` retorna envelope vacío (cursor “placeholder”), no deltas reales incrementales.
  - `AdminUserService` y `GanaderoService` sí tienen idempotencia por `operation_log` y versionado/updatedAt en entidades, pero esa capacidad no está expuesta por el contrato incremental `/sync`.

Conclusión: la base offline está, pero `USER` y `GANADERO` todavía dependen de replay ad-hoc FE→REST admin; falta llevarlos al contrato sync incremental real sin violar la política de operaciones sensibles.

### Affected Areas
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` — eliminar replay directo para operaciones offline permitidas y alinear feedback con ciclo del orquestador.
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` — mismo ajuste (queue-first real sobre `/sync`, no doble canal).
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — confirmar clasificación/handling para resultados `USER`/`GANADERO` y consistencia de métricas/conflictos.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` — hoy cubre sólo `ANIMAL`; ampliar cobertura a escenarios multi-entidad.
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts` — ajustar expectativas de replay hacia sync central.
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts` — idem.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — agregar handlers de `USER` y `GANADERO` para subset permitido (sin operaciones sensibles offline).
- `hato-be/src/main/java/bo/pasorapa/hato/repository/UserRepository.java` — query incremental por cursor (`updatedAt`, `id`) para pull real.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/GanaderoRepository.java` — query incremental por cursor (`updatedAt`, `id`).
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/*` — mantener contrato canónico y mapear correctamente conflictos/serverVersion para nuevas entidades.
- `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` — agregar tests de push/pull incremental para `USER`/`GANADERO` y policy gate.
- `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` — validar contrato REST multi-entidad y rechazo explícito de operaciones sensibles.

### Approaches
1. **Extender `/sync` como canal único para operaciones offline permitidas de USER/GANADERO** — mover `STATUS_UPDATE` (USER/GANADERO) y `CREATE` de GANADERO al pipeline push/pull incremental central.
   - Pros: unifica semántica de idempotencia/conflicto/retry; elimina duplicación replay-feature; aprovecha foundation ya validada con `ANIMAL`.
   - Cons: requiere refactor coordinado FE/BE y migración de tests; puede romper UX si no se mantiene feedback claro mientras se procesa cola.
   - Effort: Medium

2. **Mantener replay directo en features y sólo sumar pull incremental para USER/GANADERO** — backend agrega deltas, pero push sigue distribuido por servicio.
   - Pros: cambio inicial menor en FE; menos refactor inmediato.
   - Cons: arquitectura inconsistente (dos canales de sync), más deuda técnica, mayor riesgo de drift de reglas de conflicto/retry.
   - Effort: Medium (corto plazo) / High (total)

### Recommendation
Recomiendo **Approach 1** con alcance V1.1 estricto y guardrails explícitos:

**IN scope (este change):**
1. `push` real para `USER STATUS_UPDATE`, `GANADERO CREATE`, `GANADERO STATUS_UPDATE`.
2. `pull` incremental real para `USER` y `GANADERO` (cursor `updatedAt + id`, misma semántica que ANIMAL).
3. Refactor FE para que operaciones offline permitidas dependan del orquestador `/sync` y no de replay HTTP feature-specific.
4. Mantener snapshots/inbox/metrics consistentes en UI para ambas entidades.
5. Tests FE/BE que prueben idempotencia, conflicto `409`, cursor y retry para `USER`/`GANADERO`.

**OUT of scope (NO entra):**
1. `createUser` offline.
2. `resetPassword` offline.
3. Resolución avanzada de conflictos (merge automático).
4. Rediseño de auth o permisos fuera de `/sync` actual.
5. Nuevas entidades (más allá de `USER` y `GANADERO`).

Esto preserva la política de seguridad vigente: operaciones con credenciales o alto impacto administrativo siguen online-only.

### Risks
- **Scope creep de seguridad**: intentar meter `createUser` o `PASSWORD_RESET` offline rompería el guardrail principal.
- **Doble envío accidental**: si no se desactiva replay directo en servicios feature, puede haber mutaciones duplicadas o estados inconsistentes.
- **Conflictos mal mapeados**: si `serverVersion`/`reason` no se devuelve homogéneo en USER/GANADERO, la UI puede clasificar mal errores.
- **Cursor inconsistente entre entidades**: una implementación distinta a `updatedAt + id` complica soporte y depuración.
- **Cobertura incompleta**: hoy los tests del orquestador están animal-centrados; sin ampliar suite, aumenta riesgo de regresión multi-entidad.

### Ready for Proposal
Yes — el change está suficientemente delimitado para pasar a `sdd-propose` con objetivo claro: llevar `USER`/`GANADERO` al contrato sync incremental real, sin tocar operaciones admin sensibles offline.
