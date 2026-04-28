# Delta for animal-event-offline-sync-v1

## MODIFIED Requirements

### Requirement: Idempotent sync replay
The system MUST sync queued events through existing push/pull channel, MUST emit conflict metadata when replay cannot be applied, and MUST enforce idempotency by `operationId` so duplicate replays do not create duplicated ledger rows nor duplicated projection effects.
(Previously: replay duplicado era idempotente pero no exigía metadata/hook de resolución ante conflicto.)

#### Scenario: Replay duplicado
- GIVEN el mismo `operationId` enviado más de una vez
- WHEN backend procesa reintentos
- THEN existe una sola inserción efectiva y una sola proyección resultante

#### Scenario: Replay en conflicto requiere hook de resolución
- GIVEN una operación en replay rechazada por estado servidor incompatible
- WHEN backend responde el ciclo de sync
- THEN retorna `status=CONFLICT` con metadata mínima para diff y resolución manual
