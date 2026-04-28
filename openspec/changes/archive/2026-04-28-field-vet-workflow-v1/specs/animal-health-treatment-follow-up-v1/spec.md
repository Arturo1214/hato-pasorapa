# Delta for animal-health-treatment-follow-up-v1

## ADDED Requirements

### Requirement: Seguimiento básico alineado a protocolo de visita

The system MUST derive follow-up state from protocol lifecycle (`STARTED`/`FOLLOW_UP` => `ACTIVE`, `CLOSED` => `CLOSED`) and SHALL expose optional `nextDueAt` as upcoming control when present.

#### Scenario: Estado activo por protocolo en curso

- GIVEN eventos de visita con protocolo `STARTED` o `FOLLOW_UP`
- WHEN se consulta el seguimiento sanitario del animal
- THEN el sistema refleja estado derivado `ACTIVE`
- AND muestra `nextDueAt` si existe

#### Scenario: Cierre de protocolo

- GIVEN seguimiento activo del animal
- WHEN se registra protocolo con estado `CLOSED`
- THEN el sistema refleja estado derivado `CLOSED`

## MODIFIED Requirements

### Requirement: Vista básica de seguimiento por animal

The system SHOULD expose a basic per-animal treatment timeline including started/follow-up/closed events, vet-visit protocol states, and current derived status.
The system MAY include filtering by visit identifier when requested.
(Previously: solo contemplaba eventos de tratamiento y estado derivado, sin estados de protocolo de visita ni filtro por visita.)

#### Scenario: Timeline con estado derivado

- GIVEN un animal con eventos de tratamiento abiertos y cerrados
- WHEN se consulta su timeline sanitario
- THEN el sistema presenta la secuencia de eventos
- AND refleja estado derivado básico (activo o cerrado)

#### Scenario: Timeline mixto tratamiento + visita

- GIVEN un animal con eventos de tratamiento y eventos `FIELD_VET_VISIT`
- WHEN se consulta el timeline sanitario
- THEN el sistema integra ambos flujos en continuidad clínica básica
- AND mantiene estado derivado coherente con el protocolo más reciente
