# Exploration: veterinary-visits-redesign-v1

## Current State

El sistema tiene un ledger sanitario append-only (`ANIMAL_HEALTH_EVENT`) que ya soporta visitas veterinarias de campo (`FIELD_VET_VISIT`) con:
- Checklist estructurado (`FieldVetChecklistItem` con código, ok boolean, note opcional)
- Nota clínica (`FieldVetClinicalNote`: reason, findings, plan)
- Protocolo (`protocol.status`: `STARTED | FOLLOW_UP_REQUIRED | CLOSED` + `nextDueAt`)
- Seguimiento por `visitId` como chain identifier
- Estado derivado `treatmentStatus: active | closed` decorado desde timeline
- Offline-first con enqueue + sync idempotente por `operationId`
- Integración con calendario (`toHealthAgendaItems` → `FIELD_VET_VISIT` → 'Control veterinario de campo')

** Problemas identificados:**

1. **Vista actual (`vet-visits-page.component`)**: Es per-animalUuid, no central. Requiere ingresar UUID manualmente (campo de texto sin selector visual). Filtra por visitId opcional. No permite ver visitas globales del rodeo ni visitar por ganadera completo.

2. **English hardcoded labels**: Protocol statuses en inglés (`ACTIVE`, `CLOSED`), checklist codes (`GENERAL_APPEARANCE`, `TEMPERATURE`, etc.), columnas (`Visita`, `Fecha/hora`, `Estado`, `Próximo control` — mix de español e inglés).

3. **Sin modo global vs. específico**: El registro siempre requiere `animalUuid`. No hay forma de registrar una campaña de vacunación masiva sin especificar animal. Metadata `visit.mode` no existe.

4. **Sin selector visual de animal**: El campo `animalUuid` es un `<input matInput>` sin autocomplete ni búsqueda por arete/marca/tatuaje.

5. **No hay propagation a historia de animal en global**: Una campaña registrada como `FIELD_VET_VISIT` con `visit.mode=GLOBAL` y sin `animalUuid` (o con scope de rodeo) no tiene mecanismo para aparecer en la historia sanitaria de cada animal del rodeo.

6. **El backend solo lista por animal**: `GET /api/animals/{uuid}/health-events` es la única query possible. No hay endpoint que devuelva visitas agregadas globalmente (todas con `visitId` matching o tipo campaña) sin filtrar por animalUuid.

---

## Affected Areas

### Frontend
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` — solo per-animal, input UUID manual, mix de labels ES/EN. Reemplazo completo de UX + lógica de registro con modo global/específico.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` — necesita agregar `visit.mode` y posiblemente `targetAnimalUuids[]` al metadata para global.
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` — `listEvents` solo funciona por animalUuid. Necesitará endpoint BE de listado global o adaptar el request.
- `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` — `decorateAnimalHealthTimeline` decorates con `treatmentStatus` desde `visitId`. Funciona, pero necesita respetar nuevos modos.
- `hato-fe/src/app/features/admin/animals/animal-detail-page.component.ts` — Tab "Salud" lista eventos crudos con `healthEventLabel()` que replaceAll '_' → espacio, sin traducir a español semánticamente.
- `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.ts` — `healthEventTitle()` mapea FIELD_VET_VISIT a 'Control veterinario de campo', funcionalmente correcto.
- `hato-fe/src/app/core/offline/offline-types.ts` — `FieldVetProtocolStatus`, `FieldVetChecklistCode`, `FieldVetChecklistItem`, `FieldVetClinicalNote` definidos ahí; labels en inglés en el template. Necesitarás constantes traducidas.

### Backend
- `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalHealthEventResource.java` — endpoint único `GET /api/animals/{uuid}/health-events` no permite listado global. Necesitarás nuevo endpoint o query param `allAnimals=true` + filtros.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` — `validateFieldVetVisitContinuity` valida que visitId tenga protocolos STARTED → FOLLOW_UP → CLOSED; funciona para específico. Para global, habría que relajarlo o evitarlo.
- `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalHealthEventType.java` — solo 7 tipos; `FIELD_VET_VISIT` ya existe. Podría distinguirse campaign vs. specific visit por metadata, no por nuevo tipo.
- `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` — `listHistory` y `listByVisit` aceptan animalUuid. Para global, necesitarás query sin ese filtro.
- `hato-be/src/main/resources/db/changelog/006-animal-health-events-v1.yaml` — schema existente con metadata_json CLOB. Puedes agregar campos nuevos a metadata_json sin migrar schema si no necesitas indexación.

