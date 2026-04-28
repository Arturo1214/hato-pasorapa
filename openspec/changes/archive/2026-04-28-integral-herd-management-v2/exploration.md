## Exploration: integral-herd-management-v2

### Current State
El producto ya tiene base offline-first consolidada para usuarios/ganaderos/animales, eventos (operativos, sanitarios, reproductivos), imágenes, reporting operativo V1 y sincronización/conflictos V2.  
Actualmente **no existe** un modelo explícito para lotes de manejo, ledger de costos productivos ni indicadores avanzados del hato. En reporting V1, la proyección local (`admin-reporting`) está acotada a conteos y actividad reciente con ventanas `7d/30d` y exclusión explícita de analítica predictiva.

### Affected Areas
- `hato-fe/src/app/core/offline/offline-types.ts` — contrato de entidades offline/sync; hoy no incluye tipos para lotes, costos o productividad.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — persistencia local de snapshots/outbox/checkpoints; requiere soportar nuevas entidades manteniendo continuidad offline.
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.ts` — recalcula métricas desde snapshots locales; hoy toma USER/GANADERO/ANIMAL + eventos.
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` — lógica de agregación; hoy limitada a agregados básicos + actividad reciente.
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` — guardrails V1 (sin predictiva); debe evolucionar a exclusiones V2 (seguir sin BI predictiva).
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` — catálogo de entidades sincronizables; base para habilitar nuevas entidades de hato integral.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — pipeline push/pull por entidad; punto crítico para incorporar operaciones offline de nuevas entidades.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — matriz de capacidades offline + mapeo payload→DTO; requiere ampliar capability/policies.
- `hato-be/src/main/resources/db/changelog/master.yaml` + nuevos changelogs — evolución de esquema para lotes, productividad, costos e indicadores.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` y `service/dto/AnimalRequest.java` — potencial relación animal↔lote y atributos mínimos para clasificación productiva.

### Approaches
1. **Extender `ANIMAL` + metadata en eventos (enfoque mínimo)** — guardar lote/costo/productividad como campos extra o metadata heterogénea.
   - Pros: menor costo inicial de implementación, menos tablas nuevas.
   - Cons: baja trazabilidad histórica, consultas complejas, alto riesgo de deuda técnica y reglas inconsistentes offline.
   - Effort: Medium.

2. **Nuevas entidades de dominio + proyecciones derivadas (enfoque recomendado)** — introducir entidades explícitas para `LOT`, `HERD_PRODUCTIVITY_RECORD`, `HERD_COST_RECORD` y `HERD_INDICATOR_SNAPSHOT`, sincronizables offline, con proyecciones locales para vistas/indicadores.
   - Pros: modelo claro, auditable, extensible a futuro; mejor soporte de reconciliación/conflictos; mantiene patrón offline-first ya probado.
   - Cons: mayor superficie de cambios (tipos, sync, mappers, migraciones, tests); requiere diseño cuidadoso de granularidad temporal.
   - Effort: High.

3. **Solo capa de indicadores calculados sin ledger explícito** — derivar KPIs avanzados únicamente desde datos actuales y algunos campos agregados.
   - Pros: entrega rápida de dashboard avanzado.
   - Cons: no cubre bien costos/lotes con trazabilidad; difícil explicar origen del KPI; limita evolución a gestión integral real.
   - Effort: Medium.

### Recommendation
Adoptar el **Approach 2** por etapas internas V2: (a) lotes y asignación animal↔lote, (b) ledger de productividad/costos, (c) proyección de indicadores avanzados no predictivos.  
Razón: es el único enfoque que preserva consistencia offline-first, auditabilidad y escalabilidad funcional sin saltar prematuramente a BI predictiva.

### Risks
- **Complejidad de sync/conflictos** al sumar entidades y operaciones nuevas (riesgo de regresión sobre flujos ya estabilizados).
- **Modelado temporal** (día/semana/ciclo productivo) puede romper comparabilidad de indicadores si no se normaliza desde el inicio.
- **Costo de migración y testeo TDD estricto**: alto volumen de pruebas RED/GREEN para evitar drift en offline store y proyecciones.
- **UI scope creep**: intentar dashboards “BI-like” puede violar el límite acordado de “sin predictiva” en esta fase.

### Ready for Proposal
Yes — listo para `sdd-propose` con alcance V2 delimitado a: lotes operativos, registros productivos, registros de costos e indicadores avanzados descriptivos (tendencias/históricos comparativos), excluyendo modelos predictivos, scoring inteligente y forecasting.
