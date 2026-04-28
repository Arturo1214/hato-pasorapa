# animal-health-treatment-follow-up-v1 Specification

## Purpose

Definir seguimiento básico de tratamientos por eventos append-only de inicio, continuidad y cierre.

## Requirements

### Requirement: Continuidad de tratamiento sin updates destructivos

The system MUST model treatment lifecycle using `TREATMENT_STARTED`, `TREATMENT_FOLLOW_UP`, and `TREATMENT_CLOSED` as separate appended events.

#### Scenario: Inicio y seguimiento

- GIVEN un animal con diagnóstico reportado
- WHEN se registra `TREATMENT_STARTED` y luego `TREATMENT_FOLLOW_UP`
- THEN el sistema conserva ambos eventos en orden temporal
- AND no sobrescribe el evento inicial

#### Scenario: Cierre posterior

- GIVEN un tratamiento activo
- WHEN se registra `TREATMENT_CLOSED`
- THEN el sistema agrega el cierre como nuevo evento del mismo hilo clínico

### Requirement: Metadata mínima tipada para tratamiento

The system MUST require typed treatment metadata at least for regimen/medication reference and status note per treatment event type.

#### Scenario: Metadata válida en seguimiento

- GIVEN un `TREATMENT_FOLLOW_UP` con metadata tipada completa
- WHEN se valida el evento
- THEN el sistema acepta y persiste el seguimiento

#### Scenario: Metadata incompleta

- GIVEN un `TREATMENT_STARTED` sin referencia mínima de régimen/medicación
- WHEN se valida
- THEN el sistema MUST reject la operación por metadata insuficiente

### Requirement: Vista básica de seguimiento por animal

The system SHOULD expose a basic per-animal treatment timeline including started/follow-up/closed events and current derived status.

#### Scenario: Timeline con estado derivado

- GIVEN un animal con eventos de tratamiento abiertos y cerrados
- WHEN se consulta su timeline sanitario
- THEN el sistema presenta la secuencia de eventos
- AND refleja estado derivado básico (activo o cerrado)
