## Exploration: animal-images-local-storage-v1

### Current State
El sistema ya es offline-first y maneja cola/outbox + snapshots para `ANIMAL`, `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT` y `ANIMAL_REPRODUCTION_EVENT`, pero **todavía no existe módulo de imágenes**.

Hallazgos relevantes en código actual:
- **FE offline centralizado** en `OfflineStoreService` con outbox/snapshots/checkpoints por `entityType` (`hato-fe/src/app/core/offline/offline-types.ts`, `offline-store.service.ts`, `sync-orchestrator.service.ts`).
- **BE sync centralizado** en `SyncService`/`SyncPayloadMapper` con matriz explícita por `SyncEntityType`; actualmente no existe `ANIMAL_IMAGE`.
- Los cambios previos dejaron explícitamente las imágenes fuera de alcance, e incluso hay validaciones que rechazan adjuntos en salud/reproducción (`ANIMAL_HEALTH_EVENT_ATTACHMENTS_NOT_SUPPORTED`, `ANIMAL_REPRODUCTION_EVENT_OUT_OF_SCOPE_FIELD`).
- En backend **no hay endpoint multipart ni infraestructura de file storage** (sin configuración de directorio local, sin servicio de archivos, sin rutas de descarga protegida).

Conclusión: hay base sólida para cola offline y sincronización incremental, pero falta construir el agregado de imágenes de punta a punta (FE temporal + BE persistencia local + metadatos/sync).

### Affected Areas
- `hato-fe/src/app/core/offline/offline-types.ts` — nuevo `entityType` de imágenes y contratos de payload/snapshot.
- `hato-fe/src/app/core/offline/offline-store.service.ts` y `offline-store.migrations.ts` — soporte explícito para almacenamiento temporal local de binarios/metadatos (migración de esquema local).
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — ciclo push/pull para entidad de imágenes sin romper orden de sync actual.
- `hato-fe/src/app/features/admin/animals/data-access/` (nuevo service/adapters de imágenes) — flujo queue-first, preview local, reintentos, reconciliación de estado.
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — UI V1 para múltiples imágenes por animal (alta/listado/estado de sync).
- `hato-be/src/main/resources/application.properties` — configuración de root dir local para imágenes (server-side, no terceros).
- `hato-be/src/main/resources/db/changelog/master.yaml` + nuevo changelog `008-animal-images-local-storage-v1.yaml` — tabla de metadatos, constraints idempotentes, índices por `animal_uuid` y orden.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — nuevo tipo de sync para imágenes.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — capability matrix + parse/validación de payload de imagen.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — handlers push/pull para imágenes con idempotencia por `operationId`.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/` + `service/` + `repository/` (nuevos recursos/servicios/repositorios de imágenes) — persistencia de metadatos y escritura/lectura de archivos locales.
- `hato-be/src/test/java/**` y `hato-fe/src/app/**/*.spec.ts` — cobertura TDD de cola offline, validación de archivos, persistencia local, conflictos e idempotencia.

### Approaches
1. **Agregado `ANIMAL_IMAGE` con metadatos en DB + archivo en filesystem local (recomendado)** — FE guarda temporal local + encola operación; BE persiste metadata e imagen final en directorio configurado del servidor.
   - Pros: cumple offline-first + “sin terceros”; separa dominio de imágenes de salud/reproducción; escala para múltiples imágenes por animal; mantiene idempotencia por `operationId`.
   - Cons: requiere nueva vertical completa (FE/BE/migraciones/sync/seguridad); hay que resolver límites de tamaño y validación MIME/hash.
   - Effort: High

2. **Guardar imagen directamente en DB (CLOB/BYTEA) y evitar filesystem**.
   - Pros: implementación backend más lineal para transacciones.
   - Cons: contradice objetivo de persistencia final en directorio local del servidor; aumenta costo/volumen de DB y backup; peor para archivos grandes.
   - Effort: Medium

3. **Carga online directa sin cola offline (solo metadata en sync)**.
   - Pros: menor complejidad inicial en FE.
   - Cons: rompe requerimiento offline-first y objetivo explícito de cola offline; mala UX en campo sin conectividad.
   - Effort: Medium

### Recommendation
Recomiendo **Approach 1** con un diseño V1 acotado:

1. **Modelo V1 de imagen**
   - `ANIMAL_IMAGE` append-only para alta (sin edición destructiva en V1).
   - Metadatos mínimos: `imageId`, `animalUuid`, `operationId`, `capturedAt/clientCreatedAt`, `mimeType`, `sizeBytes`, `checksum`, `relativePath`, `sourceChannel`.

2. **Temporal local FE + cola offline**
   - Guardar temporalmente en almacenamiento local del cliente (IndexedDB) con referencia estable.
   - Encolar operación con referencia al temporal + metadatos necesarios para replay idempotente.

3. **Persistencia final en servidor local**
   - En push exitoso, BE escribe archivo en un root local configurable (ej. `hato.storage.animal-images.root-dir`).
   - Guardar en DB solo metadatos y ruta relativa (nunca path absoluto proveniente del cliente).

4. **Consulta/listado V1**
   - Timeline/listado por `animalUuid` con orden estable y estado de sync.
   - Pull incremental devuelve metadatos; recuperación binaria mediante endpoint autenticado (sin servicios externos).

5. **Límites V1 (IN/OUT)**
   - IN: múltiples imágenes por animal, alta offline, sincronización, almacenamiento final local, listado básico.
   - OUT: edición de imagen, compresión avanzada server-side, CDN, OCR/IA, clasificación automática.

### Risks
- **Tamaño de payload offline**: base64/binarios en cola pueden degradar performance y cuota de almacenamiento local.
- **Atomicidad metadata↔archivo**: riesgo de inconsistencia si se persiste metadata pero falla escritura física (o viceversa).
- **Seguridad de archivos**: path traversal, MIME spoofing y archivos maliciosos si no se valida tipo/tamaño/checksum.
- **Orden de sincronización**: operaciones concurrentes de muchas imágenes pueden generar reintentos costosos y duplicados si falla idempotencia.
- **Deriva de scope**: intentar sumar edición, compresión inteligente o features multimedia avanzadas compromete entregabilidad V1.

### Ready for Proposal
Yes — hay contexto suficiente para pasar a `sdd-propose` con un V1 claro: múltiples imágenes por animal, cola offline y temporal local en cliente, con persistencia final en directorio local del servidor y sin terceros.
