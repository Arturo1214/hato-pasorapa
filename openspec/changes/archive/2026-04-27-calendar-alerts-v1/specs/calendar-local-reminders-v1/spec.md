# calendar-local-reminders-v1 Specification

## Purpose
Definir recordatorios y estados locales V1 para vencimientos, con badges y preferencias locales mínimas.

## Requirements

### Requirement: Due-window classification and severity
The system MUST classify each agenda item into `upcoming`, `due_today`, or `overdue` using local date rules and a configurable horizon of 1, 3, or 7 days.

#### Scenario: Clasificación por horizonte
- GIVEN un horizonte de aviso local configurado en 3 días
- WHEN un ítem vence en 2 días
- THEN el estado resultante es `upcoming`

#### Scenario: Vencimiento pasado
- GIVEN un ítem con fecha objetivo anterior a hoy local
- WHEN se recalcula severidad
- THEN el estado resultante es `overdue`

### Requirement: Badges and pending counters
The system SHALL expose badge totals per severity and MUST update counters on every recalculation so the UI can display pendientes consistentes.

#### Scenario: Contadores consistentes
- GIVEN múltiples ítems con estados mixtos
- WHEN se actualiza la proyección local
- THEN los badges reflejan el total exacto por estado (`upcoming`, `due_today`, `overdue`)

### Requirement: Local reminders with graceful degradation
The system SHOULD trigger local/browser reminders on due windows when permission is granted, and MUST gracefully degrade to in-app alerts when permission is denied or unavailable.

#### Scenario: Permiso denegado
- GIVEN permisos de notificación denegados
- WHEN ocurre una ventana de aviso
- THEN el usuario recibe alerta in-app sin error bloqueante

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
