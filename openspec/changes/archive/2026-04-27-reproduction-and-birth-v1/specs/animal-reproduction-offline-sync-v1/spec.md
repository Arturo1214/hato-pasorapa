# animal-reproduction-offline-sync-v1 Specification

## Purpose

Sincronización offline-first para reproducción V1 con cola local e incremental por cursor.

## Requirements

### Requirement: Queue-first con estados de sincronización

The system MUST aceptar altas offline, guardarlas primero en cola y marcarlas `PENDING_SYNC` hasta confirmación.

#### Scenario: Alta offline y falla de push

- GIVEN un dispositivo sin conectividad
- WHEN se registra un evento reproductivo válido
- THEN el evento se guarda en cola local con estado `PENDING_SYNC`
- AND si el push falla, SHALL mantenerse en cola sin pérdida

### Requirement: Idempotencia por operationId

The system MUST usar `operationId` como clave idempotente en push para evitar duplicados en reintentos.

#### Scenario: Reintento de operación ya aplicada

- GIVEN una operación previamente aplicada con `operationId` conocido
- WHEN el cliente reenvía la misma operación
- THEN el servidor responde sin crear duplicados

### Requirement: Pull incremental por cursor y alcance acotado

The system MUST soportar pull por cursor y devolver solo cambios de reproducción V1.

#### Scenario: Pull incremental e inicial

- GIVEN un cursor de sincronización válido
- WHEN el cliente ejecuta pull incremental
- THEN recibe solo cambios posteriores del dominio reproductivo
- AND sin cursor previo, MAY recibir snapshot inicial y nuevo cursor
