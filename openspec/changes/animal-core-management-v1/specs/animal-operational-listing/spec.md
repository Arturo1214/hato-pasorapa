# animal-operational-listing Specification

## Purpose
Contrato de listados y filtros.

## Requirements

### Requirement: Listado mínimo
The system MUST return a paginable list with visible identifier, `ownerGanaderoId`, `category`, `active`.

#### Scenario: Listado base
- GIVEN animales vigentes cargados
- WHEN se consulta sin filtros
- THEN se devuelve página con campos operativos mínimos

### Requirement: Filtros y validación
The system MUST support filters by visible identifier, `ownerGanaderoId`, `active`, `category`; and MUST reject malformed payloads.

#### Scenario: Filtro combinado
- GIVEN dataset heterogéneo
- WHEN se filtra por owner + active + category
- THEN sólo se devuelven coincidencias válidas

#### Scenario: Filtro inválido
- GIVEN `active="si"`
- WHEN se consulta listado
- THEN responde error de validación explícito

### Requirement: Consistencia offline
The system SHOULD provide local listing in offline mode with pending/conflict markers.

#### Scenario: Listado offline
- GIVEN datos locales con operaciones pendientes
- WHEN usuario abre listado sin conectividad
- THEN ve resultados locales y marca de estado de sync

### Requirement: Acceptance criteria
The system SHALL pass tests proving filtros operan en API/UI online y offline.

#### Scenario: Aceptación de filtros
- GIVEN pruebas de listado
- WHEN se ejecutan online/offline
- THEN filtros clave conservan comportamiento

## Non-Functional Constraints
- Contrato de filtros MUST remain stable para clientes offline-first.
