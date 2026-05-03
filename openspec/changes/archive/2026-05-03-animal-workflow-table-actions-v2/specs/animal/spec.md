# Delta: `animal-workflow-table-actions-v2`

## ADDED Requirements

### Requirement: animal-category-sex-matrix

The system MUST enforce a strict sex×category matrix at animal creation and update. Invalid combinations SHALL be rejected with HTTP 400.

| Category | Valid Sex | Invalid Sex |
|----------|-----------|-------------|
| `TERNERA` (HEMBRA) | HEMBRA | MACHO |
| `VAQUILLONA` (HEMBRA) | HEMBRA | MACHO |
| `VACA` (HEMBRA) | HEMBRA | MACHO |
| `TERNERO` (MACHO) | MACHO | HEMBRA |
| `TORO` (MACHO) | MACHO | HEMBRA |
| `BUEY` (MACHO) | MACHO | HEMBRA |

#### Scenario: Create animal with valid HEMBRA+VACA combination

- GIVEN user is authenticated with ganadero context
- WHEN client sends POST /animals with `{ "sex": "HEMBRA", "category": "VACA", ... }`
- THEN request succeeds with HTTP 201 and animal is persisted with sex=HEMBRA and category=VACA

#### Scenario: Create animal with invalid VACA+MACHO combination

- GIVEN user is authenticated with ganadero context
- WHEN client sends POST /animals with `{ "sex": "MACHO", "category": "VACA", ... }`
- THEN request fails with HTTP 400 and error body `{ "error": "INVALID_SEX_CATEGORY_COMBINATION", "detail": "VACA requires HEMBRA, received MACHO" }`

#### Scenario: Update animal to invalid combination

- GIVEN an existing animal with id UUID, category=VACA, sex=HEMBRA
- WHEN client sends PUT /animals/{id} with `{ "sex": "MACHO", "category": "VACA" }`
- THEN request fails with HTTP 400 and same error format

### Requirement: animal-castration-event

The system MUST expose `CASTRATION` as a valid operative `AnimalEventType`. When a `CASTRATION` event is registered on an animal with category `TERNERO` or `TORO`, the animal's category MUST be updated to `BUEY` in the same transaction.

#### Scenario: Castration on TERNERO → BUEY

- GIVEN an animal with category=TERNERO and sex=MACHO
- WHEN client sends POST /animals/{id}/events with `{ "type": "CASTRATION", "occurredAt": "2026-05-02T10:00:00Z", "notes": "..." }`
- THEN response HTTP 201 with event created AND animal.category=BUEY

#### Scenario: Castration on TORO → BUEY

- GIVEN an animal with category=TORO and sex=MACHO
- WHEN client sends POST /animals/{id}/events with `{ "type": "CASTRATION", ... }`
- THEN response HTTP 201 with event created AND animal.category=BUEY

#### Scenario: Castration on TERNERA (HEMBRA) — no transition

- GIVEN an animal with category=TERNERA and sex=HEMBRA
- WHEN client sends POST /animals/{id}/events with `{ "type": "CASTRATION", ... }`
- THEN HTTP 201 with event created; category remains TERNERA

#### Scenario: Castration on VACA (HEMBRA) — no transition

- GIVEN an animal with category=VACA and sex=HEMBRA
- WHEN client sends POST /animals/{id}/events with `{ "type": "CASTRATION", ... }`
- THEN HTTP 201 with event created; category remains VACA

#### Scenario: Castration event enqueued when offline

- GIVEN the client is offline and has a pending sync queue
- WHEN the user registers a CASTRATION event on a TERNERO
- THEN the event is enqueued with same payload structure and syncs with other pending operations when connectivity resumes
- AND the local optimistic UI shows the animal's category as BUEY after confirmation

### Requirement: animal-workflow-table-ui

The frontend animals-page MUST use a `DataTableComponent` with a toolbar containing a "Nuevo animal" button. Row actions MUST expose: Registrar evento operativo, Registrar evento reproductivo, Agregar imágenes, Ver/Editar ficha. Global operative filters (ownerGanaderoId, active) MUST be removed; only free-text search remains.

#### Scenario: Render animals table with sex column

- GIVEN user navigates to /admin/animals
- WHEN the page loads
- THEN DataTable renders with columns: identifiers (arete/marca/tatuaje), sex, category, admission date, owner, actions
- AND sex column shows MACHO/HEMBRA per animal

#### Scenario: "Nuevo animal" opens AnimalFormDialogComponent

- GIVEN user is on /admin/animals
- WHEN user clicks "Nuevo animal" button in toolbar
- THEN MatDialog opens AnimalFormDialogComponent (create mode)
- AND on dialog close with valid data, new animal appears in table

