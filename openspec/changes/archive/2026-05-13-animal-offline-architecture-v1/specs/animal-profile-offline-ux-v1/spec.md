# animal-profile-offline-ux-v1 Specification

## Purpose

Offline-first CRUD for animal profiles: local snapshot reads, outbox-based create/update with replay, and inline conflict/error visibility for GANADERO users.

## Requirements

### Requirement: Local snapshot reads while offline

The system MUST serve animal profile data from local IndexedDB snapshots when connectivity is unavailable, without blocking the UI.

#### Scenario: Animal detail loads offline from snapshot
- GIVEN the device is offline
- WHEN the GANADERO opens an animal profile previously loaded online
- THEN the profile renders from the local snapshot
- AND all tabs (ficha, imágenes, salud, reproducción) display cached data

#### Scenario: Animal list loads offline from snapshot
- GIVEN the device is offline
- WHEN the GANADERO navigates to the animal list
- THEN the list renders from the last synced snapshot

### Requirement: Outbox-first create and update

The system MUST enqueue animal profile create and update operations in the local outbox keyed by `operationId` before attempting network sync.

#### Scenario: Offline create enqueued
- GIVEN the device is offline
- WHEN the GANADERO creates a new animal
- THEN the operation is stored in the outbox with status `PENDING`
- AND the animal appears in local list immediately

#### Scenario: Offline update enqueued
- GIVEN the device is offline
- WHEN the GANADERO edits an animal profile
- THEN the update is stored in the outbox with status `PENDING`
- AND the UI reflects the change optimistically

### Requirement: Background sync on reconnect

The system MUST automatically replay pending outbox operations when connectivity is restored, without blocking user interactions.

#### Scenario: Pending operations replay on reconnect
- GIVEN the outbox contains pending animal operations
- WHEN the device regains connectivity
- THEN the system replays operations in order
- AND the user can continue interacting with the app immediately

#### Scenario: Idempotent replay by operationId
- GIVEN an operation with `operationId=X` was already accepted by the server
- WHEN the client replays `operationId=X` after reconnect
- THEN no duplicate record is created server-side

### Requirement: Conflict metadata surfaced as badge

The system MUST attach conflict metadata to the local record when server rejects a replay due to version mismatch, and MUST display a conflict badge on the record without blocking access.

#### Scenario: Conflict badge on animal row
- GIVEN an animal update rejected by server with conflict
- WHEN the GANADERO views the animal list
- THEN the row displays a conflict badge
- AND the record remains viewable and editable locally

### Requirement: IndexedDB storage for structured animal records

The system MUST store animal profile records in IndexedDB using the existing `hato-offline` store structure (`snapshots`, `outbox`), and MUST NOT use localStorage for animal domain data.

#### Scenario: Animal data in IndexedDB not localStorage
- GIVEN an animal record synced locally
- WHEN the storage is inspected
- THEN the record resides in IndexedDB under `hato-offline`
- AND no animal domain data exists in localStorage
