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

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for `visit`, `checklist`, `clinicalNote`, and `protocol`; every block SHALL satisfy schema validation.

#### Scenario: Evento de visita con metadata completa

- GIVEN un payload `FIELD_VET_VISIT` válido con todos los bloques tipados
- WHEN se valida el evento
- THEN el sistema acepta y persiste el registro en el ledger

#### Scenario: Bloque tipado ausente

- GIVEN un `FIELD_VET_VISIT` sin bloque `clinicalNote`
- WHEN se valida el evento
- THEN el sistema MUST reject la operación por contrato incompleto

### Requirement: Tipos V1 y exclusiones explícitas

The system SHALL accept only `VACCINATION`, `DEWORMING`, `DISEASE_REPORTED`, `TREATMENT_STARTED`, `TREATMENT_FOLLOW_UP`, `TREATMENT_CLOSED`, `FIELD_VET_VISIT` for this change.
The system MUST NOT store reproduction events, image/attachment payloads, advanced clinical analytics, billing/costing, or complex prescription-rule payloads in this ledger.

#### Scenario: Evento permitido en catálogo V1

- GIVEN un payload `DISEASE_REPORTED` válido
- WHEN se procesa el alta
- THEN el sistema lo registra en el ledger sanitario

#### Scenario: Evento fuera de alcance

- GIVEN un payload de reproducción o con adjunto clínico
- WHEN se intenta registrar
- THEN el sistema MUST reject la operación por tipo fuera de alcance V1

### Requirement: Listado por visita dentro del animal

The system SHOULD allow filtering the per-animal health timeline by visit identifier in addition to `healthEventType` and occurredAt range.

#### Scenario: Filtro por visit identifier

- GIVEN múltiples eventos sanitarios ligados a visitas distintas del mismo animal
- WHEN se consulta con filtro por identificador de visita
- THEN el sistema devuelve solo eventos de esa visita

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
