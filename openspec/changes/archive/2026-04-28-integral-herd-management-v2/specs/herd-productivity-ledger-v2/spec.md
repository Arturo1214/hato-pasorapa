# herd-productivity-ledger-v2 Specification

## Purpose
Ledger local de productividad por período, animal y lote.

## Requirements

### Requirement: Productivity ledger consistency

The system MUST record entries keyed by (`periodKey`,`animalId`,`lotId`,`metricType`) and SHALL enforce non-negative values and deterministic deduplication by entry identity during reconciliation.

#### Scenario: Register productivity entry offline

- GIVEN a valid productivity entry
- WHEN saved offline
- THEN it is persisted locally as pending sync

#### Scenario: Duplicate entry identity during reconciliation

- GIVEN local and remote entries with same identity
- WHEN reconciliation runs
- THEN only one canonical entry remains
