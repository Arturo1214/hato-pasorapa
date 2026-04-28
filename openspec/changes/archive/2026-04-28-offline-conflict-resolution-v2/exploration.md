## Exploration: offline-conflict-resolution-v2

### Current State
La base offline-first ya está madura: `SyncOrchestratorService` centraliza push/pull multi-entidad, el backend `/api/sync` soporta operaciones permitidas por matriz (`SyncPayloadMapper`), y los conflictos se clasifican como `version_conflict`/`validation_error` con `resolutionHint`.

Hoy, la resolución real es **mínima**:
- El FE persiste conflicto en outbox (`status: conflict`) y expone solo señal global `manualRefreshRequired` + mensaje general.
- No existe vista dedicada para comparar **payload local vs estado remoto** por operación.
- No hay flujo de resolución manual estructurado (aceptar remoto, reintentar con cambios, descartar local) por entidad.
- La política offline por entidad/opType existe en backend, pero está hardcodeada en `SyncPayloadMapper` (sin contrato de política legible por FE ni versionado explícito).
- El backend guarda auditoría técnica de resultados en `sync_operation_receipts`, pero no existe un ledger consultable de conflictos para soporte/operación.

Conclusión: V1 cubre detección + bloqueo seguro; falta capa V2 de **resolución operativa** y **observabilidad de conflictos** sin romper el canal sync existente.

### Affected Areas
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — actualmente clasifica conflictos y marca estados, pero no arma artefacto de diff ni acciones de resolución.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — persiste conflicto en outbox/snapshots; requiere extender metadatos/índices para historial y workflow manual.
- `hato-fe/src/app/core/offline/offline-types.ts` — contrato de conflicto hoy es mínimo (`reason`, `serverVersion`, `serverState`); V2 necesita tipos de diff/resolution/audit.
- `hato-fe/src/app/core/offline/conflict-mapper.ts` — hoy mapea a mensaje simple; punto natural para normalizar códigos, hints y severidad por entidad.
- `hato-fe/src/app/features/admin/**` (users/ganaderos/animals/events/health/reproduction/images) — consumen snapshots con badges básicos; no hay UI transversal de resolución de conflictos.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — emite `SyncConflictResponse`; V2 puede ampliar metadata de conflicto y hooks de auditoría.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — matriz de capacidad offline hardcodeada; candidato para externalizar/estructurar políticas por entidad.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/SyncOperationReceipt.java` + repositorio — almacena resultado por `operationId`; base para auditoría V2, pero sin consulta funcional dedicada.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` — único contrato sync; V2 debe mantener compatibilidad y sumar endpoints de auditoría/resolución si hace falta.
- Tests: `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`, `hato-be/src/test/java/.../SyncServiceTest.java`, `SyncResourceTest.java` — ampliar cobertura strict TDD para diff/resolution/policies/audit.

### Approaches
1. **V2 incremental sobre contrato sync actual** — agregar capa de conflicto en FE + metadatos/auditoría en BE sin rediseñar `/api/sync`.
   - Pros: menor riesgo arquitectónico; respeta offline-first; reutiliza outbox/checkpoints/receipts existentes; rollout por feature flag.
   - Cons: puede dejar deuda de modelado si se fuerza demasiado sobre estructuras V1; requiere disciplina para no dispersar reglas por feature.
   - Effort: Medium

2. **Subdominio nuevo de conflicto con contrato dedicado completo** — crear API/entidades específicas de conflictos + resolución transaccional separada del sync loop.
   - Pros: separación conceptual fuerte, trazabilidad más limpia para soporte y compliance.
   - Cons: mayor costo y riesgo; duplica conceptos de `sync_operation_receipts`; más superficie de fallas para MVP operativo.
   - Effort: High

### Recommendation
Tomar **Approach 1** con alcance V2 bien delimitado:

**In Scope V2**
1. **Diff visual por conflicto**: construir modelo canónico FE con `clientPayloadSnapshot`, `serverState`, campos divergentes y severidad.
2. **Resolución manual guiada**: acciones mínimas por operación (`accept_server`, `retry_local`, `discard_local`) con actualización consistente de outbox/snapshots.
3. **Políticas por entidad explícitas**: publicar/normalizar capability policy (`entityType + opType + resolutionOptions`) para evitar hardcode opaco y facilitar UX contextual.
4. **Auditoría de conflictos**: persistir y consultar historial de conflictos/resoluciones (sobre `sync_operation_receipts` + extensión), incluyendo actor, timestamp, decisión y motivo.
5. **Compatibilidad estricta**: mantener `/api/sync` como backbone; no romper idempotencia por `operationId`, cursores ni comportamiento offline existente.

**Out of Scope V2**
- Merge automático inteligente por dominio (CRDT/OT).
- Reconciliación en tiempo real multi-dispositivo fuera del ciclo push/pull actual.
- Rediseño completo del modelo de permisos/auth.
- Cambios de foundation PWA/IndexedDB fuera de lo necesario para conflicto.

### Risks
- **Scope creep funcional**: intentar resolver “todo” conflicto por dominio en V2 (especialmente eventos reproductivos/sanitarios) puede romper entregabilidad.
- **Inconsistencia UX**: si el diff/resolución no es transversal, cada feature podría implementar variantes incompatibles.
- **Auditoría incompleta**: registrar solo conflicto técnico sin decisión humana limita trazabilidad operativa.
- **Contratos ambiguos**: si política por entidad no queda explícita/versionada, FE y BE pueden divergir.
- **Riesgo TDD**: con `strict_tdd: true`, falta de matriz de tests por entidad/resolución puede generar regresiones silenciosas.

### Ready for Proposal
Yes — hay contexto suficiente para pasar a `sdd-propose` definiendo objetivos, límites y estrategia de rollout de `offline-conflict-resolution-v2` en modo incremental sobre la sync actual.
