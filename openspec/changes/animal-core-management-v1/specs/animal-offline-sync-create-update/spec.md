# animal-offline-sync-create-update Specification

## Purpose
Contrato offline-first de CREATE/UPDATE `ANIMAL` con outbox y `/sync`.

## Requirements

### Requirement: Alta/edición offline
The system MUST allow CREATE/UPDATE without connectivity and MUST persist pending ops by `uuid`.

#### Scenario: CREATE offline
- GIVEN el dispositivo offline
- WHEN el usuario registra un animal válido
- THEN la operación queda en outbox como pendiente

#### Scenario: UPDATE offline
- GIVEN un animal local
- WHEN el usuario lo edita offline
- THEN se encola UPDATE referenciado por `uuid`

### Requirement: Sync compatible
The system SHALL process `ANIMAL CREATE/UPDATE` through `/sync` preserving conflict/version semantics.

#### Scenario: Sync exitoso
- GIVEN operaciones pendientes válidas
- WHEN vuelve conectividad y corre `/sync`
- THEN backend confirma y limpia pendientes aplicados

#### Scenario: Conflicto de versión
- GIVEN UPDATE con versión obsoleta
- WHEN `/sync` lo procesa
- THEN devuelve conflicto según contrato existente

### Requirement: Acceptance criteria
The system SHALL pass regression: ANIMAL no rompe sync foundation y recupera pendientes offline.

#### Scenario: Regresión sync
- GIVEN suite foundation + ANIMAL
- WHEN se ejecuta CREATE/UPDATE offline-online
- THEN contratos previos siguen válidos
