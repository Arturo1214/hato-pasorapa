# Delta for animal-health-event-ledger-v1

## ADDED Requirements

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

### Requirement: Listado por visita dentro del animal

The system SHOULD allow filtering the per-animal health timeline by visit identifier in addition to `healthEventType` and occurredAt range.

#### Scenario: Filtro por visit identifier

- GIVEN múltiples eventos sanitarios ligados a visitas distintas del mismo animal
- WHEN se consulta con filtro por identificador de visita
- THEN el sistema devuelve solo eventos de esa visita

## MODIFIED Requirements

### Requirement: Tipos V1 y exclusiones explícitas

The system SHALL accept only `VACCINATION`, `DEWORMING`, `DISEASE_REPORTED`, `TREATMENT_STARTED`, `TREATMENT_FOLLOW_UP`, `TREATMENT_CLOSED`, `FIELD_VET_VISIT` for this change.
The system MUST NOT store reproduction events, image/attachment payloads, advanced clinical analytics, billing/costing, or complex prescription-rule payloads in this ledger.
(Previously: no incluía `FIELD_VET_VISIT` ni explicitaba exclusión de billing/prescripción compleja.)

#### Scenario: Evento permitido en catálogo V1

- GIVEN un payload `DISEASE_REPORTED` válido
- WHEN se procesa el alta
- THEN el sistema lo registra en el ledger sanitario

#### Scenario: Evento fuera de alcance

- GIVEN un payload de reproducción o con adjunto clínico
- WHEN se intenta registrar
- THEN el sistema MUST reject la operación por tipo fuera de alcance V1

#### Scenario: Visita veterinaria permitida

- GIVEN un payload `FIELD_VET_VISIT` válido
- WHEN se procesa el alta
- THEN el sistema registra el evento en el ledger sanitario
