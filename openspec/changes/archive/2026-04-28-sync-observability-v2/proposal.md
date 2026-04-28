# Proposal: Sync Observability V2

## Intent

Definir observabilidad operacional del pipeline offline sync con enfoque híbrido: señales runtime en FE + agregados históricos en BE. Se busca mejorar diagnóstico diario (cola, latencia, errores, conflictos, estado por entidad) sin convertir V2 en plataforma enterprise.

## Scope

### In Scope
- Diccionario V2 de métricas de ciclo: duración total, fases push/pull, trigger, inicio/fin.
- Snapshot runtime FE: estado de cola y outbox (`pending`, `in_flight`, `retry_scheduled`, `failed`, `dead_letter`, `conflict`) total y por entidad.
- Métricas accionables de errores/conflictos: top códigos/razones, abiertos vs resueltos, operaciones bloqueadas.
- Estado por entidad (`OfflineEntityType`): `cursorUpdatedAt`, `lastSuccessAt`, latencia/staleness por entidad.
- Endpoint BE de agregados históricos (24h/7d) desde `sync_operation_receipts` + ledger de conflictos.

### Out of Scope
- Integración APM/monitoreo externo (Prometheus, Grafana, Datadog, OpenTelemetry).
- Alerting enterprise/SLOs formales (PagerDuty, Slack, email).
- Trazas distribuidas cross-service y rediseño de `/api/sync`.

## Capabilities

### New Capabilities
- `sync-observability-runtime-history-v2`: contrato de observabilidad híbrida con métricas runtime FE y agregados históricos BE para operación interna.

### Modified Capabilities
- None.

## Approach

Implementar contrato semántico único de métricas V2 con dos planos: (1) FE calcula/expone runtime inmediato por ciclo y entidad, (2) BE consolida histórico agregado por ventanas. UI consume resumen operativo + detalle opcional, priorizando consistencia semántica entre ambos planos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/sync-metrics.store.ts` | Modified | Expandir snapshot V2 y selectores operativos |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Instrumentar métricas por ciclo/fase/trigger |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Exponer conteos por estado/entidad y conflicto |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncOperationReceiptRepository.java` | Modified | Consultas agregadas por ventana/entidad/resultado |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modified | Endpoint de observabilidad histórica V2 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Divergencia FE runtime vs BE histórico | Med | Diccionario único de métricas y tests de contrato |
| Scope creep a observabilidad enterprise | High | Exclusiones explícitas y criterios de salida V2 |
| Sobrecarga en dispositivos modestos | Med | Agregación incremental y payload compacto |

## Rollback Plan

Feature-flag de snapshot/endpoint V2; si hay degradación, revertir al snapshot actual de `SyncMetricsStore` y deshabilitar endpoint histórico sin tocar pipeline `/api/sync`.

## Dependencies

- `sdd/sync-observability-v2/explore` y `openspec/changes/sync-observability-v2/exploration.md`.
- Conflictos V2 y receipts existentes (`offline-conflict-resolution-v2`, `sync-conflict-audit-ledger-v2`).

## Success Criteria

- [ ] Existe contrato V2 con métricas de ciclo, cola, latencia, errores, conflictos y estado por entidad.
- [ ] FE publica snapshot runtime V2 sin romper consumidores actuales.
- [ ] BE expone agregados 24h/7d consistentes con semántica FE.
- [ ] Queda explícitamente excluido APM/alerting enterprise en specs y tareas.
