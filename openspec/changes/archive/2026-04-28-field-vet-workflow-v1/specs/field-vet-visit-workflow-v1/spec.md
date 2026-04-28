# field-vet-visit-workflow-v1 Specification

## Purpose

Definir el flujo funcional de visita veterinaria de campo sobre `ANIMAL_HEALTH_EVENT`, offline-first y con seguimiento básico.

## Requirements

### Requirement: Registro de visita offline-first e idempotente

The system MUST allow creating a field vet visit for an existing `animalUuid` with `occurredAt`, `operationId`, and typed visit metadata while offline, and SHALL sync it without duplicates when connectivity returns.

#### Scenario: Registro offline y sync posterior

- GIVEN un animal existente y dispositivo sin conectividad
- WHEN el veterinario registra una visita válida con `operationId`
- THEN el sistema guarda localmente la operación para sync
- AND al reconectar sincroniza una sola vez por `operationId`

#### Scenario: Rechazo por timestamp inválido

- GIVEN una visita con `occurredAt` fuera de formato o vacío
- WHEN se valida el alta
- THEN el sistema MUST reject la operación por contrato inválido

### Requirement: Checklist y nota clínica tipadas

The system MUST require a typed checklist (boolean item value and optional per-item observation) and SHALL require typed clinical note fields (`reason`, `findings`, `plan`).

#### Scenario: Checklist y nota válidos

- GIVEN una visita con checklist completo y nota clínica tipada
- WHEN se confirma el registro
- THEN el sistema persiste ambos bloques en metadata validada

#### Scenario: Nota clínica incompleta

- GIVEN una visita sin `reason` o sin `plan`
- WHEN se valida el payload
- THEN el sistema MUST reject la operación por metadata insuficiente

### Requirement: Protocolo y seguimiento básico

The system MUST capture protocol status as `STARTED`, `FOLLOW_UP`, or `CLOSED`, and MAY include `nextDueAt`; derived follow-up status SHALL be `ACTIVE` until close and `CLOSED` after close.

#### Scenario: Protocolo activo con próximo control

- GIVEN una visita con protocolo `STARTED` y `nextDueAt`
- WHEN se consulta el seguimiento del animal
- THEN el sistema refleja estado derivado `ACTIVE`
- AND muestra la próxima revisión

#### Scenario: Protocolo cerrado

- GIVEN un protocolo previamente activo
- WHEN se registra cierre `CLOSED`
- THEN el sistema refleja estado derivado `CLOSED`

### Requirement: Listados por animal y visita

The system MUST provide visit listings by `animalUuid`, and SHOULD allow filtering by visit identifier and occurredAt range.

#### Scenario: Listado por animal

- GIVEN visitas de múltiples animales
- WHEN se consulta por `animalUuid`
- THEN el sistema devuelve solo visitas del animal solicitado

#### Scenario: Listado por visita específica

- GIVEN múltiples visitas del mismo animal
- WHEN se filtra por identificador de visita
- THEN el sistema devuelve únicamente la visita solicitada

### Requirement: Exclusiones explícitas V1

The system MUST NOT include billing/costing, advanced analytics, complex prescription rules, or multimedia attachments in this workflow.

#### Scenario: Intento de guardar multimedia

- GIVEN una visita con imagen clínica adjunta
- WHEN se procesa el evento
- THEN el sistema MUST reject el payload por alcance excluido V1
