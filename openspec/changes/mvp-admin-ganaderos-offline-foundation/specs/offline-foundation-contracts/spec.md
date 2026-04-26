# offline-foundation-contracts Specification

## Purpose
Definir contratos base offline-first para evolución futura sin implementar sincronización completa.

## Requirements

### Requirement: Metadatos de sincronización base en entidades y API
The system MUST incluir en recursos administradores/ganaderos `id`, `version`, `updatedAt`, `lastSyncedAt` y SHALL aceptar `operationId` para idempotencia de operaciones mutantes.

#### Scenario: Escritura con operationId nuevo
- GIVEN una operación de creación o actualización con operationId no visto
- WHEN la API procesa la solicitud válida
- THEN persiste cambios y registra el operationId

#### Scenario: Reintento idempotente
- GIVEN una operación repetida con mismo operationId ya procesado
- WHEN llega nuevamente la solicitud
- THEN el sistema no duplica efectos funcionales

### Requirement: Límites no funcionales y exclusiones del foundation
The system MUST documentar que el foundation no incluye colas de sync, retries automáticos ni resolución de conflictos multi-dispositivo en este cambio.

#### Scenario: Revisión de alcance del MVP
- GIVEN la especificación del cambio
- WHEN se validan capacidades offline
- THEN quedan explícitas exclusiones de sync completa y conflictos avanzados
