# admin-veterinary-visits-v1 Specification

## Purpose

Definir la pantalla operativa central de visitas veterinarias, consistente con Animales/Usuarios/Ganaderos, que permita registrar campañas globales del rodeo y visitas específicas por animal, con seguimiento clínico claro, veterinario por visita, y proyección a calendario.

## Requirements

### Requirement: Central veterinary visits list with Spanish UX

The system MUST provide a central admin/ganadero screen with a Material table listing all vet visits, supporting global (herd) and specific (per-animal) modes, with Spanish labels, route header metadata, and explicit actions.

#### Scenario: Listado global con filtros

- GIVEN the central vet-visits screen is loaded
- WHEN the user views the list
- THEN the table displays: visitId, modo, veterinario, estado, fecha, siguienteControl; with Spanish column headers and Material responsive UX consistent with admin-users and admin-ganaderos patterns

#### Scenario: Filtro por estado y modo

- GIVEN multiple visits in mixed states and modes
- WHEN the user applies filters for estado=PROGRAMADA or modo=GLOBAL
- THEN only matching rows appear in the table

#### Scenario: Creación de visita global

- GIVEN the user clicks "Nueva Visita"
- WHEN selecting "Global / Campanha" mode
- THEN a dialog opens with fields: fecha, veterinario, notas de atención, modo=GLOBAL
- AND no animal selector is shown

#### Scenario: Creación de visita específica con autocomplete animal

- GIVEN the user clicks "Nueva Visita" and selects "Especifica" mode
- WHEN the dialog renders
- THEN the animal selector shows latest 10 animals by default
- AND allows searching by arete, marca, or tatuaje
- AND selected animal UUID is stored in visit metadata

### Requirement: Visit lifecycle state machine

The system MUST support visit lifecycle states: PROGRAMADA, ATENDIDA, REPROGRAMADA, FINALIZADA, CANCELADA; transitions MUST be explicit and reversible except ATENDIDA→FINALIZADA/CANCELADA and REPROGRAMADA→ATENDIDA.

#### Scenario: Programar nueva visita

- GIVEN a new visit dialog is submitted
- WHEN the form is valid
- THEN the visit is created with estado=PROGRAMADA

#### Scenario: Atender visita

- GIVEN a visit in estado PROGRAMADA
- WHEN the user marks as ATENDIDA with notas de atención
- THEN estado changes to ATENDIDA, notes are persisted
- AND the user CAN either reprogram (→ REPROGRAMADA) or finalize/close (→ FINALIZADA)

#### Scenario: Reprogramar desde atendida

- GIVEN a visit in estado ATENDIDA
- WHEN the user chooses "Reprogramar"
- THEN a new visit entry is created linked to the parent, estado=PROGRAMADA
- AND the parent visit remains visible with reference to the follow-up

#### Scenario: Reprogramar cadena

- GIVEN a visit in estado REPROGRAMADA
- WHEN the user marks it as ATENDIDA
- THEN estado changes to ATENDIDA
- AND the user CAN continue the chain or close it

#### Scenario: Cancelar visita

- GIVEN a visit in any non-final state
- WHEN the user cancels the visit
- THEN estado changes to CANCELADA

### Requirement: Visit metadata with veterinarian per visit

The system MUST store veterinarian data per visit event, and each follow-up in a chain MAY reference a different veterinarian. Metadata MUST include: `visitId`, `modo` (GLOBAL|ESPECIFICA), `veterinarianId`, `veterinarianName`, `atencionNotas`, `estado`, `parentVisitId` (for follow-ups), `nextControlAt`.

#### Scenario: Veterinario por visita en cadena

- GIVEN a visit chain with 3 follow-ups
- WHEN each visit is recorded
- THEN each stores its own veterinarianId independently
- AND no visit inherits the previous veterinarian automatically

#### Scenario: Visita global sin animal específico

- GIVEN a GLOBAL mode visit
- WHEN the event is persisted
- THEN `animalUuid` is NULL in the record
- AND the visit appears in the global list but NOT in individual animal histories unless explicitly linked

### Requirement: Follow-up chain visibility in animal history

The system MUST project global campaign visits into every animal's health timeline, while specific visits appear only in their own animal's history.

#### Scenario: Campaña global en historia animal

- GIVEN a GLOBAL visit with estado=ATENDIDA
- WHEN the animal history is queried
- THEN the visit appears in the timeline as a CAMPAIGN entry (distinguished from SPECIFIC visits)
- AND the animal UUID is NOT stored in the visit record

#### Scenario: Visita específica solo en su animal

- GIVEN an ESPECIFICA visit linked to animalUuid=A
- WHEN animalUuid=B history is queried
- THEN the visit does NOT appear in B's timeline

### Requirement: Calendar integration for upcoming controls

The system MUST project upcoming vet visits (nextControlAt) into the calendar agenda, and MUST show local reminders for due_today and overdue items with Spanish labels.

#### Scenario: Próximo control en calendario

- GIVEN a visit with nextControlAt in the future
- WHEN the calendar agenda is calculated
- THEN the item appears with label "Control Veterinario" and visit metadata

#### Scenario: Recordatorio local para control vencido

- GIVEN a visit with nextControlAt in the past and estado=PROGRAMADA
- WHEN local reminders are calculated
- THEN the item is classified as overdue with a badge counter