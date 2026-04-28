# animal-health-event-ledger-v1 Specification

## Purpose

Definir un ledger sanitario append-only por animal para vacunaciones, desparasitaciones, enfermedades y tratamientos, separado del ledger operativo.

## Requirements

### Requirement: Registro sanitario tipado y auditable

The system MUST persist each health event as append-only with required fields: `animalUuid`, `healthEventType`, `occurredAt`, `performedByUserId`, `sourceChannel`, `operationId`, and typed `metadata`; `notes` MAY be empty.

#### Scenario: Alta válida de vacunación

- GIVEN un animal existente y un payload `VACCINATION` con campos obligatorios y metadata tipada
- WHEN se registra el evento
- THEN el sistema crea una nueva entrada inmutable en `animal_health_events`
- AND conserva trazabilidad por `performedByUserId`, `sourceChannel` y `operationId`

#### Scenario: Rechazo por metadata inválida

- GIVEN un payload `DEWORMING` sin estructura de metadata esperada
- WHEN se valida el evento
- THEN el sistema MUST reject la operación con error de contrato

### Requirement: Tipos V1 y exclusiones explícitas

The system SHALL accept only `VACCINATION`, `DEWORMING`, `DISEASE_REPORTED`, `TREATMENT_STARTED`, `TREATMENT_FOLLOW_UP`, `TREATMENT_CLOSED` for this change.
The system MUST NOT store reproduction events, image/attachment payloads, or advanced clinical analytics in this ledger.

#### Scenario: Evento permitido en catálogo V1

- GIVEN un payload `DISEASE_REPORTED` válido
- WHEN se procesa el alta
- THEN el sistema lo registra en el ledger sanitario

#### Scenario: Evento fuera de alcance

- GIVEN un payload de reproducción o con adjunto clínico
- WHEN se intenta registrar
- THEN el sistema MUST reject la operación por tipo fuera de alcance V1

### Requirement: Listado sanitario por animal

The system MUST provide a health timeline by `animalUuid`, and SHOULD allow filters by `healthEventType` and occurredAt range.

#### Scenario: Listado base por animal

- GIVEN múltiples eventos sanitarios de distintos animales
- WHEN se consulta por `animalUuid`
- THEN el sistema devuelve solo eventos del animal solicitado

#### Scenario: Filtros por tipo y rango

- GIVEN eventos del mismo animal en diferentes fechas y tipos
- WHEN se consulta con filtro por tipo y rango temporal
- THEN el sistema devuelve solo los eventos que cumplen ambos filtros
