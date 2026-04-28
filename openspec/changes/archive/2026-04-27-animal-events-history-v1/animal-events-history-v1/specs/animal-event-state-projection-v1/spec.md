# animal-event-state-projection-v1 Specification

## Purpose
Definir reglas mínimas para proyectar eventos V1 al estado operativo vigente del animal.

## Requirements

### Requirement: Current-state projection rules
The system MUST project V1 events onto `animals` with minimal mutation rules: `SOLD|DECEASED|LOST` SHALL set `active=false`; `TRANSFERRED` SHALL update current owner; `OBSERVATION` MUST NOT change core state fields.

#### Scenario: Proyección de baja operativa
- GIVEN un animal activo
- WHEN ingresa evento `DECEASED`
- THEN `active` pasa a `false`

#### Scenario: Proyección de observación sin mutación core
- GIVEN un animal activo con owner actual
- WHEN ingresa evento `OBSERVATION`
- THEN owner y estado operativo permanecen sin cambios

### Requirement: Deterministic replay behavior
The system MUST produce the same current state for equivalent event sets regardless of delivery retries, using deterministic ordering (`occurredAt`, `createdAt`, `eventId`) before projection.

#### Scenario: Replay fuera de orden temporal
- GIVEN dos eventos entregados en orden de red distinto
- WHEN se reprocesan con la precedencia definida
- THEN el estado actual final coincide con el esperado único

### Requirement: Projection acceptance and NFR limits
The system SHALL pass acceptance tests covering all V1 event types and transition rules. Projection SHALL remain bounded to operational fields and MUST NOT evolve into full event-sourced aggregate reconstruction in V1.

#### Scenario: Cobertura de reglas V1
- GIVEN suite de aceptación de proyección
- WHEN se ejecutan casos `SOLD|DECEASED|LOST|TRANSFERRED|OBSERVATION`
- THEN todas las reglas mínimas pasan sin efectos laterales fuera de alcance