---

## Approaches

### Approach 1: Extender BE con endpoint global + FE central view (RECOMMENDED)

**Descripción**: Mantener `ANIMAL_HEALTH_EVENT` con `visit.mode` en metadata y crear nuevo endpoint GET `api/vet-visits` que liste todas las visitas con filtros (ganadero, fecha, modo, tipo). FE: nueva vista central `vet-visits-central-page` con DataTable, selector de animal con autocomplete (pattern existente de arete/marca/tatuaje), registro con diálogo que pregunte modo global/específico.

**Pros**:
- Reutiliza sync, offline-first, idempotencia, outbox existentes
- Metadata blob permite guardar `visit.mode: GLOBAL | SPECIFIC` + `targetAnimalUuids[]` sin cambio de schema
- No hay nuevo entityType ni pipeline sync nuevo
- Alineado con Approach 1 de field-vet-workflow-v1 exploration previa

**Cons**:
- `AnimalHealthEvent` no fue diseñado para campañas globales; requiere disciplina de metadata (sin constraints DB)
- Endpoint listado global requiere nueva query/repository method
- Necesita validar en BE que modo GLOBAL no tenga animalUuid conflictivo

**Effort**: Medium-High (FE grande por nueva vista central + dialogs; BE media por endpoint + repository query)

---

### Approach 2: Nuevo agregado `VETERINARY_CAMPAIGN` (entityType separado)

**Descripción**: Crear entity + endpoint + sync pipeline paralelo para campañas globales. Cada campaña crea múltiples `ANIMAL_HEALTH_EVENT` replicas (una por animal) o referenciadas desde campaign. Visitas específicas permanecen en `FIELD_VET_VISIT` existente.

**Pros**:
- Frontera semántica pura: campaña global ≠ visita específica
- Relación many-to-many con animales en tabla propia

**Cons**:
- Duplica pipeline offline/sync: nuevo entityType `VETERINARY_CAMPAIGN`
- Más regression risk, más TDD, más coordinación FE/BE
- Complejidad alta para V1 cuando ya existe infraestructura de eventos

**Effort**: High

---

### Approach 3: FE-only refactor de vet-visits-page (UI/UX only, BE unchanged)

**Descripción**: Reescribir `vet-visits-page.component.ts` con DataTable central (como `ganaderos-page`), selector visual de animal por autocomplete arete/marca/tatuaje, labels en español, modo registro global/específico usando diálogo. Continúa usando `AnimalsHealthEventsService.listEvents(animalUuid)` para listado per-animal. Para vista global, se harian múltiples llamadas por animal o se mostrarian visitas "propias" del ganadero logueado.

**Pros**:
- Cambio acotado a FE, sin tocar BE ni contratos sync
- Más rápido de entregar

**Cons**:
- No hay listado verdaderamente central/global en BE
- Para ver todas las visitas del rodeo, FE tendría que iterar animales o construir complejo拼接 client-side
- Registro global requiere decidir si es un evento por animal o un "pseudo-Evento" sin animal; ambiguity persiste

**Effort**: Low (pero resultado incompleto y técnicamente frágil)

---

## Recommendation

**Approach 1** — Extender BE con endpoint global + FE central view.

Rationale:
- El sistema ya tiene infraestructura de eventos sanitarios offline-first productiva. Trabajar con ella en lugar de crear paralela.
- El gap principal es UX (vista central con DataTable, selector animal visual, labels ES) + modo global/específico en registro.
- Nuevo endpoint `GET /api/vet-visits` con filtros es cambio acotado en BE; repository method adicional y nuevo resource.
- FE puede construir vista central sobre nuevo endpoint y现有的 per-animal listing sigue funcionando para detalle.
- Metadatos en `visit.mode` e `visit.targetAnimalUuids` no requieren schema migration — son campos JSON dentro de `metadata_json`.

