# Delta for animal-health-event-ledger-v1

## MODIFIED Requirements

### Requirement: Metadata tipada para visita veterinaria de campo

(Previously: FIELD_VET_VISIT with visit, checklist, clinicalNote, protocol blocks)

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for `visit` (containing visitId, modo, veterinarianId, atencionNotas, estado, parentVisitId, nextControlAt), `checklist`, `clinicalNote` (reason, findings, plan), and `protocol`; every block SHALL satisfy schema validation.

#### Scenario: Evento FIELD_VET_VISIT con metadata extendida

- GIVEN a payload `FIELD_VET_VISIT` with all visit blocks including modo, veterinarianId, atencionNotas, estado
- WHEN the event is validated
- THEN the system accepts and persists the record in the ledger

#### Scenario: Campo modo ausente

- GIVEN a `FIELD_VET_VISIT` without the `modo` field in visit block
- WHEN the event is validated
- THEN the system MUST reject the operation for incomplete contract

### Requirement: Tipos V1 y exclusiones explícitas

(Previously: Only VACCINATION, DEWORMING, DISEASE_REPORTED, TREATMENT_STARTED/TREATMENT_FOLLOW_UP/TREATMENT_CLOSED, FIELD_VET_VISIT)

The system SHALL accept `FIELD_VET_VISIT` with modo GLOBAL (animalUuid=NULL) or ESPECIFICA (animalUuid required). The system MUST NOT store reproduction events, image/attachment payloads, or billing/costing payloads in this ledger.

#### Scenario: Evento GLOBAL sin animal

- GIVEN a `FIELD_VET_VISIT` payload with modo=GLOBAL and animalUuid=NULL
- WHEN the event is processed
- THEN the system accepts and persists the global visit
- AND the visit is queryable via global listing but NOT via per-animal animalUuid filter

#### Scenario: Evento fuera de alcance

- GIVEN a payload with multimedia attachment block
- WHEN the system evaluates it for V1
- THEN the event MUST be rejected by explicit exclusion

### Requirement: Listado por visita dentro del animal

(Previously: Filter by visit identifier within animal timeline)

The system MUST allow filtering the per-animal health timeline by visit identifier for ESPECIFICA visits only. GLOBAL visits MUST NOT appear in per-animalUuid filtered queries unless the animal is explicitly linked via a campaign association.

#### Scenario: Filtro por visit identifier en animal específica

- GIVEN multiple FIELD_VET_VISIT events (específica) linked to animal A
- WHEN querying with animalUuid=A and visitId filter
- THEN only matching specific visits are returned

#### Scenario: GLOBAL visit en historia animal

- GIVEN a GLOBAL visit with nextControlAt
- WHEN the animal history is projected
- THEN the GLOBAL visit appears as a CAMPAIGN entry in the animal's timeline
- AND is distinguishable from ESPECIFICA entries by modo flag

### Requirement: Listado sanitario por animal

(Previously: Timeline by animalUuid with type and date filters)

The system MUST provide a health timeline by `animalUuid` for ESPECIFICA visits, and MUST project GLOBAL campaign visits into every animal's timeline as CAMPAIGN entries.

#### Scenario: Timeline animal con campaña global

- GIVEN a GLOBAL visit (modo=GLOBAL, estado=ATENDIDA)
- WHEN animalUuid=A's timeline is queried
- THEN the visit appears as a CAMPAIGN entry
- AND reflects the veterinarian and notes from that specific visit event

#### Scenario: Timeline animal sin global visits si no está vinculada

- GIVEN a GLOBAL visit with no animal association
- WHEN an animal's timeline is queried
- THEN the global visit does NOT automatically appear unless explicitly linked