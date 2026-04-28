# animal-reproduction-event-ledger-v1 Specification

## Purpose

Ledger reproductivo V1 append-only para servicio, preñez y parto, consultable por animal.

## Requirements

### Requirement: Registro append-only de eventos reproductivos

The system MUST registrar asientos inmutables para `SERVICE`, `PREGNANCY_CONFIRMED`, `PREGNANCY_LOSS` y `BIRTH`.

#### Scenario: Alta válida y bloqueo de edición

- GIVEN un `animalUuid` existente y una fecha de evento válida
- WHEN se registra un evento `SERVICE` con metadata mínima requerida
- THEN el sistema crea un nuevo asiento reproductivo
- AND SHALL rechazar edición o borrado de asientos existentes

### Requirement: Metadata mínima tipada por tipo de evento

The system MUST exigir metadata mínima: `SERVICE.serviceMethod`, `PREGNANCY_CONFIRMED.confirmationDate`, `PREGNANCY_LOSS.lossReason`, `BIRTH.birthDate` y `BIRTH.offspringCount`.

#### Scenario: Validación de metadata por tipo

- GIVEN un `animalUuid` existente
- WHEN se registra `PREGNANCY_CONFIRMED` con `confirmationDate` y `BIRTH` sin `offspringCount`
- THEN el primero se acepta y el segundo MUST rechazarse

### Requirement: Listado por animal y exclusiones de dominio

The system MUST listar eventos por `animalUuid` en fecha descendente y MUST NOT usar `animal_events` ni `animal_health_events`.

#### Scenario: Consulta por animal con alcance V1

- GIVEN múltiples eventos reproductivos para un mismo `animalUuid`
- WHEN se consulta el ledger reproductivo por ese animal
- THEN se devuelven solo eventos V1 ordenados
- AND KPIs, predicción y adjuntos SHALL quedar excluidos
