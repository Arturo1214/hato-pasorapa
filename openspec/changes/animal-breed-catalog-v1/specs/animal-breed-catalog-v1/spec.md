# Delta for animal-breed-catalog-v1

## ADDED Requirements

### Requirement: ADMIN breed catalog ABM
The system SHALL provide a full create/edit/deactivate/list interface for `Raza` entries accessible only to ADMIN role. Each entry MUST contain `uuid`, `nombre`, `descripcion`, `activo`, `createdAt`, `updatedAt`.

#### Scenario: ADMIN creates new breed
- GIVEN authenticated ADMIN user
- WHEN navigates to `/admin/razas` and submits new breed form with `nombre=Brangus`
- THEN system persists new `Raza` with `activo=true`, `uuid` auto-generated, timestamps set
- AND breed appears in list sorted by `nombre`

#### Scenario: ADMIN deactivates breed
- GIVEN existing active breed with no animals assigned
- WHEN ADMIN edits and sets `activo=false`
- THEN system updates `updatedAt` and breed disappears from ganadero selector
- AND previously assigned animals retain the historical value

#### Scenario: ADMIN cannot delete breed used by animals
- GIVEN a breed with at least one animal referencing it
- WHEN ADMIN attempts deactivate
- THEN system soft-deletes; animals still show historical value
- AND new animal creation cannot select this breed

### Requirement: Initial seed ordered with Criolla first
The system MUST seed the `Raza` table on first migration with `Criolla` as the first entry. Subsequent entries SHALL be ordered alphabetically.

#### Scenario: Fresh migration seed
- GIVEN clean database with no prior `Raza` data
- WHEN Liquibase migration runs
- THEN `Criolla` appears first in `Raza` list
- AND any additional seeded breeds follow alphabetically

### Requirement: Active-only ganadero selection
The system MUST expose a read-only endpoint returning only `Raza` entries where `activo=true`. The ganadero animal form MUST use this endpoint to populate breed selector.

#### Scenario: Ganadero sees only active breeds
- GIVEN authenticated GANADERO user
- WHEN opens animal create/edit form
- THEN breed selector contains only active breeds
- AND inactive breeds are not present in the dropdown

#### Scenario: Offline payload preserves breedUuid
- GIVEN ganadero working offline with cached active breeds
- WHEN creates animal selecting breed offline
- THEN `breedUuid` is stored in local payload and survives sync to server

## REMOVED Requirements

None.