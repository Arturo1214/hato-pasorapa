# animal-image-local-file-storage-v1 Specification

## Purpose
Definir persistencia física V1 de imágenes en filesystem local del servidor con seguridad de ruta, validación y recuperación básica.

## Requirements

### Requirement: Secure local filesystem persistence
The system MUST persist accepted image binaries in a configurable local root directory and store only safe relative paths in metadata. The system MUST validate allowlisted MIME type, declared `sizeBytes`, and `checksum` before final write. The system MUST reject path traversal attempts.

#### Scenario: Persistencia local válida
- GIVEN imagen con metadatos válidos y checksum correcto
- WHEN el backend procesa la operación
- THEN escribe el archivo bajo la raíz configurada
- AND guarda ruta relativa segura en metadatos

#### Scenario: Validación de seguridad fallida
- GIVEN payload con ruta manipulada o MIME no permitido
- WHEN se intenta persistir
- THEN el backend rechaza la operación sin escribir archivo

### Requirement: Authenticated retrieval with explicit V1 exclusions
The system SHALL expose authenticated retrieval for original binary and basic thumbnail access/reference by image id. The system MUST support per-animal basic listing use cases and MUST NOT implement V1-out-of-scope capabilities: advanced editing, adaptive compression, video/audio support, or complex gallery layouts.

#### Scenario: Descarga autenticada de imagen
- GIVEN una imagen persistida y usuario autenticado autorizado
- WHEN solicita el binario por id
- THEN recibe el archivo correspondiente

#### Scenario: Solicitud de funcionalidad excluida
- GIVEN un pedido de recorte o filtro avanzado
- WHEN se procesa en V1
- THEN el sistema responde no soportado en esta versión
