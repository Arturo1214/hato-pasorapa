# animal-image-ledger-v1 Specification

## Purpose
Definir el contrato V1 append-only de metadatos de imágenes por animal, soportando múltiples imágenes y listados básicos.

## Requirements

### Requirement: Append-only image metadata per animal
The system MUST register each image as a new immutable ledger entry linked to `animalUuid`, allowing multiple entries per animal. Each entry MUST include `operationId`, `mimeType`, `sizeBytes`, `checksum`, `capturedAt`, `syncStatus`, `createdAt`, and `updatedAt`.

#### Scenario: Alta válida de múltiples imágenes
- GIVEN un `animalUuid` existente
- WHEN se registran 3 imágenes con `operationId` distintos
- THEN se crean 3 entradas nuevas en el ledger
- AND ninguna entrada previa es modificada

#### Scenario: Metadata mínima incompleta
- GIVEN una imagen sin `checksum`
- WHEN se intenta registrar
- THEN el sistema rechaza la entrada por contrato incompleto

### Requirement: Basic listing and thumbnail metadata contract
The system MUST list image metadata by `animalUuid` in deterministic order (`capturedAt`, `createdAt`, `imageId`) and SHALL expose `thumbnailRef` for basic previews when available. The system MUST NOT include advanced gallery composition in V1.

#### Scenario: Listado básico ordenado por animal
- GIVEN múltiples imágenes de un animal con distintas fechas
- WHEN se consulta el listado de imágenes
- THEN se devuelve sólo ese animal en orden estable

#### Scenario: Miniatura no disponible
- GIVEN una entrada sin `thumbnailRef`
- WHEN se consulta el listado
- THEN la entrada se devuelve igual con miniatura ausente
