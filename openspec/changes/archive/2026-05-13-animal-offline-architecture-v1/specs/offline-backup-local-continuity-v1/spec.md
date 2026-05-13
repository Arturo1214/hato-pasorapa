# Delta for offline-backup-local-continuity-v1

## ADDED Requirements

### Requirement: Backup/export/import UX hidden from GANADERO navigation

The system MUST NOT expose backup export, import, or restore functionality in the GANADERO user navigation or workflow.

#### Scenario: Backup menu absent from GANADERO navigation
- GIVEN a GANADERO user authenticated
- WHEN they view the navigation menu
- THEN no `backup`, `export`, `import`, or `restore` entries appear

#### Scenario: Direct URL to backup returns no content
- GIVEN a GANADERO user attempting to navigate to a backup/export route
- THEN the route either redirects, shows empty, or returns 403

## MODIFIED Requirements

### Requirement: Export Payload Contract and Explicit Exclusions

The system MUST export a single JSON payload with `backupVersion`, `createdAt`, `sourceSchemaVersion`, domain data snapshot, and `images` section; it MUST support explicit image exclusion mode and SHALL mark exclusions in metadata.
(Previously: admin could trigger export; now restricted from GANADERO access)

#### Scenario: Export with images included
- GIVEN an ADMIN triggers local export with image inclusion enabled
- WHEN export completes
- THEN the payload contains data snapshot, image binaries metadata, and integrity section

#### Scenario: Export with images excluded
- GIVEN an ADMIN triggers local export with image inclusion disabled
- WHEN export completes
- THEN the payload omits binary blobs and marks `images.excluded=true`

## REMOVED Requirements

None.