#### Scenario: Row action "Registrar evento operativo" opens operative event dialog

- GIVEN user is on /admin/animals
- WHEN user clicks row action "Registrar evento operativo" on a specific animal row
- THEN operative event modal opens with animal pre-selected
- AND on submit, event is registered and timeline refreshes

#### Scenario: Row action "Agregar imágenes" opens image dialog

- GIVEN user is on /admin/animals
- WHEN user clicks row action "Agregar imágenes" on a row
- THEN image capture/gallery dialog opens
- AND on close, image count in row updates

#### Scenario: Row action "Ver/Editar ficha" opens AnimalFormDialogComponent in edit mode

- GIVEN user is on /admin/animals
- WHEN user clicks row action "Ver/Editar" on a row
- THEN AnimalFormDialogComponent opens pre-populated with that animal's data

#### Scenario: Only free-text search filter available

- GIVEN user is on /admin/animals
- WHEN user inspects the filter bar
- THEN there is NO ownerGanaderoId dropdown and NO active filter
- AND only a text input for free-text search remains

### Requirement: animal-birth-date-field

The `AnimalRequest` DTO MUST accept an optional `birthDate` field of type `LocalDate`. When creating a new animal with category `TERNERO` or `TERNERA`, the `birthDate` field is REQUIRED. For all other categories, `birthDate` remains optional.

#### Scenario: Create TERNERO with birthDate succeeds

- GIVEN user sends POST /animals with `{ "category": "TERNERO", "sex": "MACHO", "birthDate": "2024-05-01", ... }`
- THEN request succeeds with HTTP 201 and animal is persisted with birthDate=2024-05-01

#### Scenario: Create TERNERO without birthDate fails

- GIVEN user sends POST /animals with `{ "category": "TERNERO", "sex": "MACHO", ... }` (no birthDate)
- THEN request fails with HTTP 400 and error `{ "error": "BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL", "detail": "birthDate is required for TERNERO/TERNERA" }`

#### Scenario: Create VACA without birthDate succeeds (optional)

- GIVEN user sends POST /animals with `{ "category": "VACA", "sex": "HEMBRA", ... }` (no birthDate)
- THEN request succeeds with HTTP 201 and animal.birthDate remains null

#### Scenario: birthDate persisted and returned in AnimalResponse

- GIVEN an animal exists with birthDate=2024-05-01
- WHEN client sends GET /animals/{uuid}
- THEN response includes `"birthDate": "2024-05-01"`

### Requirement: animal-ternero-toro-auto-transition

When an animal with category `TERNERO` reaches 24 months of age (calculated from `birthDate`), the system MUST automatically transition its category to `TORO`. This transition is triggered on the next read operation of the animal (not event-driven at creation time).

#### Scenario: TERNERO with age ≥ 24 months transitions to TORO on read

- GIVEN an animal with category=TERNERO, sex=MACHO, birthDate = 24 months ago
- WHEN the animal is fetched via GET /animals/{uuid} or listAnimals
- THEN the returned animal has category=TORO
- AND this transition is persisted to the database

#### Scenario: TERNERO with age < 24 months remains TERNERO on read

- GIVEN an animal with category=TERNERO, sex=MACHO, birthDate = 12 months ago
- WHEN the animal is fetched
- THEN the returned animal retains category=TERNERO

#### Scenario: TERNERO without birthDate is not auto-transitioned

- GIVEN an animal with category=TERNERO, sex=MACHO, birthDate=null
- WHEN the animal is fetched
- THEN the returned animal retains category=TERNERO (no age calculation possible)
- AND no error is thrown

#### Scenario: TORO animals are never auto-transitioned back to TERNERO

- GIVEN an animal with category=TORO and birthDate indicating age > 24 months
- WHEN the animal is fetched
- THEN the returned animal retains category=TORO

---

## MODIFIED Requirements

### Requirement: animal-event-ledger-v1

The `animal-event-ledger-v1` capability is extended to include `CASTRATION` as a valid operative event type.

The system MUST accept `CASTRATION` as a valid `AnimalEventType` value for operative events. All existing event validation rules (occurredAt required, notes max length, etc.) apply identically to `CASTRATION`.

(Previously: V1 operative catalog included only SOLD, DECEASED, LOST, TRANSFERRED, OBSERVATION)

#### Scenario: CASTRATION passes V1 event catalog validation

- GIVEN an animal with category=TERNERO, sex=MACHO
- WHEN client sends POST /animals/{id}/events with type=CASTRATION
- THEN event passes service-layer catalog validation and is persisted

---

## Metadata

- Change: `animal-workflow-table-actions-v2`
- Resolved questions: TERNERO→TORO 24 months (V2), birthDate in AnimalRequest, castration offline queue behavior