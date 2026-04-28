## Exploration: reproduction-and-birth-v1

### Current State
El sistema ya tiene una base offline-first sólida para animales y dos verticales separadas por dominio:

- **Core animal vigente** (`animals`) para estado operativo actual (owner, categoría, activos, visibles).
- **Ledger operativo** (`animal_events`) para cambios no sanitarios (`SOLD|DECEASED|LOST|TRANSFERRED|OBSERVATION`) con proyección mínima a `animals`.
- **Ledger sanitario** (`animal_health_events`) separado, también append-only, con sync propio (`ANIMAL_HEALTH_EVENT`).

Hallazgos clave para este change:
- No existe hoy ninguna entidad, enum, servicio ni contrato offline para reproducción/preñez/partos/crías.
- `Animal` no modela aún relación de filiación (`madre/padre`) ni datos de nacimiento.
- La UI actual de `animals-page` ya está organizada por bloques de formulario + timeline (operativo/sanitario), patrón reutilizable para una vertical reproductiva.
- Las specs vigentes declaran explícitamente que reproducción quedó fuera de los V1 previos, por lo que ahora corresponde abrirla como agregado propio, no mezclarla con salud u operativo.

### Affected Areas
- `hato-be/src/main/resources/db/changelog/master.yaml` — registrar nueva migración de reproducción/nacimientos.
- `hato-be/src/main/resources/db/changelog/007-reproduction-and-birth-v1.yaml` — nuevas tablas/índices/constraints (nuevo archivo esperado).
- `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` — posible extensión con referencias `motherUuid` / `fatherUuid` y fecha de nacimiento (si se elige proyección en estado vigente).
- `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/*` — catálogo reproductivo V1 (nuevo enum dedicado).
- `hato-be/src/main/java/bo/pasorapa/hato/domain/*Reproduction*` y/o `*Birth*` — nuevos agregados append-only.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/*Reproduction*Repository.java` y/o `*Birth*Repository.java` — consultas por animal, tipo y rango temporal.
- `hato-be/src/main/java/bo/pasorapa/hato/service/*Reproduction*Service.java` y/o `*Birth*Service.java` — reglas de negocio (servicio, preñez, parto, vínculo madre/padre/cría).
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/*Reproduction*Mapper.java` — validación de metadata tipada + normalización payload sync.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/*Reproduction*Resource.java` — endpoints de listado por `animalUuid`.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — incorporar nuevo(s) entity type(s) offline.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — capability matrix + parse/validación del payload reproductivo.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — handler push/pull incremental para reproducción/nacimientos.
- `hato-fe/src/app/core/offline/offline-types.ts` — nuevos tipos de entidad/evento reproductivo y snapshots.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — pull incremental del nuevo agregado.
- `hato-fe/src/app/features/admin/animals/data-access/*reproduction*.service.ts` — servicio queue-first para alta/listado reproductivo.
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — formulario/timeline reproductivo y de partos alineado al patrón vigente.
- `hato-be/src/test/java/**` y `hato-fe/src/app/**/*.spec.ts` — cobertura RED/GREEN obligatoria por `strict_tdd: true`.

### Approaches
1. **Agregado reproductivo dedicado + partos dedicados (separado de salud/operativo)** — crear ledger reproductivo V1 propio (servicio, preñez, pérdida de preñez, parto) con metadata tipada y relación madre/padre/cría.
   - Pros: respeta boundaries ya establecidos; mantiene legibilidad del dominio; minimiza regressions en `ANIMAL_EVENT` y `ANIMAL_HEALTH_EVENT`; escala a V2 sin refactor traumático.
   - Cons: más superficie inicial (tabla(s), DTOs, mapper, service, sync, UI y tests).
   - Effort: Medium/High

2. **Reusar `ANIMAL_EVENT` existente agregando tipos reproductivos** — meter reproducción en el ledger operativo actual vía nuevos `eventType` + metadata.
   - Pros: menor cantidad de archivos nuevos al inicio.
   - Cons: rompe el boundary explícito de specs previas; mezcla dominios operativos/reproductivos; aumenta acople y riesgo de regresión en proyección actual.
   - Effort: Medium

3. **Resolver sólo con campos en `animals` (sin ledger reproductivo)** — guardar estado de preñez/parto/parentesco como columnas mutables en animal.
   - Pros: implementación aparentemente rápida.
   - Cons: pierde trazabilidad histórica; mala compatibilidad offline (reintentos/replay); complica auditoría y evolución funcional.
   - Effort: Low

### Recommendation
Recomiendo **Approach 1**: agregado reproductivo dedicado, manteniendo el patrón que funcionó para salud.

Delimitación V1 propuesta (IN):
1. **Servicios reproductivos**: registrar evento de servicio (monta/inseminación) append-only.
2. **Preñez**: registrar confirmación de preñez y pérdida de preñez como eventos explícitos.
3. **Partos**: registrar parto como evento explícito con fecha/hora, resultado básico y metadata mínima.
4. **Crías**: registrar vínculo de la cría con madre (obligatoria) y padre (opcional) usando `animalUuid`.
5. **Relación madre/padre**: persistir filiación de forma consultable offline (vía proyección en snapshot de animal y/o consulta de ledger).
6. **Offline-first**: queue-first, idempotencia por `operationId`, pull incremental por cursor, igual que verticales anteriores.

Fuera de alcance V1 (OUT):
- Analítica reproductiva avanzada (tasas de concepción, intervalos, predicción, KPIs).
- Imágenes/adjuntos (ecografías, fotos, documentos).
- Protocolos reproductivos complejos multi-etapa (sincronización hormonal avanzada).
- Modelado genealógico extendido más allá de vínculo madre/padre directo.
- Automatizaciones de decisiones clínicas o reproductivas.

### Risks
- **Scope creep**: intentar incluir analítica avanzada o adjuntos rompería entregabilidad V1.
- **Ambigüedad de filiación**: sin regla clara para padre opcional vs desconocido, puede degradar calidad de datos.
- **Acople indebido**: si reproducción se mezcla con `ANIMAL_EVENT`/`ANIMAL_HEALTH_EVENT`, aumenta riesgo de regresión.
- **Consistencia offline**: partos + vínculo de cría pueden requerir orden de operaciones (alta de cría y vínculo) para evitar inconsistencias temporales.
- **Drift de estado SDD/OpenSpec**: existe historial reciente con carpetas activas/archivadas mixtas; conviene fijar estado del change nuevo desde el inicio para evitar confusión de continuidad.

### Ready for Proposal
Yes — hay contexto suficiente y límites V1 claros para pasar a `sdd-propose` en `reproduction-and-birth-v1` con foco en eventos reproductivos básicos, vínculo madre/padre/cría y sync offline-first, excluyendo analítica avanzada e imágenes.
