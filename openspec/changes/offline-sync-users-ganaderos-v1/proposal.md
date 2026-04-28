# Proposal: Offline Sync Users y Ganaderos v1

## Intent
Completar la sync offline real para `USER` y `GANADERO`. Hoy hay doble canal (replay por feature + orquestador global), lo que puede generar duplicados y reglas divergentes. Este change unifica el canal y mantiene seguridad en operaciones sensibles.

## Scope

### In Scope
- Push `/api/sync` para `USER STATUS_UPDATE`, `GANADERO CREATE`, `GANADERO STATUS_UPDATE`.
- Pull incremental real para `USER` y `GANADERO` con cursor `updatedAt + id`.
- Remover/corregir el doble canal: operaciones offline permitidas sólo por orquestador global + `/sync`.
- Mantener snapshots/métricas/conflictos/retry consistentes en FE.
- Tests FE/BE para idempotencia, `409`, cursor y retry multi-entidad.

### Out of Scope
- `createUser` offline (**sigue online-only**).
- `resetPassword` offline (**sigue online-only**).
- Merge automático avanzado de conflictos.
- Cambios de auth/permisos fuera de `/sync`.
- Nuevas entidades offline (más allá de `USER` y `GANADERO`).

## Capabilities

### New Capabilities
- `offline-sync-users`: Sync incremental de `USER` para `STATUS_UPDATE` con idempotencia y conflictos.
- `offline-sync-ganaderos`: Sync incremental de `GANADERO` para `CREATE` y `STATUS_UPDATE`.
- `offline-sync-channel-unification`: Canal único en FE (sin replay por feature).

### Modified Capabilities
- None.

## Approach
Aplicar Approach 1: extender `SyncService` + repositorios BE para push/pull `USER`/`GANADERO`, y en FE eliminar replay HTTP ad-hoc en `AdminUsersService`/`GanaderosService`, delegando al orquestador global. Tradeoff: más refactor corto plazo, menor deuda y menor riesgo operativo largo plazo.

## Affected Areas
`SyncService.java`, `UserRepository.java`, `GanaderoRepository.java`, `sync-orchestrator.service.ts`, `admin-users.service.ts`, `ganaderos.service.ts`, y sus `*.spec.ts`/tests backend de sync.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep de seguridad | Med | Tests de rechazo offline para `createUser`/`resetPassword`. |
| Duplicación por doble canal residual | Med/High | Eliminar replay por feature y validar camino único en tests FE. |
| Cursor/conflictos inconsistentes | Med | Reusar semántica `ANIMAL` y pruebas de contrato REST/service. |

## Rollback Plan
Revertir soporte `USER/GANADERO` en `/sync` y restaurar temporalmente replay previo solo para operaciones ya online. Verificar que flujo `ANIMAL` no regrese.

## Dependencies
- Foundation offline `ANIMAL` operativa.
- `operation_log`, `updatedAt` y manejo `409` ya disponibles.

## Success Criteria
- [ ] `USER STATUS_UPDATE`, `GANADERO CREATE`, `GANADERO STATUS_UPDATE` sincronizan por `/api/sync` sin replay por feature.
- [ ] `createUser` y `resetPassword` continúan online-only con error offline explícito.
- [ ] Pull incremental `USER`/`GANADERO` devuelve deltas + cursor estable `updatedAt + id`.
- [ ] Tests FE/BE multi-entidad pasan sin regresión en `ANIMAL`.
