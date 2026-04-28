# Delta for animal-image-offline-sync-v1

## MODIFIED Requirements

### Requirement: Incremental push/pull reconciliation
The system MUST push pending `ANIMAL_IMAGE` operations when connectivity is restored, MUST reconcile local status to `SYNCED` only after server acknowledgment for the same `operationId`, MAY keep failed operations as `FAILED` for retry, and MUST expose manual conflict resolution for image-specific failures according to policy exclusions.
(Previously: reconciliaba estados y fallas parciales, sin resolución manual/políticas de exclusión explícitas.)

#### Scenario: Reconciliación exitosa post-conectividad
- GIVEN operaciones `PENDING` en cola
- WHEN el push recibe confirmación del servidor
- THEN las operaciones quedan `SYNCED`
- AND el listado local refleja estado reconciliado

#### Scenario: Falla parcial de sincronización
- GIVEN 3 operaciones pendientes
- WHEN 1 falla validación y 2 son aceptadas
- THEN 2 pasan a `SYNCED` y 1 queda `FAILED`

#### Scenario: Conflicto de imagen excluido de resolución manual
- GIVEN una falla de imagen marcada como exclusión explícita por policy
- WHEN usuario intenta `accept_server` o `retry_local`
- THEN el sistema MUST NOT aceptar la resolución manual y deja conflicto para manejo estándar
