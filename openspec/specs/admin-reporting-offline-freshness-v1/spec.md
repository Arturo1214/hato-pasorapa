# admin-reporting-offline-freshness-v1 Specification

## Purpose

Definir contrato de frescura visible y continuidad offline-first para reporting administrativo V1.

## Requirements

### Requirement: Visible freshness metadata

The system MUST display reporting freshness using `lastSyncAt` and `lastComputedAt`, and SHALL indicate when data is stale relative to the latest successful sync.

#### Scenario: Freshness is visible after local computation

- GIVEN reporting was computed from local snapshots
- WHEN the admin opens reporting
- THEN `lastSyncAt` and `lastComputedAt` are visible
- AND the freshness state indicates whether computation is current or stale

### Requirement: Post-sync recomputation contract

After a successful sync, the system MUST recompute reporting projections from updated snapshots before marking freshness as current.

#### Scenario: Sync updates freshness state

- GIVEN reporting is stale before sync
- WHEN sync completes successfully
- THEN projections are recomputed from the new local snapshots
- AND freshness changes to current with updated timestamps

### Requirement: Offline continuity with manual refresh trigger

When connectivity is unavailable, reporting SHOULD remain readable from last local projection and MAY defer recomputation until sync can run; a manual refresh/sync trigger MUST remain available.

#### Scenario: Manual refresh requested while offline

- GIVEN admin is offline with previously computed reporting
- WHEN manual refresh/sync is triggered
- THEN last local reporting remains visible
- AND the system reports deferred update until connectivity returns