**Delimitación V1 propuesta:**
- In scope:
  - Nueva vista central `vet-visits` con DataTable (todas las visitas filtrables por ganadero, fecha, modo, tipo)
  - Registro con diálogo modal que pregunte: "¿La visita es para un animal específico o para todo el rodeo?"
    - Específico: autocomplete animal (arete/marca/tatuaje), pattern existente
    - Global: sin animal, marca como campaña
  - Endpoint BE `GET /api/vet-visits` (global listing por filters)
  - Propagation: visita global aparece en tab "Salud" de cada animal del rodeo
  - Follow-up chain: visita crea scheduling para próximo control (ya existe `nextDueAt`)
  - Estados: `ACTIVE`, `PENDING_NEXT_VISIT`, `CLOSED` (mapear de protocolStatus)
  - Calendario: salud events con `nextDueAt` aparecen como alertas (ya existe integración)

- Out of scope explícito:
  - Analytics advanced o reportes de campaña
  - Programar más de un animal en visita específica (single animal por evento por ahora)
  - Facturación o costos
  - Multimedia adjuntos
  - Notificaciones push proactivas (el calendario funciona)

---

## Risks

- **Metadata blob sin constraints**: `visit.mode` e `targetAnimalUuids` no tienen validación DB. Si FE envía inconsistencias, BE no las atrapa automáticamente. Mitigación: validación en `AnimalHealthEventMapper.validateMetadata()` para `FIELD_VET_VISIT`.
- **Endpoint global sin auth scoped correctamente**: `GET /api/vet-visits` debe filtrar por ganaderoId del token JWT para no exponer visitas de otros. Mitigación: usar `currentUser.ganaderoId` en service layer.
- **Frontend большой change**: Nueva vista central + dialogs + autocomplete es cambio FE grande. Debearse en fases.
- **VisitId como chain identifier ya existente**: El sistema actual chain visita por `visitId` agrupando eventos per-animal. Si global genera muchos eventos (1 por animal), el timeline por visitId puede crecer mucho. Mitigación: index correcto en `idx_animal_health_events_animal_occurred_event` ya existe.
- **Performance de query global**: Listar visitas de todos los animales del ganadero sin paginación puede ser lento. Mitigación: agregar paginación (cursor-based) desde el inicio.

---

## Discovery: Gotchas y patterns establecidos

1. **Animal selector pattern ya existe**: `animal-form-dialog.component.ts` y `animal-service-registration-dialog.component.ts` usan `<input [matAutocomplete]="autocomplete" placeholder="Buscar por arete, marca o tatuaje">` + `MatAutocomplete`. El mismo pattern debe reutilizarse en el diálogo de registro de visita.

2. **Labels mixtos EN/ES**: `VetVisitsPageComponent` template usa `ACTIVE` / `CLOSED` en columnas, mientras que `healthEventLabel()` hace `type.replaceAll('_', ' ')` para mostrar. Los codes del checklist (`GENERAL_APPEARANCE`, `TEMPERATURE`, etc.) se muestran tal cual sin traducir. Se necesita mapa de traducción completo.

3. **Protocol status vs treatmentStatus**: La columna muestra `treatmentStatus` que se deriva de `decorateAnimalHealthTimeline`. El protocolo real es `protocol.status` en metadata. Hay doble indirección.

4. **Offline-first ya productivo**: `AnimalsHealthEventsService.createEvent` hace enqueue + saveSnapshot + triggerManualSync si online. Funciona bien. No cambiar el flujo.

5. **VisitId es cliente-generado (UUID)**: `createUuid()` en el componente FE genera `crypto.randomUUID()`. El mapper lo pone en `visit.visitId` del metadata. Esto está bien para local-first.

6. **Backend validation de continuidad**: `validateFieldVetVisitContinuity` valida que para un mismo `visitId` haya secuencia STARTED → FOLLOW_UP_REQUIRED → CLOSED. Para global visits, esta validación aplica por cada animal individualmente, lo cual está bien.

---

## Ready for Proposal

**Yes** — luego de esta exploración, el sistema está listo para pasar a `sdd-propose` con:
- Scope V1 claro (vista central + registro con modo + endpoint global + propagation)
- Exclusiones explícitas
- Risks identificados con mitigaciones
- Discovery de patterns reutilizables (autocomplete, offline-first, sync)