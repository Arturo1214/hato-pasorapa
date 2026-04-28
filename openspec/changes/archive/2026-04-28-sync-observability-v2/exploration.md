## Exploration: sync-observability-v2

### Current State
El pipeline offline ya tiene base operativa sólida, pero la observabilidad de sync sigue siendo **mínima y global**:

- FE centraliza el ciclo push/pull en `SyncOrchestratorService` y hoy sólo publica un snapshot compacto (`pending`, `success`, `failed`, `syncing`, `lastSyncAt`, `lastMessage`, `manualRefreshRequired`) vía `SyncMetricsStore`.
- El outbox local en `OfflineStoreService` ya persiste estados ricos por operación (`pending`, `in_flight`, `retry_scheduled`, `failed`, `dead_letter`, `conflict`) y metadatos (`attempts`, `nextAttemptAt`, `lastErrorCode`, `lastErrorMessage`, `conflict`), pero no existe una vista consolidada de métricas operativas por entidad/ciclo.
- El backend persiste resultados por operación en `sync_operation_receipts` (clasificación, razón, versiones, payload/serverState), y ya expone conflictos V2 (`/api/sync/conflicts`), pero no expone un endpoint de “observabilidad de sync” ni agregados operativos listos para UI.
- En UI, la señal visible principal está embebida en `animals-page.component.ts` y dice estado general; no hay tablero transversal de salud de sync ni desglose de latencias, cola o errores por entidad.

Conclusión: el sistema ya guarda materia prima suficiente para observabilidad V2, pero falta un **modelo operacional explícito** (qué medir, dónde consolidar y cómo exponer) sin derivar en plataforma externa.

### Affected Areas
- `hato-fe/src/app/core/offline/sync-metrics.store.ts` — contrato actual demasiado acotado para métricas por ciclo/entidad/error.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — punto único para medir tiempos push/pull, resultados por operación y emisión de señales de refresh.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — fuente de verdad local para tamaño de cola, estados de outbox, conflictos y retries.
- `hato-fe/src/app/core/offline/offline-types.ts` — tipado para ampliar snapshot operacional sin romper consumidores existentes.
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — hoy consume señal global de sync; potencial consumidor de versión resumida V2.
- `hato-fe/src/app/features/admin/conflicts/data-access/admin-conflict-resolution.store.ts` — ya modela conflictos V2 y puede alimentar indicadores de conflicto pendientes/resueltos.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — lugar natural para publicar agregados operativos internos a partir de receipts/audit.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/SyncOperationReceipt.java` — base persistente para métricas históricas de errores/conflictos por entidad/opType.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncOperationReceiptRepository.java` — requiere consultas agregadas (por ventana, entidad, clasificación, estado de resolución).
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` — frontera API para agregar endpoint operativo V2 (interno al producto, no observabilidad externa).

### Approaches
1. **Observabilidad V2 local-first (FE como runtime source + BE como histórico agregado)**
   - Pros: mantiene arquitectura offline-first; bajo riesgo sobre contrato `/api/sync` existente; permite métricas en tiempo real (cola/latencia del ciclo) aunque no haya red.
   - Cons: exige disciplina para evitar duplicar lógica de agregación entre FE y BE; requiere definir claramente métricas “runtime” vs “históricas”.
   - Effort: Medium

2. **Observabilidad V2 backend-centric (BE calcula y FE sólo visualiza)**
   - Pros: agregados consistentes en un único punto; más simple para auditoría y comparativos históricos.
   - Cons: pierde señales útiles offline/inmediatas (cola local, latencia percibida de ciclo actual); acopla demasiado la UX a conectividad.
   - Effort: Medium/High

### Recommendation
Tomar **Approach 1** con alcance V2 explícitamente acotado a “operación de sync del producto” (no plataforma externa):

**In Scope V2**
1. **Métricas de ciclo de sync (runtime FE)**
   - duración total del ciclo (`cycleDurationMs`), duración push/pull por fase, trigger (`startup|manual|reconnect`), timestamp inicio/fin.
2. **Estado de cola pendiente y salud de outbox**
   - `pending`, `in_flight`, `retry_scheduled`, `failed`, `dead_letter`, `conflict`; conteos totales y por entidad.
3. **Errores y conflictos accionables**
   - códigos/razones más frecuentes (ventana corta), conflictos abiertos vs resueltos, operaciones bloqueadas por resolución manual.
4. **Estado por entidad para operación diaria**
   - último checkpoint (`cursorUpdatedAt`, `lastSuccessAt`) por `OfflineEntityType`, latencia desde último pull exitoso, bandera stale por entidad.
5. **Señales operativas de UI interna**
   - resumen compacto para pantallas admin (estado general + degradación), y detalle opcional para soporte operativo.
6. **Endpoint backend liviano de agregados históricos**
   - agregado por ventana corta (ej. 24h/7d) desde `sync_operation_receipts` y ledger de conflictos V2, sin integrar Prometheus/Grafana/ELK.

**Out of Scope V2**
- Integración con plataforma externa de monitoreo/APM (Prometheus, Grafana, Datadog, OpenTelemetry distribuido full).
- Alerting enterprise multi-canal (PagerDuty/Slack/email) con SLOs formales.
- Trazabilidad distribuida cross-service más allá del monolito actual.
- Reemplazo del pipeline sync vigente o rediseño de `/api/sync`.

### Risks
- **Scope creep a plataforma de monitoreo**: si no se acota, V2 se infla con requisitos de observabilidad enterprise fuera del MVP operativo.
- **Doble fuente inconsistente**: métricas runtime FE y agregados BE pueden divergir sin contrato semántico único.
- **Costo de performance local**: calcular demasiados agregados por ciclo puede impactar UX en dispositivos modestos.
- **Ruido operativo**: demasiadas señales sin jerarquía puede dificultar decisión (se necesita semaforización clara).
- **Strict TDD**: ampliar métricas sin matriz de tests por trigger/error/entidad puede introducir regresiones invisibles.

### Ready for Proposal
Yes — hay base suficiente para pasar a `sdd-propose` y fijar: (a) diccionario de métricas V2, (b) separación runtime FE vs histórico BE, (c) contratos de payload/endpoint, y (d) guardrails explícitos para NO convertirlo en monitoreo externo.
