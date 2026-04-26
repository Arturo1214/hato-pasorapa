# Proposal: Offline Sync Foundation V1

## Intent
**Problema**: hoy no hay operación offline real (sin PWA, sin cola durable, sin sync loop) y `animals` está fuera del contrato offline.

**Objetivo**: entregar base V1 offline-first FE/BE para capturar operaciones sin red, sincronizar con reintentos y tratar conflictos mínimos.

**Valor**: continuidad operativa en campo, menor pérdida de datos y contrato homogéneo para futuras iteraciones.

## Scope

### In Scope
- PWA instalable (`manifest` + service worker).
- Storage local durable (IndexedDB) para datos y metadatos de sync.
- Outbox/inbox local con envelope canónico: `operationId`, `entityType`, `entityId`, `opType`, `payload`, `attempts`, `nextAttemptAt`, `status`.
- Sync loop básico: trigger manual, app start y reconexión; push outbox + pull incremental por cursor.
- Retries con backoff exponencial + jitter y dead-letter.
- Conflictos mínimos con optimistic concurrency (`version`) + respuesta `409` estandarizada.
- Observabilidad mínima: pendientes/exitosas/fallidas y timestamp de último sync.
- Alineación inicial de `animals`: UUID + `version` + `updatedAt` + idempotencia.

### Out of Scope
- Merge automático/semántico de conflictos.
- Background Sync avanzado a nivel SO.
- Adjuntos binarios offline.
- Offline completo para todos los módulos.

## Capabilities

### New Capabilities
- `offline-pwa-shell`
- `offline-local-store`
- `offline-sync-loop`
- `offline-conflict-handling-minimal`
- `offline-contract-alignment-animals`

### Modified Capabilities
- None (no existen `openspec/specs/*/spec.md` base).

## Approach
Foundation vertical FE+BE: cliente queue-first (outbox/inbox) + endpoints backend de push/pull incremental con idempotencia. Prioriza consistencia contractual y observabilidad mínima.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/angular.json`, `hato-fe/public/` | Modified | Habilitar PWA. |
| `hato-fe/src/app/core/offline/**` | New | Storage, colas y orquestador sync. |
| `hato-fe/src/app/features/admin/**/data-access/*.ts` | Modified | Mutaciones queue-first. |
| `hato-be/src/main/java/**/{web/rest,service,repository,domain}/**` | Modified | Push/pull, conflictos, idempotencia. |
| `hato-be/src/main/resources/db/changelog/*.yaml` | Modified | Contrato offline y brecha `animals`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migración `animals` a UUID | Med | Migración transicional + rollback probado. |
| Divergencia FE/BE en contrato | Med | Envelope único + tests de contrato. |
| Scope creep | High | Scope gate V1 y backlog explícito. |

## Rollback Plan
Desactivar sync loop y volver a mutaciones online directas; conservar estructuras nuevas sin uso; revertir migraciones de `animals` con backup validado.

## Dependencies
- Configuración PWA en FE.
- Migraciones Liquibase.
- Contrato API sync acordado FE/BE.

## Success Criteria
- [ ] PWA instalable y uso offline de operaciones V1.
- [ ] 100% de mutaciones V1 se encolan sin red y reintentan al reconectar.
- [ ] Retries/backoff y dead-letter operativos y trazables.
- [ ] Conflictos por versión devuelven `409` consumible por UI.
- [ ] `animals` alineado al contrato offline mínimo.
- [ ] Métricas mínimas de sync visibles en FE/BE.
