## Exploration: animal-events-history-v1

### Current State
El sistema hoy opera con un modelo **current-state first** para animales:

- `animals` representa estado vigente (owner actual, visibles, categoría, activo, versión, updatedAt).
- No existe tabla ni API de historial de eventos del animal en FE/BE.
- El sync offline ya está consolidado para `ANIMAL`, `USER`, `GANADERO` con outbox/inbox/checkpoints + idempotencia por `operationId` y conflicto por versión.
- El frontend ya consume y persiste snapshots de animales por `uuid` (`ANIMAL:{uuid}`), con estado `pending/conflict/synced`.

Implicación clave: hay base técnica para introducir historial de eventos sin romper core, pero hay que mantener un boundary estricto para no mezclar salud/reproducción/imágenes en este V1.

### Affected Areas
- `hato-be/src/main/resources/db/changelog/master.yaml` — incluir nueva migración de eventos.
- `hato-be/src/main/resources/db/changelog/*.yaml` — crear tabla de eventos históricos + índices por `animal_uuid/occurred_at/type`.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` — mantener estado vigente como proyección operacional (sin convertir a event sourcing completo).
- `hato-be/src/main/java/bo/pasorapa/hato/domain/OperationLog.java` — referencia para estrategia de auditoría (actor + acción).
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — extender push/pull para eventos sin romper contrato actual.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — validar payload de eventos V1 y capability matrix.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — potencial nuevo `ANIMAL_EVENT`.
- `hato-fe/src/app/core/offline/offline-types.ts` — soportar nueva entidad offline de eventos.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — incluir pull/apply de eventos y replay offline.
- `hato-fe/src/app/features/admin/animals/**` — agregar vista de historial y alta de evento V1.

### Approaches
1. **Ledger de eventos + proyección explícita al estado actual** — tabla append-only `animal_events` y reglas acotadas para impactar `animals` sólo en eventos terminales/ownership.
   - Pros: separa historial de estado vigente; compatible con offline/sync actual; abre camino limpio para salud/reproducción.
   - Cons: requiere definir reglas de proyección y orden por fecha/evento para evitar inconsistencias.
   - Effort: Medium

2. **Guardar “historial” dentro de `animals` (campos ad-hoc)** — agregar flags/fechas/motivos en ficha actual y derivar timeline en UI.
   - Pros: implementación inicial más rápida.
   - Cons: acopla demasiado core con historial; rompe escalabilidad funcional; dificulta futuros cambios sanitarios/reproductivos.
   - Effort: Low/Medium

3. **Event sourcing pleno desde ahora** — `animals` como proyección total y todas las mutaciones vía eventos.
   - Pros: máximo alineamiento teórico con historial futuro.
   - Cons: scope excesivo para esta iteración; alto riesgo para operación rural inmediata.
   - Effort: High

### Recommendation
Recomiendo **Approach 1 (ledger + proyección acotada)**.

#### Modelo: evento histórico vs estado actual
- `animals` sigue siendo la fuente de **estado operativo vigente** para listados/filtros rápidos.
- `animal_events` guarda historial **append-only** por `animalUuid`.
- Cada evento incluye: `eventId`, `animalUuid`, `eventType`, `occurredAt`, `notes`, `performedByUserId`, `sourceChannel` (`ONLINE|OFFLINE_SYNC`), `operationId` (idempotencia), `createdAt`.

#### Tipos mínimos V1 (IN)
1. `SOLD` (vendido)
2. `DECEASED` (fallecido)
3. `LOST` (perdido)
4. `TRANSFERRED` (traslado/cambio de owner actual)
5. `OBSERVATION` (anotación operativa libre)

#### Transición de estado actual desde eventos
- `SOLD`, `DECEASED`, `LOST` ⇒ `animals.active = false`.
- `TRANSFERRED` ⇒ actualizar `animals.ownerGanaderoId` al nuevo owner (validado).
- `OBSERVATION` ⇒ no muta estado core, sólo historial.
- No se implementa reconstrucción completa de estado desde eventos en V1; se aplica proyección puntual y auditable.

#### Ownership / auditoría
- Ownership del evento = `performedByUserId` + `sourceChannel` + `operationId`.
- Para `TRANSFERRED`, guardar `fromOwnerGanaderoId` y `toOwnerGanaderoId` en payload del evento.
- Reutilizar patrón de idempotencia existente (como `sync_operation_receipts`) para replays offline.

#### Filtros/listados de historial (V1)
- Por `animalUuid` (obligatorio).
- Por `eventType`.
- Por rango de fechas (`occurredAt` desde/hasta).
- Orden descendente por `occurredAt` y desempate por `createdAt/eventId`.

#### Consideraciones offline para creación de eventos
- Alta de evento siempre encola operación offline (queue-first), aun con red.
- Nuevo entity type para sync (`ANIMAL_EVENT`) con operación permitida inicial: `CREATE`.
- Snapshot local del historial por animal para lectura offline.
- Conflictos: principalmente validación (animal inexistente, owner destino inválido, fecha inválida) + idempotencia por `operationId`.

#### Qué NO incluir todavía (OUT)
- Historial sanitario completo (`animal-health-events-v1`).
- Reproducción, celo, preñez, parto, genealogía (`reproduction-and-birth-v1`).
- Gestión de imágenes/adjuntos (`animal-images-local-storage-v1`).
- Event sourcing total del agregado animal.
- Reglas analíticas avanzadas y reportes complejos de timeline.

### Risks
- **Inconsistencia temporal**: si `occurredAt` llega fuera de orden offline, la proyección de estado puede quedar ambigua sin regla de precedencia.
- **Sobrecarga de scope**: intentar incluir salud/reproducción/imágenes en este change rompe entregabilidad.
- **Acople sync**: introducir `ANIMAL_EVENT` sin matrix clara puede romper contratos existentes de sync.
- **Auditoría incompleta**: si no se persiste `performedByUserId/sourceChannel`, se pierde trazabilidad legal-operativa.

### Ready for Proposal
Yes — la exploración delimita un V1 implementable: historial operativo mínimo (5 tipos), proyección acotada al estado actual y compatibilidad explícita con futuras verticales de salud/reproducción/imágenes.
