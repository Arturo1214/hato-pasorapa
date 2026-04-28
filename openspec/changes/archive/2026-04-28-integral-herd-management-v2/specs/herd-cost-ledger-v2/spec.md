# herd-cost-ledger-v2 Specification

## Purpose
Ledger local de costos por categoría y fuente.

## Requirements

### Requirement: Cost ledger recording and classification

The system MUST store entries with `category`,`source`,`amount`,`currency`,`periodKey` and SHALL reject missing category/source or negative amount.

#### Scenario: Save valid cost entry offline

- GIVEN a valid cost entry
- WHEN saved offline
- THEN it is stored locally and queued for sync

#### Scenario: Invalid cost classification is rejected

- GIVEN an entry missing category or negative amount
- WHEN validation runs
- THEN the entry is rejected and totals stay unchanged
