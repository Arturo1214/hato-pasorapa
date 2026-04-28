# calendar-offline-schedule-v1 Specification

## Purpose
Definir un cronograma offline/local-first derivado de snapshots y eventos existentes, navegable por día/semana/mes.

## Requirements

### Requirement: Local schedule projection from existing snapshots
The system MUST derive agenda items locally from `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_EVENT`, and `ANIMAL` snapshots already stored offline, without creating new backend entities.

#### Scenario: Derivación multi-origen
- GIVEN snapshots locales de animales y eventos sanitarios/reproductivos/operativos
- WHEN la agenda se proyecta
- THEN cada ítem queda asociado al `animalUuid`, tipo de evento y fecha objetivo

#### Scenario: Snapshot incompleto
- GIVEN un evento sin fecha objetivo válida
- WHEN se proyecta la agenda
- THEN el evento se excluye explícitamente del cronograma visible

### Requirement: Timeline windows by day/week/month
The system MUST provide deterministic timeline views for day, week, and month windows, and SHALL return the same ordering for equal input state.

#### Scenario: Cambio de ventana temporal
- GIVEN agenda local calculada
- WHEN el usuario alterna entre día, semana y mes
- THEN se muestran sólo ítems cuyo vencimiento cae en la ventana seleccionada

#### Scenario: Orden estable en empates
- GIVEN dos ítems con igual fecha objetivo
- WHEN se renderiza la lista
- THEN el orden se resuelve de forma estable por severidad y clave determinística

### Requirement: Local refresh and recalculation
The system MUST recalculate the timeline after offline snapshot load, sync completion, and explicit user refresh.

#### Scenario: Recalculo post-sync
- GIVEN una sincronización local finalizada
- WHEN el orquestador de sync emite actualización
- THEN la agenda se recalcula sin requerir endpoint adicional

### Requirement: Explicit V1 exclusions for schedule scope
The system MUST NOT include push-remote dependencies, cross-device state propagation, or expert-rule inference in schedule projection for V1.

#### Scenario: Feature fuera de alcance solicitada
- GIVEN una regla de proyección que requiere motor experto o backend nuevo
- WHEN se evalúa para V1
- THEN la regla se rechaza por exclusión explícita de alcance
