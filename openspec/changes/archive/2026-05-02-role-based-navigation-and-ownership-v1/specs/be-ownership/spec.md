# Delta for BE ownership enforcement

## ADDED Requirements

### Requirement: GanaderoId derivation from JWT for own operations

The system MUST derive `ganaderoId` from the authenticated user's JWT for all ganadero-scoped operations (Animals, Events, Visits, Sync). The FE MUST NOT pass `ganaderoId` as request body or parameter.

#### Scenario: Animal creation scoped to authenticated ganadero

- GIVEN authenticated GANADERO creates an animal record
- WHEN Animal endpoint receives request
- THEN BE derives `ganaderoId` from `SecurityContext.getPrincipal()` not from request body
- AND `ganaderoId` is NOT accepted as a request parameter or body field

#### Scenario: Event creation scoped to authenticated ganadero

- GIVEN authenticated GANADERO creates an event (health, reproduction, general)
- WHEN Event endpoint receives request
- THEN BE derives `ganaderoId` from JWT principal
- AND request body does NOT contain `ganaderoId`

#### Scenario: Visit creation scoped to authenticated ganadero

- GIVEN authenticated GANADERO creates a veterinary visit record
- WHEN Visit endpoint receives request
- THEN BE derives `ganaderoId` from `SecurityContext.getPrincipal()`

### Requirement: Conflict resolution scoped by current user

The system MUST scope conflict resolution in `SyncResource.resolveConflict` to the `currentUserId` from JWT; ADMIN MUST NOT resolve GANADERO conflicts.

#### Scenario: Ganadero resolves own conflict

- GIVEN authenticated GANADERO resolves a conflict on their own operation
- WHEN `SyncResource.resolveConflict` is called
- THEN BE verifies `currentUserId` owns the conflicted operation
- AND resolution is applied

#### Scenario: Admin cannot resolve ganadero conflict

- GIVEN authenticated ADMIN calls `SyncResource.resolveConflict` for a GANADERO operation
- WHEN endpoint evaluates ownership
- THEN request is rejected with 403

### Requirement: No ganaderoId parameter in own-operation endpoints

All endpoints for ganadero-scoped operations (create/read/update/delete for Animals, AnimalEvents, AnimalHealthEvents, AnimalReproductionEvents, Visits, Sync push/pull) MUST NOT accept `ganaderoId` as query, path, or body parameter.

#### Scenario: Endpoint rejects ganaderoId in body

- GIVEN request includes `ganaderoId` in body for Animal create
- WHEN validation runs
- THEN request is rejected with 400

#### Scenario: Endpoint rejects ganaderoId as query param

- GIVEN request includes `ganaderoId` as query parameter
- WHEN endpoint processes request
- THEN request is rejected with 400