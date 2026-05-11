# calendar-local-reminders-v1 Specification

## Purpose
Definir recordatorios y estados locales V1 para vencimientos, con badges y preferencias locales mínimas.

## Requirements

### Requirement: Due-window classification and severity

The system MUST classify each agenda item into `upcoming`, `due_today`, or `overdue` using local date rules and a configurable horizon of 1, 3, or 7 days. Vet visit controls (FIELD_VET_VISIT with nextControlAt) MUST be included in classification.

#### Scenario: Clasificación por horizonte

- GIVEN un horizonte de aviso local configurado en 3 días
- WHEN un ítem vence en 2 días
- THEN el estado resultante es `upcoming`

#### Scenario: Vencimiento pasado

- GIVEN un ítem con fecha objetivo anterior a hoy local
- WHEN se recalcula severidad
- THEN el estado resultante es `overdue`

#### Scenario: Control veterinario vencido

- GIVEN a FIELD_VET_VISIT with nextControlAt=2026-05-09 and today=2026-05-11, horizon=3
- WHEN due-window classification runs
- THEN the item is classified as overdue

### Requirement: Badges and pending counters

The system SHALL expose badge totals per severity (upcoming, due_today, overdue) and MUST update counters on every recalculation. Vet visit controls MUST contribute to the overdue and due_today badge counts with Spanish labels ("Controles Veterinarios Pendientes", "Controles Hoy").

#### Scenario: Contadores consistentes

- GIVEN múltiples ítems con estados mixtos
- WHEN se actualiza la proyección local
- THEN los badges reflejan el total exacto por estado (`upcoming`, `due_today`, `overdue`)

#### Scenario: Badge mixto con visitas vencidas

- GIVEN 2 overdue vet visits and 1 upcoming
- WHEN badges are calculated
- THEN overdue counter = 2, upcoming counter = 1

### Requirement: Local reminders for vet visit controls

The system SHOULD trigger local/browser reminders on due/due_today vet visit agenda items when permission is granted, and MUST gracefully degrade to in-app alerts when permission is denied. Reminder labels MUST be in Spanish: "Control Veterinario Pendiente" for overdue, "Control Veterinario Hoy" for due_today.

#### Scenario: Permiso denegado para recordatorio veterinario

- GIVEN browser notification permission is denied
- WHEN a vet visit control enters due_today window
- THEN the user receives an in-app alert with label "Control Veterinario Hoy"
- AND no error is thrown

### Requirement: Vet visit reminder exclusions by chain status

The system MUST NOT trigger local reminders for FIELD_VET_VISIT agenda items whose chain is in a CLOSED state (all visits FINALIZADA or CANCELADA). Active chain visits (any visit in estado not terminal) MUST still trigger normally.

#### Scenario: Cadena cerrada no dispara recordatorio

- GIVEN a FIELD_VET_VISIT chain where all visits are FINALIZADA
- WHEN the agenda recalculates reminders
- THEN no local reminder is triggered for that chain's nextControlAt

### Requirement: Local preferences and explicit reminder exclusions

The system MUST persist local reminder preferences (horizon and temporary silence) per device and MUST NOT sync read/snooze state across devices in V1.

#### Scenario: Silenciamiento temporal local

- GIVEN un ítem marcado en silencio temporal en el dispositivo actual
- WHEN se recalculan alertas
- THEN no dispara recordatorio local durante la ventana de silencio

#### Scenario: Segundo dispositivo

- GIVEN el mismo usuario en otro dispositivo
- WHEN consulta alertas sin sincronización de estado
- THEN mantiene estado independiente por exclusión explícita cross-device
