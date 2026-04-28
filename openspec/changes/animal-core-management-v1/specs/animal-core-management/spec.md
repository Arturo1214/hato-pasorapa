# animal-core-management Specification

## Purpose
Contrato V1 de ficha, identidad y ownership.

## Requirements

### Requirement: Ficha vigente y exclusiones
The system MUST expose only current-state animal data and MUST NOT include historial, eventos, imágenes ni transferencias históricas.

#### Scenario: Lectura de ficha
- GIVEN un animal registrado
- WHEN se consulta por `uuid`
- THEN responde sólo estado actual y metadatos vigentes

### Requirement: Identidad y ownership
The system MUST use `uuid` as external identity and MUST keep a single owner in `ownerGanaderoId`. Visible identifiers (`arete`, `marca`, `tatuaje`) SHALL be searchable only.

#### Scenario: Alta válida con propietario
- GIVEN payload válido con `ownerGanaderoId` existente
- WHEN se crea el animal
- THEN queda persistido con `uuid` estable y owner actual

#### Scenario: Edición con owner inválido
- GIVEN `ownerGanaderoId` inexistente
- WHEN se actualiza un animal
- THEN el sistema rechaza con error de referencia

### Requirement: Alta/edición y validaciones
The system MUST support CREATE/UPDATE with explicit validation: requeridos, formato y unicidad de visibles.

#### Scenario: Colisión de identificador visible
- GIVEN dos animales con mismo identificador normalizado en el mismo alcance
- WHEN se intenta guardar el segundo
- THEN se rechaza por unicidad

### Requirement: Acceptance criteria
The system SHALL pass tests proving alta/edición externas por `uuid` y exclusiones vigentes.

#### Scenario: Suite de aceptación core
- GIVEN pruebas de contrato
- WHEN se ejecutan casos create/update/read
- THEN no se usa `id` interno externo
