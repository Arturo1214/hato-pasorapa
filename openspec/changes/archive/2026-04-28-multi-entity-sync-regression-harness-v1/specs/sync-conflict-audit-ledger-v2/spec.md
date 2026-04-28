# Delta for sync-conflict-audit-ledger-v2

## MODIFIED Requirements

### Requirement: Conflict and resolution audit trail
The system MUST persist one immutable audit record for conflict detection and one for each manual resolution attempt, including `operationId`, actor, timestamp, reason, decision, and result; duplicate deliveries and repeated conflicts for the same `operationId` MUST append new events without overwriting prior records.
(Previously: duplicate/repeated append behavior was not explicit.)

#### Scenario: Registro obligatorio al resolver
- GIVEN un conflicto existente
- WHEN un usuario confirma `accept_server`
- THEN se guarda entrada con actor, timestamp, motivo y resultado

#### Scenario: Historial consultable por operación
- GIVEN una operación con múltiples intentos de resolución
- WHEN se consulta por `operationId`
- THEN el sistema retorna la secuencia cronológica completa

#### Scenario: Duplicado y conflicto repetido
- GIVEN entregas duplicadas y nuevos conflictos sobre el mismo `operationId`
- WHEN se registra auditoría
- THEN cada evento se agrega en orden temporal
