# Delta for sync-entity-resolution-policy-v2

## MODIFIED Requirements

### Requirement: Entity and operation resolution policy contract

The system MUST publish a versioned policy matrix by `entity` and `opType` that declares allowed actions, UX hints, retry eligibility, and explicit exclusions (`MUST NOT resolve manually`), including `HERD_LOT`, `HERD_LOT_ASSIGNMENT`, `HERD_PRODUCTIVITY_LEDGER`, and `HERD_COST_LEDGER`.
(Previously: no incluía explícitamente entidades V2 de lotes, productividad y costos.)

#### Scenario: Política habilita solo acciones definidas

- GIVEN entidad/opType con política activa
- WHEN el cliente renderiza acciones de conflicto
- THEN solo expone acciones permitidas por la matriz

#### Scenario: Exclusión explícita bloquea resolución manual

- GIVEN entidad/opType marcado como excluido
- WHEN un usuario intenta resolver manualmente
- THEN el sistema rechaza la acción y conserva estado de conflicto

#### Scenario: New V2 entity follows declared policy

- GIVEN a conflict for `HERD_PRODUCTIVITY_LEDGER` or `HERD_COST_LEDGER`
- WHEN policy lookup runs
- THEN only declared actions for that entity/opType are applied
