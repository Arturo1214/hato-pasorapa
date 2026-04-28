## Exploration: animal-core-management-v1

### Current State
El backend ya tiene CRUD básico de `Animal` y contrato de sync incremental para `ANIMAL`, pero todavía está orientado a una versión técnica inicial, no al núcleo funcional de dominio animal.

- **Backend (actual)**
  - `Animal` usa `id` técnico `Long` + `uuid` único, con `code`, `tag`, `category`, `active`, `admissionDate`, `weightKg`, `version`, `updatedAt`, `lastSyncedAt`.
  - El CRUD REST (`/api/animals`) sigue identificando por `id` numérico y hoy no modela ownership con `Ganadero`.
  - El sync canónico (`/api/sync`) soporta `ANIMAL` sólo con `UPDATE` (no `CREATE`), usando `uuid` como identidad de entidad en push/pull.
  - Filtros existentes: `id`, `code`, `tag`, `category`, `active`, `admissionDate`.

- **Frontend (actual)**
  - No existe feature de animales (rutas/menu/pages/services) en `hato-fe`.
  - La infraestructura offline sí existe y está madura para `USER|GANADERO|ANIMAL` (outbox/inbox/snapshots/checkpoints, retry/backoff, conflicto `version_conflict`, sync loop central).
  - El ecosistema de snapshots para `GANADERO` ya está operativo, lo que habilita selección offline de propietario para animales.

Conclusión: hay base técnica para sync offline, pero falta cerrar el **modelo funcional del núcleo animal V1** (identidad de negocio, ownership, filtros de operación rural y boundary claro con eventos/historial).

### Affected Areas
- `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` — extender identidad visible y ownership actual.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalRequest.java` — definir atributos mínimos de ficha V1.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalResponse.java` — exponer identidad y ownership de forma estable para FE/sync.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalMapper.java` — mapear nuevos campos core sin mezclar historial/eventos.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalService.java` — validaciones de unicidad/ownership y reglas de estado actual.
- `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalCriteria.java` — filtros esenciales de operación (identificador visible, propietario, estado).
- `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalQueryService.java` — consultas filtradas para listado operativo.
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalResource.java` + `web/util/AnimalCriteriaDoc.java` — contrato API V1 de ficha animal.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — habilitar payloads de alta/edición compatibles con offline-first.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — ampliar matriz de capacidad `ANIMAL` para V1 core (alta/edición).
- `hato-be/src/main/resources/db/changelog/*.yaml` — migraciones de esquema para ownership e identificadores visibles.
- `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` — contrato REST core.
- `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` y `service/SyncServiceTest.java` — contrato offline ANIMAL alta/edición.
- `hato-fe/src/app/features/` (nuevo `animals/`) — feature standalone de listado + formulario core.
- `hato-fe/src/app/app.routes.ts` y `ui/layout/main-layout/sidebar/sidebar.ts` — entrada de navegación al módulo animales.
- `hato-fe/src/app/core/offline/offline-types.ts` + specs relacionadas — confirmar operación `CREATE/UPDATE` ANIMAL en outbox y snapshots.

### Approaches
1. **Animal Core V1 como agregado único de estado actual (sin tablas de eventos todavía)** — ampliar `animals` con ownership + identificadores visibles + atributos mínimos y exponer alta/edición/listado offline-first.
   - Pros: entrega valor funcional real rápido; mantiene simple la operación rural; reutiliza toda la base de sync ya implementada.
   - Cons: decisiones de modelo actual deben quedar bien documentadas para no chocar con historial futuro.
   - Effort: Medium

2. **Intentar introducir desde ya modelo event-sourced parcial (core + eventos básicos)** — crear tablas/flujo de eventos para preparar sanitario/reproductivo ahora.
   - Pros: teóricamente más “future-proof” en historial.
   - Cons: scope creep alto, mezcla cambios futuros, más riesgo de romper entregabilidad V1 y TDD por explosión de escenarios.
   - Effort: High

### Recommendation
Recomiendo **Approach 1** con boundary explícito de V1.

**V1 IN scope (ficha animal core):**
1. **Identidad animal dual y estable**
   - Interna/canónica: `uuid` (para API pública, sync y relaciones futuras).
   - Técnica interna: `id` puede seguir existiendo en DB, pero NO ser identidad de negocio en FE.
   - Identificadores visibles V1: `arete`, `marca`, `tatuaje` (con reglas de unicidad definidas donde aplique).
2. **Atributos mínimos de ficha**
   - `uuid`, `ownerGanaderoId`, `active`, `category` (o equivalente operativo), `admissionDate`.
   - `arete/marca/tatuaje` + `pesoActualKg` opcional como snapshot actual (no serie histórica).
3. **Ownership actual con ganadero**
   - Relación explícita con `Ganadero` como propietario vigente (sin historial de transferencias en V1).
4. **Listado/filtros esenciales**
   - búsqueda por identificador visible (`arete|marca|tatuaje`),
   - filtro por `ownerGanaderoId`,
   - filtro por `active` y categoría,
   - paginación/orden estable para operación de campo.
5. **Offline-first para alta/edición**
   - Habilitar `ANIMAL CREATE` + `ANIMAL UPDATE` en canal `/sync`.
   - Alta offline con UUID cliente-canónico para evitar remapeos frágiles.
   - Mantener estrategia existente de `version_conflict` + `manual_refresh`.

**Diseño de compatibilidad futura (sin implementarlo ahora):**
- `animal-events-history-v1`: separar futuro historial en entidad/tabla de eventos referenciando `animalUuid`.
- `animal-health-events-v1`: eventos sanitarios como agregado aparte, no columnas ad-hoc en `animals`.
- `reproduction-and-birth-v1`: eventos reproductivos y partos en módulo separado.
- `animal-images-local-storage-v1`: adjuntos/media fuera del core (metadatos por `animalUuid`).

**V1 OUT of scope (explícito para evitar scope creep):**
1. Historial sanitario completo.
2. Historial reproductivo/partos.
3. Timeline/event sourcing de cambios de estado.
4. Historial de transferencias de ownership (solo propietario actual en V1).
5. Gestión de imágenes/archivos locales.
6. Reglas analíticas complejas (KPIs zootécnicos, alertas avanzadas).

### Risks
- **Deriva de identidad**: mantener `id` numérico como referencia principal en FE puede romper interoperabilidad futura; hay que canonizar `uuid` desde V1.
- **Ambigüedad en identificadores visibles**: sin reglas claras de unicidad para `arete/marca/tatuaje`, el listado y sync pueden generar duplicados operativos.
- **Ownership incompleto**: si no se modela `ownerGanaderoId` ahora, los siguientes changes (salud/reproducción/eventos) perderán anclaje de negocio.
- **Scope creep funcional**: intentar meter historial sanitario/reproductivo en este change diluye entrega del core.
- **Offline create mal definido**: si `ANIMAL CREATE` no usa identidad estable (UUID cliente), se complejiza reconciliación de snapshots/outbox.

### Ready for Proposal
Yes — el change está delimitado para pasar a `sdd-propose` con un objetivo concreto: entregar ficha animal core offline-first (alta/edición/listado/ownership/identidad) dejando eventos e historial para changes dedicados.
