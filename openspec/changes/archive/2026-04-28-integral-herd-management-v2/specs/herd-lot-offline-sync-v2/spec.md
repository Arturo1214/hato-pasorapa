# herd-lot-offline-sync-v2 Specification

## Purpose
Gestión local de lotes y asignaciones temporales.

## Requirements

### Requirement: Lot lifecycle and temporal assignment

The system MUST support local create/update/archive of lots and SHALL persist animal↔lot intervals (`fromDate`,`toDate`) with no overlapping active interval per animal.

#### Scenario: Create lot and assign animals offline

- GIVEN a valid lot and assignments
- WHEN saved offline
- THEN records persist locally as pending sync

#### Scenario: Reject overlapping active assignment

- GIVEN an active interval for an animal
- WHEN a new interval overlaps it
- THEN the assignment is rejected
