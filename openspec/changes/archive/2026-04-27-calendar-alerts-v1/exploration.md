## Exploration: calendar-alerts-v1

### Current State
El sistema ya tiene base offline-first robusta para `ANIMAL`, `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT` y `ANIMAL_IMAGE`, con outbox/snapshots/checkpoints en FE y push/pull incremental en BE (`offline-types.ts`, `offline-store.service.ts`, `sync-orchestrator.service.ts`, `SyncService.java`, `SyncPayloadMapper.java`).

Hallazgos relevantes para calendario/alertas:
- No existe módulo de calendario ni alertas hoy (sin rutas, servicios ni entidades `calendar/alert`).
- La UI actual registra eventos sanitarios y reproductivos en `animals-page.component.ts`; ya captura `nextDueAt` en metadata sanitaria, y BE lo valida (`AnimalHealthEventMapper.validateMetadata`), pero no hay cronograma ni recordatorios derivados.
- Los endpoints de historial sanitario/reproductivo son por animal (`/api/animals/{uuid}/health-events`, `/api/animals/{uuid}/reproduction-events`), mientras que el sync offline ya trae snapshots globales por tipo de entidad.
- La PWA está instalada con service worker (`ngsw-worker.js`), pero no hay infraestructura de notificaciones locales/background dedicada.

Conclusión: el V1 más consistente es construir un calendario operacional **offline/local-first** basado en snapshots/eventos existentes, con alertas locales y sin exigir backend nuevo en la primera iteración.

### Affected Areas
- `hato-fe/src/app/app.routes.ts` — nueva ruta de calendario/alertas V1.
- `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` — acceso de navegación al módulo calendario.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — fuente primaria para leer snapshots locales y derivar agenda offline.
- `hato-fe/src/app/core/offline/offline-types.ts` — posible extensión mínima de tipos si se persisten preferencias/estado local de alertas.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — punto de enganche para recalcular agenda tras ciclos de sync.
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — origen actual de metadata útil (`nextDueAt`, eventos reproductivos/operativos) que alimenta el cronograma.
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` — contrato sanitario y snapshots para próximas acciones.
- `hato-fe/src/app/features/admin/animals/data-access/animals-reproduction-events.service.ts` — contrato reproductivo y snapshots para hitos próximos.
- `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.ts` — eventos operativos previstos para agenda operacional.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` + `SyncPayloadMapper.java` — sólo afectados si V1 decide introducir entidad sincronizada de alertas (opción alternativa).
- `hato-fe/src/app/**/*.spec.ts` y `hato-be/src/test/java/**` — cobertura TDD obligatoria por `strict_tdd: true`.

### Approaches
1. **Agenda derivada localmente desde snapshots existentes (recomendado)** — generar cronograma y alertas en FE leyendo snapshots offline (`ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_EVENT`, `ANIMAL`) y reglas V1 simples (p. ej. `nextDueAt`, ventanas de seguimiento configurable), con recordatorios in-app y notificación local best-effort.
   - Pros: respeta offline-first real; evita cambios BE/sync en V1; entrega rápida y con menor riesgo en pipeline existente.
   - Cons: alertas no comparten estado entre dispositivos; reglas complejas quedan limitadas; notificación de SO depende de permisos/soporte del navegador.
   - Effort: Medium

2. **Nueva entidad sincronizada `CALENDAR_ALERT` (FE+BE)** — persistir alertas explícitas y su estado de lectura/snooze en sync push/pull.
   - Pros: estado consistente entre dispositivos y auditable en backend; mejor base para escalado multi-dispositivo.
   - Cons: amplía mucho alcance (nuevo entityType, tabla, mapper, handlers sync, migraciones, contratos FE/BE); mayor riesgo para V1.
   - Effort: High

3. **Calendario online-only vía endpoints agregados backend** — el BE calcula agenda por rango y FE sólo consume.
   - Pros: reglas centralizadas y consistentes en servidor.
   - Cons: contradice objetivo offline/local; experiencia degradada sin conectividad; introduce dependencia de conectividad para uso diario.
   - Effort: Medium/High

### Recommendation
Recomiendo **Approach 1** para `calendar-alerts-v1`.

Delimitación V1 propuesta (IN):
1. **Cronograma operativo local** por rango (hoy/7 días/30 días) derivado de snapshots offline existentes.
2. **Fuentes iniciales de agenda**:
   - Sanitario: `metadata.nextDueAt` cuando exista, más eventos de tratamiento en curso.
   - Reproductivo: hitos próximos basados en eventos de servicio/preñez/parto ya registrados (reglas simples configurables del V1).
   - Operativo: eventos operativos con fecha futura explícita o marcados para seguimiento.
3. **Alertas locales V1**:
   - Estado `upcoming | due_today | overdue` calculado localmente.
   - Banner/lista priorizada in-app y contador de pendientes.
   - Notificación local best-effort (si hay permiso), sin prometer entrega en background cerrado.
4. **Preferencias locales mínimas**: horizonte de aviso (ej. 1/3/7 días) y silenciamiento temporal local.

Fuera de alcance explícito (OUT):
- Push remotas/Firebase/APNs/WebPush server-side.
- Sincronización multi-dispositivo de estado de alertas (read/snooze) en V1.
- Motor de reglas clínicas/reproductivas avanzadas y analítica predictiva.
- Automatizaciones complejas dependientes de ejecución garantizada en segundo plano.

### Risks
- **Confiabilidad de notificación local**: navegadores limitan notificaciones en background/suspendido; hay que comunicar explícitamente que V1 prioriza alerta in-app.
- **Calidad de datos de agenda**: si `nextDueAt` o metadata no se cargan de forma consistente, habrá falsos positivos/negativos.
- **Scope creep de reglas**: intentar cubrir todos los protocolos sanitarios/reproductivos en V1 puede bloquear entrega.
- **Costo de lectura local**: derivar agenda desde snapshots grandes puede requerir optimización incremental para no degradar UX.
- **Decisión de persistencia**: si luego se necesita sincronizar estado de alertas, habrá migración de modelo local a entidad sincronizada.

### Ready for Proposal
Yes — hay evidencia suficiente para pasar a `sdd-propose` con un V1 acotado: cronograma y alertas locales/offline derivadas de eventos ya existentes, reglas simples de prioridad temporal y exclusión explícita de push remota/multi-dispositivo.
