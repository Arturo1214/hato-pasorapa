# Offline Backup Local Continuity V1 Specification

## Purpose

Definir export/import/restore local-first para continuidad operativa offline con contrato verificable, validación fuerte y recuperación sin estado parcial.

## Requirements

### Requirement: Export Payload Contract and Explicit Exclusions

The system MUST export a single JSON payload with `backupVersion`, `createdAt`, `sourceSchemaVersion`, domain data snapshot, and `images` section; it MUST support explicit image exclusion mode and SHALL mark exclusions in metadata.

#### Scenario: Export with images included
- GIVEN an ADMIN triggers local export with image inclusion enabled
- WHEN export completes
- THEN the payload contains data snapshot, image binaries metadata, and integrity section

#### Scenario: Export with images excluded
- GIVEN an ADMIN triggers local export with image inclusion disabled
- WHEN export completes
- THEN the payload omits binary blobs and marks `images.excluded=true`

### Requirement: Strong Import Validation Before Mutation

The system MUST validate structure, required fields, version compatibility, schema compatibility, and integrity references before any restore mutation starts.

#### Scenario: Valid payload accepted
- GIVEN a payload matching contract and compatible versions
- WHEN import validation runs
- THEN validation passes and restore may proceed

#### Scenario: Corrupt or incompatible payload rejected
- GIVEN a payload with missing fields, bad version, or invalid integrity references
- WHEN import validation runs
- THEN import is rejected with actionable error and no local state changes

### Requirement: Transactional Restore and Ordered Rehydration

The system MUST execute restore as an all-or-nothing transaction; if any write, migration, or normalization step fails, it MUST rollback completely and SHALL leave pre-restore state intact.

#### Scenario: Full restore success
- GIVEN a valid payload and healthy local stores
- WHEN restore runs
- THEN all stores are replaced atomically and post-restore rehydration is executed in defined order

#### Scenario: Restore failure rolls back all changes
- GIVEN a valid payload but a failure during transaction or migration
- WHEN restore runs
- THEN no partial data remains and previous state is preserved

### Requirement: Image Integrity Handling

The system MUST verify image entry integrity linkage during import and MUST fail validation when declared image references are missing, malformed, or inconsistent with payload metadata.

#### Scenario: Image integrity passes
- GIVEN payload image entries are complete and consistent
- WHEN integrity checks run
- THEN image section is accepted for restore

#### Scenario: Image integrity fails
- GIVEN payload contains mismatched or missing image references
- WHEN integrity checks run
- THEN import is blocked before restore starts
