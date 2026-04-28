# Delta for animal-health-offline-sync-v1

## MODIFIED Requirements

### Requirement: Idempotencia por operationId
The sync service MUST treat `operationId` as idempotency key for push and replay safety, and SHALL allow retry only after a valid manual conflict resolution compatible with entity/opType policy.
(Previously: idempotencia cubría replay, sin regla explícita de reintento post-resolución.)

#### Scenario: Replay del mismo evento
- GIVEN un evento sanitario ya aceptado con `operationId` X
- WHEN el cliente lo vuelve a enviar por reintento
- THEN el backend MUST NOT duplicar entradas en el ledger

#### Scenario: Reintento bloqueado sin resolución válida
- GIVEN una operación sanitaria en `CONFLICT`
- WHEN cliente intenta reintentar sin decisión manual válida
- THEN backend rechaza reintento y mantiene conflicto activo

#### Scenario: operationId faltante
- GIVEN una operación de sync sin `operationId`
- WHEN se valida en backend
- THEN el sistema MUST reject la operación por incumplir contrato de idempotencia
