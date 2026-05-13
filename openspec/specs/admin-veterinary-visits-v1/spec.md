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

The system MUST support visit lifecycle states: `PROGRAMADA`, `ATENDIDA`, `CANCELADA`; transitions MUST be explicit. A visit in `ATENDIDA` has a derived chain status: `ACTIVE` when a child `PROGRAMADA` visit exists with `parentVisitId` referencing this visit, or `CLOSED` when the user selected "Finalizar" in the attend flow. Terminal states (`CANCELADA`, `ATENDIDA` with chain=`CLOSED`) MUST block all further transitions. Finalization SHALL ONLY be reachable through the attend flow — it MUST NOT appear as a direct row action.

#### Scenario: Programar nueva visita (Programada mode)

- GIVEN a new visit dialog is submitted in "Programada" mode
- WHEN the form is valid with `Fecha de visita` filled
- THEN the visit is created with estado=`PROGRAMADA`
- AND only scheduling fields are visible; clinical fields and finalization controls are hidden

#### Scenario: Crear atendidos inmediata con fecha actual

- GIVEN a new visit dialog is submitted in "Atendida inmediata" mode
- WHEN the form is valid
- THEN the visit is created with estado=`PROGRAMADA` and `fecha` set to the current moment
- AND clinical fields are visible

#### Scenario: Atender visita con hallazgos

- GIVEN a visit in estado=`PROGRAMADA`
- WHEN the user marks it as `ATENDIDA` with hallazgos (required), notas, costo (optional BOB), and Plan de tratamiento (behind "Tiene tratamiento" toggle)
- THEN estado changes to `ATENDIDA` and clinical fields are persisted
- AND the user MUST choose "Finalizar" (chain=CLOSED) or "Programar próxima visita"

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

### Requirement: Cancel modal with required reason

The system MUST provide a dedicated cancel modal requiring a non-empty cancellation reason before confirming. The reason SHALL be stored in visit metadata and displayed in the visit history.

#### Scenario: Cancel modal renders

- GIVEN a user clicks "Cancelar" on a pending visit row
- WHEN the cancel dialog opens
- THEN a textarea labeled "Motivo de cancelación" is shown with a confirm button
- AND the confirm button is disabled until text is entered

### Requirement: Attend flow with clinical capture

The system MUST expose an attend flow that captures: descripción/hallazgos (required), notas de atención, costo (optional, currency BOB), and Plan de tratamiento as an ordered list of steps. The user SHALL choose between scheduling a linked follow-up or finalizing the treatment chain.

#### Scenario: Attend flow shows treatment plan steps

- GIVEN a user opens the attend flow
- WHEN the dialog renders
- THEN fields for hallazgos, notas, costo are shown
- AND a "Plan de tratamiento" section shows an ordered list where each step has a description field
- AND steps can be added or reordered

#### Scenario: Attend chooses follow-up vs finalize

- GIVEN a user completes the clinical capture in attend flow
- WHEN submitting
- THEN a choice is presented: "Programar próximo control" or "Finalizar tratamiento"
- AND selecting "Programar próximo control" creates a linked follow-up visit
- AND selecting "Finalizar" closes the chain