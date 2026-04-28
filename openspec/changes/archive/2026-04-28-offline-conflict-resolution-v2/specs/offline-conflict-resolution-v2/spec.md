# offline-conflict-resolution-v2 Specification

## Purpose
Definir contrato transversal para diff visual, resolución manual y reintento post-resolución en conflictos offline de `/api/sync`.

## Requirements

### Requirement: Visual conflict diff and manual decision workflow
The system MUST expose, per conflicted `operationId`, a visual diff (`local payload` vs `server state`) with field-level severity, and MUST allow only `accept_server`, `retry_local`, or `discard_local` according to entity/opType policy.

#### Scenario: Diff visible y opciones válidas
- GIVEN una operación en estado `CONFLICT`
- WHEN el usuario abre detalle de conflicto
- THEN el sistema muestra diff por campo con severidad
- AND muestra solo acciones permitidas por policy

#### Scenario: Reintento posterior a resolución
- GIVEN un conflicto resuelto con `retry_local`
- WHEN se ejecuta el siguiente ciclo de sync
- THEN la operación se reprocesa respetando idempotencia por `operationId`
