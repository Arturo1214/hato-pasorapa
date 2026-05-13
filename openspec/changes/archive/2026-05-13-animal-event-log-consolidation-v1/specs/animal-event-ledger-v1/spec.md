# Delta for animal-event-ledger-v1

## MODIFIED Requirements

### Requirement: Append-only event ledger

The system MUST persist every `ANIMAL_EVENT` in the unified `animal_event_log` using immutable rows keyed by event identity, with `eventCategory=GENERAL`. It MUST support only V1 event types: `SOLD`, `DECEASED`, `LOST`, `TRANSFERRED`, `OBSERVATION`. The underlying storage MAY be a unified table; the contract is that these events are queryable via the general event ledger interface.

(Previously: persist in `animal_events` table)

#### Scenario: Registro válido de evento V1 vía unified log

- GIVEN un `animalUuid` existente y `eventType=TRANSFERRED`
- WHEN se crea el evento
- THEN se inserta una nueva fila en unified log con `eventCategory=GENERAL`
- AND no se modifica ningún evento histórico existente

#### Scenario: Tipo fuera de catálogo V1

- GIVEN payload con `eventType=SANITARY`
- WHEN se intenta registrar
- THEN el sistema rechaza por tipo no soportado

### Requirement: Audit ownership and traceability

The system MUST store `performedByUserId`, `sourceChannel`, `operationId`, `occurredAt`, `createdAt`, and `updatedAt` for each event. `TRANSFERRED` events SHALL include source and destination owner references. These fields MUST be stored identically regardless of whether the underlying storage is unified or partitioned.

#### Scenario: Auditoría mínima completa

- GIVEN creación de evento `SOLD`
- WHEN persiste exitosamente
- THEN quedan guardados autor, canal, operación y timestamps requeridos

### Requirement: Ledger query contract and boundaries

The system MUST return history by `animalUuid` with optional filters by `eventType` and date range, ordered deterministically by (`occurredAt`, `createdAt`, `eventId`). It MUST NOT include health events when filtering by general ledger scope.

#### Scenario: Consulta filtrada y orden estable

- GIVEN múltiples eventos del mismo animal across categories
- WHEN se lista con filtro de tipo y rango
- THEN devuelve sólo coincidencias en orden estable
