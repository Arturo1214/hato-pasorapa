# Delta for admin-veterinary-visits-v1

## MODIFIED Requirements

### Requirement: Visit lifecycle state machine

The system MUST support visit lifecycle states: PROGRAMADA, ATENDIDA, REPROGRAMADA, FINALIZADA, CANCELADA; transitions MUST be explicit and reversible except ATENDIDA→FINALIZADA/CANCELADA and REPROGRAMADA→ATENDIDA. Finalization SHALL ONLY be reachable from the ATENDIDA state through the attend flow — it MUST NOT appear as a direct row action.

(Previously: finalize reachable from any non-terminal state via direct action)

#### Scenario: Atender visita con hallazgos y plan

- GIVEN a visit in estado PROGRAMADA
- WHEN the user marks as ATENDIDA with hallazgos, notas, costo, and Plan de tratamiento
- THEN estado changes to ATENDIDA, all clinical fields are persisted
- AND the user CAN either schedule a follow-up (→ REPROGRAMADA) or finalize the chain (→ FINALIZADA)

#### Scenario: Atender sin hallazgos

- GIVEN a visit in estado PROGRAMADA
- WHEN the user attempts to mark as ATENDIDA without hallazgos
- THEN the system MUST reject with validation error

#### Scenario: Cancelar con razón

- GIVEN a visit in any non-terminal state
- WHEN the user cancels with a written reason
- THEN estado changes to CANCELADA
- AND the cancel reason is persisted in metadata

#### Scenario: Cancelar sin razón

- GIVEN a visit in any non-terminal state
- WHEN the user attempts to cancel without providing a reason
- THEN the system MUST reject the cancellation

#### Scenario: Reprogramar desde atendida crea visita vinculada

- GIVEN a visit in estado ATENDIDA
- WHEN the user chooses "Reprogramar"
- THEN a new visit entry is created with parentVisitId referencing the parent
- AND estado=PROGRAMADA for the new visit
- AND the parent visit remains visible with reference to the follow-up

#### Scenario: Finalizar cadena desde atendida

- GIVEN a visit in estado ATENDIDA
- WHEN the user chooses "Finalizar" from the attend flow
- THEN estado changes to FINALIZADA
- AND chain derived status becomes CLOSED

## REMOVED Requirements

### Requirement: Visit lifecycle state machine — finalize as direct action

(Reason: finalize is only reachable from attend flow, not as a standalone row action)

### Requirement: Finalizar directly from list

(Reason: replaced by attend flow finalization option)

## ADDED Requirements

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
