# Delta for animal-core-characteristics-v1

## ADDED Requirements

### Requirement: Animal physical characteristics capture
The system MUST capture and persist `color`, `description`, and `breedUuid` for every animal. These fields MUST be included in all animal DTOs, forms, detail views, list views, and offline sync payloads.

#### Scenario: Create animal with full characteristics
- GIVEN authenticated GANADERO on animal creation form
- WHEN submits with `color=Colorado`, `description=Bueno para carne`, `breedUuid` set to valid active breed
- THEN animal is persisted with all three fields saved
- AND offline payload includes these fields

#### Scenario: Edit animal preserves characteristics
- GIVEN existing animal with `color`, `description`, `breedUuid` populated
- WHEN GANADERO edits animal and changes `color` only
- THEN `breedUuid` and `description` remain unchanged
- AND `updatedAt` is refreshed

#### Scenario: Animal list shows breed name
- GIVEN animals with different breeds assigned
- WHEN viewing animal list
- THEN each row displays breed `nombre` (not `uuid`) for readability

#### Scenario: Offline create syncs characteristics
- GIVEN GANADERO offline creates animal with `color` and `breedUuid` (resolved from local active breeds cache)
- WHEN session reconnects and syncs
- THEN server persists `color`, `description` (nullable), and `breedUuid`
- AND server responds with final `uuid`

### Requirement: Animal detail shows breed info
The system MUST display breed `nombre` and `descripcion` on the animal detail screen when `breedUuid` is present.

#### Scenario: Detail view with breed
- GIVEN animal with `breedUuid` pointing to active `Raza`
- WHEN GANADERO opens animal detail
- THEN shows breed `nombre` as clickable label and `descripcion` below

#### Scenario: Detail view without breed (legacy)
- GIVEN animal where `breedUuid=null` (pre-existing data)
- WHEN detail loads
- THEN displays "Sin raza asignada" gracefully
- AND does not crash or show broken references

### Requirement: Breed selector validation
The system MUST validate that `breedUuid` references an active `Raza` at submission time for online operations. Offline submissions MUST resolve `breedUuid` from locally cached active breeds.

#### Scenario: Online submission with inactive breed rejected
- GIVEN GANADERO online selects a breed that was deactivated by ADMIN since cached
- WHEN submits animal create
- THEN server responds 400 and indicates breed not available
- AND form remains populated for correction

#### Scenario: Offline submission with stale cache
- GIVEN GANADERO offline with cached active breeds list that includes a breed ADMIN later deactivated
- WHEN submits offline animal using that breed
- THEN sync fails with conflict and payload is flagged for retry

## REMOVED Requirements

None.