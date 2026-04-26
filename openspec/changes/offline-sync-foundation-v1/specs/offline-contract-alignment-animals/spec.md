# offline-contract-alignment-animals Specification

## Purpose
Alinear `animals` al contrato mínimo requerido por foundation offline.

## Requirements

### Requirement: Animals Offline Contract Fields
The system MUST expose `animals` records with stable UUID identity, monotonic `version`, and authoritative `updatedAt` suitable for incremental synchronization.

#### Scenario: Contract-compliant read model
- GIVEN an `animals` record persisted in backend
- WHEN record is returned to sync consumers
- THEN response includes UUID, `version`, and `updatedAt`

### Requirement: Idempotent Mutation and Sync Compatibility
The system MUST support idempotent operation processing keyed by operation identity and MUST integrate `animals` changes into push/pull sync contract.

#### Scenario: Idempotent replay
- GIVEN the same operation is submitted more than once
- WHEN backend processes duplicates
- THEN only one state mutation is applied and duplicates are acknowledged safely

#### Scenario: Incremental pull alignment
- GIVEN `animals` changed after last checkpoint
- WHEN incremental pull is requested
- THEN `animals` deltas are returned according to cursor and contract shape
