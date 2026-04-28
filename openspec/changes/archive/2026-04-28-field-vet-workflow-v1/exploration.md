## Exploration: field-vet-workflow-v1

### Current State
El sistema ya opera offline-first con patrón queue-first + snapshots + sync incremental por `entityType`. En dominio sanitario existe un ledger append-only (`ANIMAL_HEALTH_EVENT`) con validación tipada de metadata, timeline por animal y continuidad básica de tratamientos (started/follow-up/closed). En frontend, la carga sanitaria hoy vive dentro de `animals-page.component` con formularios directos y servicio `AnimalsHealthEventsService`; en backend, la capa REST/Service/Repository ya soporta creación idempotente por `operationId`, pull incremental y validaciones de negocio para tratamientos.

En términos de alcance, la base ya cubre parte del problema veterinario (eventos sanitarios), pero NO existe todavía un flujo de visita de campo como agregado explícito con checklist de visita, estructura de nota clínica y protocolo operativo longitudinal separado del evento puntual.

### Affected Areas
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — hoy concentra formularios sanitarios; V1 vet de campo debería desacoplarse a feature propia de visitas.
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` — patrón offline/sync reutilizable para registrar acciones veterinarias encoladas.
- `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` — punto actual para estado derivado de tratamiento; base para seguimiento básico post-visita.
- `hato-fe/src/app/core/offline/offline-types.ts` — eventual ampliación de tipos/metadata (sin romper contrato offline-first).
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalHealthEventResource.java` — API actual de timeline sanitario por animal, potencial backend de lectura para vista de seguimiento vet.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` — reglas sanitarias y continuidad; candidato para integrar protocolos/checklist mínimos V1.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` — validación de metadata tipada; punto natural para contrato de checklist/nota/protocolo V1.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` — filtros/timeline y consultas por caso de tratamiento; útil para seguimiento básico por visita.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — push/pull incremental para `ANIMAL_HEALTH_EVENT`; debe preservarse intacto el principio offline-first.

### Approaches
1. **Extender `ANIMAL_HEALTH_EVENT` con metadata de visita veterinaria (recomendado V1)** — modelar visita/checklist/nota/protocolo como contratos tipados dentro del ledger sanitario existente.
   - Pros: reutiliza sync, idempotencia, outbox, conflicto y timeline ya productivos; menor superficie de cambio; coherencia con arquitectura append-only.
   - Cons: metadata crece y exige disciplina de validación para no degradar legibilidad del agregado sanitario.
   - Effort: Medium.

2. **Crear nuevo agregado `FIELD_VET_VISIT` (entityType + tablas + endpoints + sync propio)** — separar completamente visita veterinaria del evento sanitario.
   - Pros: modelo más puro para dominio clínico, frontera semántica muy clara a futuro.
   - Cons: duplica pipeline offline/sync en V1, más riesgo de regresión, más costo TDD y coordinación FE/BE.
   - Effort: High.

### Recommendation
Para V1 conviene **Approach 1**: extender el ledger sanitario existente con un contrato explícito de “visita veterinaria de campo” dentro de metadata tipada, manteniendo `ANIMAL_HEALTH_EVENT` como backbone offline-first. Esto permite entregar rápido checklist/nota/protocolo/seguimiento básico sin abrir una segunda línea de sincronización.

Delimitación V1 propuesta:
- In scope:
  - Registro de visita de campo asociada a `animalUuid` y timestamp de visita.
  - Checklist estructurado (ítems mínimos booleanos + observación opcional por ítem).
  - Nota clínica breve estructurada (motivo, hallazgos, conducta/plan).
  - Protocolo aplicado básico (tipo de protocolo + estado: iniciado/seguimiento/cierre).
  - Seguimiento básico (próximo control + estado actual activo/cerrado por caso/protocolo).
- Out of scope explícito:
  - Analítica clínica avanzada (scoring, predicción, correlaciones, cohortes).
  - Facturación/costos/insumos valorizados.
  - Adjuntos clínicos complejos (imágenes/documentos), reglas expertas avanzadas.

### Risks
- Riesgo de “metadata blob” sin contrato fuerte si no se define esquema estricto por tipo de visita/protocolo.
- Riesgo UX por sobrecargar `animals-page` si no se separa feature de visitas veterinarias.
- Riesgo de inconsistencias temporales en seguimiento (nextDueAt/ocurrencia) sin validaciones determinísticas.
- Riesgo de scope creep hacia reporting/facturación si no se dejan exclusiones V1 en spec/proposal.

### Ready for Proposal
Yes — listo para pasar a `sdd-propose` con alcance V1 acotado y exclusiones explícitas (sin analítica avanzada ni facturación), preservando strict TDD y offline-first.
