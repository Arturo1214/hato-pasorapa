# animal-event-ledger-v1 Specification

## Purpose
Definir historial V1 auditable de eventos de animal como ledger append-only.

## Requirements

### Requirement: Append-only event ledger
The system MUST persist every `ANIMAL_EVENT` in `animal_events` using immutable rows keyed by event identity. It MUST support only V1 event types: `SOLD`, `DECEASED`, `LOST`, `TRANSFERRED`, `OBSERVATION`.

#### Scenario: Registro válido de evento V1
- GIVEN un `animalUuid` existente y `eventType=TRANSFERRED`
- WHEN se crea el evento
- THEN se inserta una nueva fila en `animal_events`
- AND no se modifica ningún evento histórico existente

#### Scenario: Tipo fuera de catálogo V1
- GIVEN payload con `eventType=SANITARY`
- WHEN se intenta registrar
- THEN el sistema rechaza por tipo no soportado

### Requirement: Audit ownership and traceability
The system MUST store `performedByUserId`, `sourceChannel`, `operationId`, `occurredAt`, `createdAt`, and `updatedAt` for each event. `TRANSFERRED` events SHALL include source and destination owner references.

#### Scenario: Auditoría mínima completa
- GIVEN creación de evento `SOLD`
- WHEN persiste exitosamente
- THEN quedan guardados autor, canal, operación y timestamps requeridos

### Requirement: Ledger query contract and boundaries
The system MUST return history by `animalUuid` with optional filters by `eventType` and date range, ordered deterministically by (`occurredAt`, `createdAt`, `eventId`). It MUST NOT include historial sanitario, reproductivo, ni adjuntos en V1.

#### Scenario: Consulta filtrada y orden estable
- GIVEN múltiples eventos del mismo animal
- WHEN se lista con filtro de tipo y rango
- THEN devuelve sólo coincidencias en orden estable
