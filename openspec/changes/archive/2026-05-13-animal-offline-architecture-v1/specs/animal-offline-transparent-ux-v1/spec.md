# animal-offline-transparent-ux-v1 Specification

## Purpose

Transparent offline UX for GANADERO: connectivity awareness and inline sync-status badges on rows, cards, and photos without exposing manual sync/backup/conflict tools.

## Requirements

### Requirement: Connectivity header indicator

The system MUST expose online/offline state via a persistent header indicator visible on all GANADERO routes without requiring user action.

#### Scenario: Header shows online status
- GIVEN the browser has connectivity
- WHEN the GANADERO navigates to any animal route
- THEN the header displays an online indicator

#### Scenario: Header shows offline status
- GIVEN the browser is offline (network unavailable)
- WHEN the GANADERO navigates to any animal route
- THEN the header displays an offline indicator
- AND the indicator persists across route changes while offline

### Requirement: Inline sync-status badges on records

The system MUST display sync-status badges on animal record rows and cards indicating `pending`, `syncing`, `synced`, or `conflict/error` states.

#### Scenario: Pending badge on animal row
- GIVEN an animal record created offline with pending sync
- WHEN the GANADERO views the animal list
- THEN the row displays a `pending` badge

#### Scenario: Conflict badge visible to GANADERO
- GIVEN an animal record in conflict state
- WHEN the GANADERO views the record
- THEN a `conflict` or `error` badge is displayed inline
- AND the record remains accessible

#### Scenario: Synced badge clears after confirm
- GIVEN an animal record previously marked `pending`
- WHEN sync confirms the record server-side
- THEN the badge transitions to `synced`

### Requirement: Photo/media sync-status badges

The system MUST display local-only, pending, syncing, synced, and error badges on photo thumbnails and media cards within the animal image gallery.

#### Scenario: Local-only photo badge
- GIVEN a photo captured offline that has not been uploaded
- WHEN the GANADERO views the animal's image gallery
- THEN the thumbnail displays a `local-only` badge

#### Scenario: Syncing badge during upload
- GIVEN a photo queued for upload
- WHEN upload is in progress
- THEN the thumbnail displays a `syncing` spinner or badge

#### Scenario: Error badge on failed sync
- GIVEN a photo upload that failed after retries
- WHEN the GANADERO views the gallery
- THEN the thumbnail displays an `error` badge

### Requirement: No manual sync/backup/conflict tools in GANADERO nav

The system MUST NOT expose manual sync trigger, backup export/import, or conflict resolution routes in the GANADERO navigation menu.

#### Scenario: Sync menu absent from GANADERO navigation
- GIVEN a GANADERO user authenticated
- WHEN they view the navigation menu
- THEN no `sync`, `backup`, `restore`, or `conflicts` entries appear

#### Scenario: Direct URL to conflict UI returns no content
- GIVEN a GANADERO user attempts to navigate to a conflict resolution route
- THEN the route either redirects, shows empty, or returns 403
