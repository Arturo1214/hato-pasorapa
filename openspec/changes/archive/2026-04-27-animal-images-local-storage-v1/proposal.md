# Proposal: Animal Images Local Storage V1

## Intent

Habilitar múltiples imágenes por animal en modo offline-first, con cola local y persistencia final en filesystem local del servidor, sin servicios de terceros. El objetivo es cerrar el gap actual: hoy hay sync offline para eventos, pero no existe agregado de imágenes.

## Scope

### In Scope
- Alta de múltiples imágenes por `animalUuid` con cola offline (`queue-first`) y estado local pendiente/sincronizado.
- Almacenamiento temporal en cliente (IndexedDB) para binario + metadatos necesarios para replay idempotente.
- Persistencia final en servidor local: escritura de archivo en directorio configurable + metadatos en DB + listado básico por animal.

### Out of Scope
- Edición avanzada de imágenes (crop, filtros, anotaciones, rotación inteligente).
- Compresión inteligente/adaptativa (cliente o servidor).
- Soporte multimedia de video/audio.
- Galerías complejas (álbumes jerárquicos, storytelling, layout avanzado).

## Capabilities

### New Capabilities
- `animal-image-ledger-v1`: Contrato de metadatos append-only de imagen por animal, con trazabilidad e idempotencia (`operationId`).
- `animal-image-offline-sync-v1`: Push/pull incremental para `ANIMAL_IMAGE`, con replay seguro y reconciliación de estado.
- `animal-image-local-file-storage-v1`: Persistencia física en filesystem local del backend, validación de archivo y ruta relativa segura.

### Modified Capabilities
- None.

## Approach

Crear agregado vertical `ANIMAL_IMAGE` FE/BE. FE guarda temporalmente binarios y encola operaciones con metadatos mínimos (`mimeType`, `sizeBytes`, `checksum`, `capturedAt`). BE procesa cola idempotente, valida tipo/tamaño/checksum, persiste metadatos en DB y escribe archivo en root local configurable. El pull incremental devuelve metadatos; el binario se recupera por endpoint autenticado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/*` | Modified | Nuevo `entityType` de imagen, migraciones y ciclo sync. |
| `hato-fe/src/app/features/admin/animals/*` | Modified/New | UI de carga/listado y data-access de imágenes. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modified | Agregar `ANIMAL_IMAGE`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/{SyncService,mapper/SyncPayloadMapper}.java` | Modified | Handlers push/pull e idempotencia de imágenes. |
| `hato-be/src/main/java/bo/pasorapa/hato/{web/rest,service,repository}/**` | New | Vertical de imágenes + endpoints de descarga. |
| `hato-be/src/main/resources/db/changelog/*` | Modified/New | Tabla metadatos e índices por `animal_uuid`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Saturación de almacenamiento local cliente | Med | Límite por archivo/cantidad, limpieza temporal post-sync. |
| Inconsistencia metadata↔archivo | Med | Transacción lógica con compensación y reintentos seguros. |
| Seguridad de archivos (path traversal/MIME spoofing) | High | Sanitizar rutas, allowlist MIME, validar checksum/tamaño. |

## Rollback Plan

Desactivar `ANIMAL_IMAGE` en matriz de sync, mantener feature flag ocultando UI de imágenes, revertir changelog `008-animal-images-local-storage-v1`, y conservar archivos ya escritos en carpeta de cuarentena para limpieza controlada posterior.

## Dependencies

- Infraestructura de filesystem local writable en backend (ruta configurable por entorno).
- Base offline existente (outbox/snapshots/checkpoints) ya operativa.

## Success Criteria

- [ ] Usuario puede cargar múltiples imágenes offline y verlas en estado pendiente por animal.
- [ ] Al recuperar conectividad, sync persiste metadatos + archivo local sin duplicados por `operationId`.
- [ ] Listado por animal devuelve imágenes en orden estable con estado reconciliado.
- [ ] No se implementa ninguna capacidad OUT de este V1.
