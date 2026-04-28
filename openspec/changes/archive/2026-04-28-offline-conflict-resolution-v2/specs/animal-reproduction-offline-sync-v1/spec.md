# Delta for animal-reproduction-offline-sync-v1

## MODIFIED Requirements

### Requirement: Idempotencia por operationId
The system MUST usar `operationId` como clave idempotente en push para evitar duplicados en reintentos, and MUST support conflict outcome handling (`accept_server|retry_local|discard_local`) before replaying blocked operations.
(Previously: la idempotencia evitaba duplicados, pero no definía resultados de conflicto previos al replay.)

#### Scenario: Reintento de operación ya aplicada
- GIVEN una operación previamente aplicada con `operationId` conocido
- WHEN el cliente reenvía la misma operación
- THEN el servidor responde sin crear duplicados

#### Scenario: Operación bloqueada por conflicto exige decisión
- GIVEN operación reproductiva con conflicto de estado
- WHEN se solicita replay sin decisión
- THEN el sistema deniega replay y exige resolución manual permitida
