## Exploration: animal-health-events-v1

### Current State
El sistema ya tiene base offline-first madura para eventos operativos de animal, pero **no tiene todavía un módulo sanitario**.

- Backend:
  - Existe `animal_events` como ledger append-only V1 con catálogo acotado a `SOLD|DECEASED|LOST|TRANSFERRED|OBSERVATION` (`AnimalEventType`, `005-animal-events-history-v1.yaml`).
  - La proyección actual sobre `animals` sólo cubre estado operativo y owner (`AnimalEventService.applyProjection`).
  - Sync push/pull soporta `ANIMAL_EVENT` con `CREATE` e idempotencia por `operationId` (`SyncService`, `SyncPayloadMapper`).
- Frontend:
  - Existe flujo queue-first + snapshots para `ANIMAL_EVENT` (`offline-types.ts`, `offline-store.service.ts`, `sync-orchestrator.service.ts`).
  - La UI de animales ya renderiza historial mínimo y alta de evento operativo (`animals-page.component.ts`, `animals-events.service.ts`).
- Especificaciones actuales:
  - `animal-event-ledger-v1` explícitamente excluye historial sanitario/reproductivo/adjuntos en ese V1.

Conclusión: el siguiente paso natural es **sanidad básica separada del ledger operativo**, reutilizando la infraestructura offline/sync existente sin romper boundaries ya acordados.

### Affected Areas
- `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalEventType.java` — evaluar si se mantiene cerrado (recomendado) para no mezclar salud en ledger operativo.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — incorporar manejo de nueva entidad sanitaria en push/pull.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — extender capability matrix offline + parse/validación de payload sanitario.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — nuevo tipo de entidad (`ANIMAL_HEALTH_EVENT` o equivalente).
- `hato-be/src/main/resources/db/changelog/master.yaml` + nuevo changelog — tabla(s) sanitarias, índices y constraints de idempotencia.
- `hato-fe/src/app/core/offline/offline-types.ts` — contratos tipados de evento sanitario y tipos permitidos V1.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — pull por nueva entidad sanitaria (si se agrega entity type nuevo).
- `hato-fe/src/app/features/admin/animals/data-access/` — servicio/adapters para timeline sanitario y alta queue-first.
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — formulario/vista sanitaria básica con seguimiento mínimo.
- `hato-be/src/test/java/**/Sync*Test.java`, `AnimalEvent*Test.java` y `hato-fe/src/app/**/**.spec.ts` — nuevas pruebas TDD por `strict_tdd: true`.

### Approaches
1. **Extender `ANIMAL_EVENT` actual con tipos sanitarios** — agregar `VACCINATION/DEWORMING/DISEASE/TREATMENT` al enum y reutilizar tabla/servicio existente.
   - Pros: menor fricción inicial; reaprovecha API, sync y timeline ya implementados.
   - Cons: rompe boundary explícito de specs actuales; mezcla semántica operativa con sanitaria; aumenta complejidad de proyección y validaciones en un módulo que hoy está deliberadamente acotado.
   - Effort: Medium

2. **Nuevo agregado sanitario dedicado (recomendado)** — crear `animal_health_events` (append-only), entidad/sync propia y timeline sanitario separado.
   - Pros: respeta límites de `animal-event-ledger-v1`; modelo sanitario extensible; reduce riesgo de regressions en eventos operativos; facilita excluir reproducción/imágenes en V1.
   - Cons: más superficie inicial (nueva tabla, DTOs, servicios, tests, UI y sync mapping adicional).
   - Effort: Medium/High

3. **Campos sanitarios ad-hoc en `animals` sin ledger** — guardar “última vacuna/desparasitación/enfermedad” directo en ficha actual.
   - Pros: entrega rápida para mostrar datos mínimos.
   - Cons: pierde trazabilidad/auditoría histórica; complica seguimiento de tratamientos; muy mala base para offline idempotente y evolución futura.
   - Effort: Low

### Recommendation
Recomiendo **Approach 2: agregado sanitario dedicado**, manteniendo `ANIMAL_EVENT` operativo sin cambios de catálogo.

Delimitación V1 propuesta (IN):
- Tipos sanitarios mínimos:
  1. `VACCINATION`
  2. `DEWORMING`
  3. `DISEASE_REPORTED`
  4. `TREATMENT_STARTED`
  5. `TREATMENT_FOLLOW_UP`
  6. `TREATMENT_CLOSED`
- Datos mínimos por evento: `animalUuid`, `healthEventType`, `occurredAt`, `notes`, `performedByUserId`, `sourceChannel`, `operationId`, `metadata` tipada.
- Follow-up básico: modelado por eventos append-only (`TREATMENT_FOLLOW_UP` / `TREATMENT_CLOSED`) en vez de updates destructivos.
- Offline-first: queue-first + idempotencia por `operationId` + pull incremental con cursor.
- Consultas V1: timeline sanitario por `animalUuid` con filtros básicos por tipo y rango temporal.

Fuera de alcance explícito (OUT):
- Reproducción (celo, servicio, preñez, parto, genealogía).
- Imágenes, archivos o adjuntos clínicos.
- Protocolos clínicos avanzados, dosificación inteligente o analytics sanitario complejo.
- Reconstrucción total event-sourced del agregado animal.

### Risks
- **Deriva de alcance**: intentar meter reproducción o imágenes en este change rompe entregabilidad V1.
- **Frontera difusa entre ledger operativo y sanitario**: si no se separan catálogos/tabla, se complica mantenimiento y compatibilidad de specs ya archivadas.
- **Complejidad de metadata sanitaria**: sin contrato mínimo por tipo (ej. vacuna/lote/próxima fecha), aparecen validaciones inconsistentes entre FE/BE.
- **Riesgo de inconsistencias offline**: si seguimiento se implementa como update mutable en lugar de eventos append-only, se vuelve frágil bajo retries/replays.
- **Costo TDD**: `strict_tdd: true` obliga a cubrir BE + FE + sync; si no se trocea bien, aumenta tiempo y riesgo de bloqueo.

### Ready for Proposal
Yes — hay contexto suficiente para pasar a `sdd-propose` con un alcance V1 claro: sanidad básica offline-first (vacunación, desparasitación, enfermedad, tratamiento y seguimiento), separado del ledger operativo y sin mezclar reproducción/imágenes.
