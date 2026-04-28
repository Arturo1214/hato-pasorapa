# Design: Animal Images Local Storage V1

## Technical Approach

Se agrega un vertical `ANIMAL_IMAGE` end-to-end, reutilizando el patrón offline-first existente (outbox/snapshots/checkpoints + `/sync/push` y `/sync/pull`). El FE guarda binario temporal en IndexedDB separado del estado serializable, encola metadatos en outbox y, al sincronizar, hidrata el payload con `base64Data`. El BE valida seguridad (mime, tamaño, checksum, ruta), guarda archivo en filesystem local configurable y persiste metadatos en DB con idempotencia por `operationId`.

## Architecture Decisions

### Decision: Transporte del binario en sync

| Option | Tradeoff | Decision |
|---|---|---|
| Endpoint multipart paralelo | Duplica orquestación y rompe semántica uniforme de outbox | No |
| `base64Data` en `ANIMAL_IMAGE` vía `/sync/push` | Payload más grande; requiere límites estrictos | Sí |

**Rationale**: mantiene idempotencia y retry del pipeline actual sin introducir un segundo motor de sync.

### Decision: Storage temporal cliente

| Option | Tradeoff | Decision |
|---|---|---|
| Guardar `Blob` dentro de `snapshots` | Incompatible con migraciones actuales basadas en JSON clone | No |
| Nuevo object store IndexedDB para binarios | Requiere migración de schema de DB local | Sí |

**Rationale**: separa metadatos serializables de binarios y evita corrupción de estado offline.

### Decision: Consistencia metadata↔archivo en servidor

| Option | Tradeoff | Decision |
|---|---|---|
| Solo DB (BYTEA/CLOB) | Contradice objetivo de filesystem local | No |
| Filesystem + DB con compensación | Complejidad de rollback lógico | Sí |

**Rationale**: cumple requerimiento funcional y permite cleanup controlado ante fallos parciales.

## Data Flow

```
AnimalsPage → AnimalsImagesService → OfflineStore(outbox/snapshots)
                                └→ OfflineImageBinaryStore(IndexedDB Blob)

SyncOrchestrator.push
  → hidrata base64 desde OfflineImageBinaryStore
  → /api/sync/push (ANIMAL_IMAGE CREATE)
  → SyncService → AnimalImageService
                  ├→ valida mime/size/checksum
                  ├→ escribe archivo en FS local
                  └→ persiste metadata DB (operationId único)

SyncOrchestrator.pull (ANIMAL_IMAGE) → snapshots metadata
GET /api/animal-images/{id}/content → binario autenticado
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Agregar `ANIMAL_IMAGE` + contratos de payload/snapshot/metadatos. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Integrar operaciones de limpieza/reconciliación para binarios de imagen. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Nueva versión de schema local para soportar storage binario separado. |
| `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` | Create | IndexedDB object store dedicado para `Blob` por `operationId`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Hidratar `base64Data` antes de push y purge local tras ACK. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-images.service.ts` | Create | Queue-first para alta/listado de imágenes por animal. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-images-timeline.adapter.ts` | Create | Normalización y estado reconciliado (`pending/synced/conflict`). |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modify | UI V1: selector múltiple, previews, estado de sync por imagen. |
| `hato-be/src/main/resources/application.properties` | Modify | `hato.storage.animal-images.root-dir`, `max-bytes`, mime allowlist. |
| `hato-be/src/main/resources/db/changelog/008-animal-images-local-storage-v1.yaml` | Create | Tabla `animal_images` + constraints/indexes. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog 008. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalImage.java` | Create | Entidad metadata + `relativePath`, `checksum`, `operationId`. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalImageRepository.java` | Create | Queries por `animalUuid` y `updatedAt/id` para pull incremental. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/animalimage/*.java` | Create | Request/Response/List + DTO de descarga. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalImageMapper.java` | Create | Parse/validación payload sync y mapeo pull/list. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalImageStorageService.java` | Create | Escritura/lectura segura en FS (ruta sanitizada). |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalImageService.java` | Create | Casos de uso create/list/download + idempotencia. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Agregar `ANIMAL_IMAGE`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Capability matrix + mapeo payload imagen. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Handlers push/pull de `ANIMAL_IMAGE`. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalImageResource.java` | Create | `GET /animals/{uuid}/images` y `GET /animal-images/{id}/content`. |

## Interfaces / Contracts

```ts
type AnimalImageOfflineCreatePayload = {
  animalUuid: string;
  operationId: string;
  sourceChannel: 'ONLINE' | 'OFFLINE';
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  checksumSha256: string;
  capturedAt: string;
  binaryRef: string; // local IndexedDB key
  base64Data?: string; // inyectado justo antes de push
};
```

```java
public record AnimalImageRequest(
    UUID animalUuid,
    UUID operationId,
    String mimeType,
    String fileName,
    long sizeBytes,
    String checksumSha256,
    String base64Data,
    OffsetDateTime capturedAt,
    String sourceChannel) {}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | validación de tipo/tamaño, enqueue, hidratación base64, purge post-ack | Vitest sobre `animals-images.service` y `offline-image-binary-store.service` |
| Unit BE | validación mime/checksum/path traversal/idempotencia | JUnit5 para `AnimalImageMapper`, `AnimalImageStorageService`, `AnimalImageService` |
| Integration | push/pull `ANIMAL_IMAGE`, listado y descarga autenticada | Quarkus test + rest-assured + temp dir local |
| E2E manual guiada | captura offline → reconexión → sync → descarga | checklist QA funcional V1 |

## Migration / Rollout

Migración DB vía changelog `008`. Rollout detrás de feature flag FE (`animalImagesV1`) y toggle backend (`hato.storage.animal-images.enabled=true`). Si hay rollback: desactivar flag/toggle, retirar `ANIMAL_IMAGE` de matriz de sync y mover archivos escritos a cuarentena para limpieza posterior.

## Open Questions

- [ ] Confirmar límite V1 por archivo (propuesta: 5 MB) y máximo por animal por ciclo de sync.
- [ ] Definir si `image/webp` queda habilitado desde día 1 o solo JPEG/PNG.
