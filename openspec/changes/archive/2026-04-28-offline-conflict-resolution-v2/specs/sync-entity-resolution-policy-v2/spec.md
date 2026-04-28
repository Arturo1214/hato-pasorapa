# sync-entity-resolution-policy-v2 Specification

## Purpose
Definir políticas explícitas por entidad/opType para acciones de resolución permitidas y exclusiones.

## Requirements

### Requirement: Entity and operation resolution policy contract
The system MUST publish a versioned policy matrix by `entity` and `opType` that declares allowed resolution actions, UX hints, retry eligibility, and explicit exclusions (`MUST NOT resolve manually` cases).

#### Scenario: Política habilita solo acciones definidas
- GIVEN entidad/opType con política activa
- WHEN el cliente renderiza acciones de conflicto
- THEN solo expone acciones permitidas por la matriz

#### Scenario: Exclusión explícita bloquea resolución manual
- GIVEN entidad/opType marcado como excluido
- WHEN un usuario intenta resolver manualmente
- THEN el sistema rechaza la acción y conserva estado de conflicto
