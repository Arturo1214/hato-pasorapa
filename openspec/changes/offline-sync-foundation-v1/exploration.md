## Exploration: offline-sync-foundation-v1

### Current State
El proyecto ya tiene una base administrativa funcional (auth real, usuarios admin, ganaderos, `X-Operation-Id` e idempotencia básica), pero **todavía no tiene capa offline-first operativa**.

- **Frontend (Angular)**
  - No hay PWA real: no existe `@angular/service-worker`, `ngsw-config.json` ni `manifest.webmanifest` (`hato-fe/package.json`, `hato-fe/angular.json`, `hato-fe/public/`).
  - Persistencia local actual: sólo `localStorage` para sesión (`hato-fe/src/app/core/auth/data-access/auth.service.ts`).
  - Mutaciones admin/ganaderos generan `X-Operation-Id` en cliente, pero son llamadas HTTP directas; no existe outbox/inbox local, scheduler, retries ni backoff (`admin-users.service.ts`, `ganaderos.service.ts`).
  - No hay detección online/offline ni estado global de sincronización en UI.

- **Backend (Quarkus)**
  - Admin/Ganaderos tienen contrato base offline (`UUID`, `@Version`, `updatedAt`, `lastSyncedAt`) e idempotencia vía `operation_log` (`User`, `Ganadero`, `OperationLog`, `AdminUsersResource`, `GanaderosResource`).
  - No existe loop de sync server-side (sin endpoints de pull incremental/cursor ni plan de conflictos explícito).
  - `animals` está desalineado con el contrato offline: usa `BIGSERIAL/Long id`, sin `version`, `updatedAt`, `lastSyncedAt`, ni `X-Operation-Id` (`Animal`, `AnimalRequest`, `AnimalResponse`, `AnimalResource`, changelog `001-init-animals.yaml`).

Conclusión: hoy existe una **foundation parcial** (idempotencia puntual), pero faltan los bloques obligatorios para operación rural sin red: PWA instalable, storage durable, cola de operaciones, sync loop y contrato homogéneo (incluyendo `animals`).

### Affected Areas
- `hato-fe/package.json` — agregar dependencias/capacidades PWA (service worker) y storage local durable.
- `hato-fe/angular.json` — habilitar assets/manifest/service worker de build PWA.
- `hato-fe/public/` — manifest e íconos instalables.
- `hato-fe/src/app/app.config.ts` — providers de service worker + servicios base de conectividad/sync.
- `hato-fe/src/app/core/**` (nuevo módulo `offline/` recomendado) — storage engine, outbox/inbox local, sync orchestrator, retry/backoff policy y métricas mínimas.
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` — mutaciones pasan por capa offline (queue-first), no HTTP directo.
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` — idem, con operación idempotente estable.
- `hato-fe/src/**/*.spec.ts` — tests de nueva semántica offline (queue, replay, backoff, conflictos mínimos).
- `hato-be/src/main/java/**/web/rest` — nuevos endpoints de sincronización (push batch + pull incremental) y códigos de conflicto estandarizados.
- `hato-be/src/main/java/**/service` — aplicación de lote de operaciones idempotentes, estrategia mínima de conflictos y cursor de cambios.
- `hato-be/src/main/java/**/repository` + `**/domain` — soporte de consultas delta (`updatedAt/version`) y/o log de cambios.
- `hato-be/src/main/resources/db/changelog/*.yaml` — normalizar contrato offline en `animals` y estructuras mínimas de sync/observabilidad.
- `hato-be/src/test/java/**/*.java` — tests REST/integración para sync loop, reintentos idempotentes y conflictos 409.

### Approaches
1. **Foundation vertical real (PWA + queue-first + sync mínimo + contrato homogéneo)**
   - Pros:
     - Cierra la brecha crítica rural sin intentar plataforma full.
     - Reutiliza base existente (`operation_log`, `version`) en vez de reescribir todo.
     - Deja listos contratos universales para siguientes módulos.
   - Cons:
     - Requiere tocar FE y BE en paralelo.
     - Obliga a decidir ahora formato de operación y semántica mínima de conflicto.
   - Effort: **Medium/High**

2. **Sólo FE offline shell (PWA + storage + outbox local) sin endpoints de sync dedicados**
   - Pros:
     - Menor esfuerzo inicial en backend.
     - Permite demo offline local rápida.
   - Cons:
     - No resuelve sincronización real entre dispositivos.
     - Conflictos y observabilidad quedan diferidos, con riesgo de retrabajo fuerte.
     - No corrige la desalineación contractual de `animals`.
   - Effort: **Medium (inicial) / High (total)**

### Recommendation
Recomiendo **Approach 1** con scope V1 estricto y acotado:

**In scope V1 (sí o sí):**
1. **PWA instalable mínima** (manifest + service worker + instalación básica).
2. **Storage local durable** para datos y cola de operaciones (IndexedDB).
3. **Outbox/inbox local** con operación canónica (`operationId`, `entityType`, `entityId`, `opType`, `payload`, `attempts`, `nextAttemptAt`).
4. **Sync loop básico**: trigger manual + automático por reconexión/app start; push de outbox y pull incremental de cambios.
5. **Retries con backoff exponencial con jitter** (límite de intentos y estado dead-letter).
6. **Conflictos mínimos**: detectar mismatch por `version` y devolver `409 CONFLICT` con payload estandarizado para UI.
7. **Observabilidad básica**: contadores de operaciones pendientes/exitosas/fallidas + timestamp de último sync (FE) y métricas/códigos en BE.
8. **Homologación contractual de `animals`** al baseline offline (UUID + versionado + updatedAt + idempotencia en mutaciones), aunque la UX de animales offline completa quede para siguiente change.

**Out of scope V1 (explícito):**
- Resolución avanzada de conflictos (merge semántico automático).
- Sincronización en background con Background Sync API avanzada.
- Adjuntos binarios/media offline.
- Multi-tenant/multi-establecimiento complejo.

**Decisiones críticas a tomar AHORA (bloqueantes para proposal):**
1. Envelope canónico de operación offline (campos obligatorios y versionado de esquema).
2. Estrategia de conflicto mínima (last-write-wins no; preferir optimistic concurrency con `version`).
3. Tipo de cursor de pull (`updatedAt + id` o secuencia monotónica dedicada).
4. Política de retries/backoff y límites de dead-letter.
5. Plan de migración de `animals` (dual-read temporal o migración directa de IDs).

### Risks
- **Migración de `animals` a UUID** puede impactar datos existentes y referencias futuras si no se define estrategia transicional.
- **Sin contrato de operación canónico** FE/BE podrían divergir y romper idempotencia/replay.
- **Conflictos subespecificados** pueden generar pérdida de datos silenciosa en reconexión.
- **Falta de trazabilidad operativa** (si no se instrumenta V1) dificulta soporte en campo rural.
- **Scope creep**: intentar resolver “offline completo” en este change diluye entrega y aumenta riesgo.

### Ready for Proposal
**Yes** — listo para `sdd-propose` con alcance V1 cerrado y decisiones bloqueantes explícitas.
