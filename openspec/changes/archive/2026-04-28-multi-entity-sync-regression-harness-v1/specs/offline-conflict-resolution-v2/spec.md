# Delta for offline-conflict-resolution-v2

## MODIFIED Requirements

### Requirement: Visual conflict diff and manual workflow
The system MUST expose, per conflicted `operationId`, a visual diff (`local payload` vs `server state`) with field severity, and MUST allow only `accept_server`, `retry_local`, or `discard_local` by entity/opType policy; in mixed batches, resolution and post-resolution retry MUST preserve idempotency and ordering for unaffected operations.
(Previously: mixed-batch chaining was not explicit.)

#### Scenario: Diff visible y opciones válidas
- GIVEN una operación en estado `CONFLICT`
- WHEN el usuario abre detalle de conflicto
- THEN el sistema muestra diff por campo con severidad

#### Scenario: Reintento posterior a resolución
- GIVEN un conflicto resuelto con `retry_local`
- WHEN se ejecuta el siguiente ciclo de sync
- THEN la operación se reprocesa respetando idempotencia por `operationId`

#### Scenario: Conflicto encadenado en lote mixto
- GIVEN un lote mixto con una operación en conflicto y otras válidas
- WHEN se resuelve el conflicto y corre el retry posterior
- THEN operaciones no conflictuadas no se duplican ni reordenan
