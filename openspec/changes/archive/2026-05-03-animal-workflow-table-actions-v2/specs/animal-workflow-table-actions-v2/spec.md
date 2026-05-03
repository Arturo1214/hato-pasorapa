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
- THEN HTTP 201 with event created; category remains TERNERA (castration not applicable to females — no category change)

#### Scenario: Castration on VACA (HEMBRA) — no transition

- GIVEN an animal with category=VACA and sex=HEMBRA
- WHEN client sends POST /animals/{id}/events with `{ "type": "CASTRATION", ... }`
- THEN HTTP 201 with event created; category remains VACA

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

## REMOVED Requirements

### Requirement: (none) — no requirements removed

No existing requirements are deprecated in this change.

---

## Metadata

- Change: `animal-workflow-table-actions-v2`
- Mode: hybrid (engram + openspec)
- Size: 6 scenarios + 1 modified requirement
- Word budget: ~550 words (under 650 limit)