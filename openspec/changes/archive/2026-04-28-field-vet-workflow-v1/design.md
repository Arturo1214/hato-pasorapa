# Design: Field Vet Workflow V1

## Technical Approach

Se implementa un flujo veterinario de campo sobre el agregado existente `ANIMAL_HEALTH_EVENT` (sin entidad nueva ni pipeline nuevo de sync). La estrategia es: (1) extender catálogo de tipos de evento y metadata tipada, (2) validar en backend por subtipo con reglas temporales, (3) reutilizar cola offline/sync incremental existente, y (4) desacoplar UI veterinaria fuera de `animals-page` a una feature dedicada con formularios reactivos tipados y timeline proyectado.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Nuevo agregado `FIELD_VET_VISIT` + nuevas tablas/endpoints | Mayor claridad semántica, pero duplica sync/idempotencia y aumenta riesgo de drift | ❌ Rechazado |
| Reusar `ANIMAL_HEALTH_EVENT` con metadata tipada por tipo | Menor fricción técnica y continuidad offline-first; requiere contrato estricto de metadata | ✅ Elegido |

| Option | Tradeoff | Decision |
|---|---|---|
| Metadata libre `Map<String,Object>` sin discriminación | Flexible pero frágil; validación tardía e inconsistencias en timeline | ❌ Rechazado |
| Metadata discriminada por `healthEventType` (DTO/TS unions + validadores) | Más código de contrato, pero seguridad de schema y UX guiada | ✅ Elegido |

| Option | Tradeoff | Decision |
|---|---|---|
| Mantener formulario vet dentro de `animals-page.component.ts` | Menos cambios iniciales; sigue acoplamiento y complejidad alta (archivo >1k líneas) | ❌ Rechazado |
| Extraer feature vet (`/features/admin/vet-visits/*`) con contenedor/presentacionales | Refactor inicial, pero separa responsabilidades y habilita evolución V2 | ✅ Elegido |

## Data Flow

```text
Vet Visit Form (feature vet)
   └─ build typed payload (operationId, occurredAt, metadata)
      └─ AnimalsHealthEventsService.createEvent()
         └─ OfflineStore.enqueueOperation(entity=ANIMAL_HEALTH_EVENT)
            ├─ Snapshot optimista local
            └─ SyncOrchestrator push/pull (existente)
               └─ SyncService.handleAnimalHealthEventCreate()
                  └─ AnimalHealthEventMapper + AnimalHealthEventService
                     ├─ validación metadata por tipo
                     ├─ validación continuidad/protocolo
                     └─ persistencia + pull item
```

Timeline FE sigue leyendo snapshots + outbox (`decorateAnimalHealthTimeline`), agregando proyección `treatmentStatus` y `nextDueAt` para seguimiento básico activo/cerrado.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Create | Nueva pantalla/feature veterinaria con formulario tipado, checklist y protocolo. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Create | Mapeo form→`AnimalHealthEventCreateInput` con metadata discriminada. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modify | Remover UI veterinaria embebida y dejar vínculo/navegación a feature vet. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` | Modify | Extender unión de `healthEventType` para tipos vet y contratos de creación. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` | Modify | Proyección de estado de protocolo/seguimiento (`active|closed`, próximo control). |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Tipos metadata vet (`checklist`, `clinicalNote`, `protocol`). |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalHealthEventType.java` | Modify | Nuevos tipos veterinarios V1. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modify | Validación tipada por subtipo vet + parseo seguro de metadata. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modify | Reglas de consistencia temporal/protocolo y transición básica de seguimiento. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` | Modify | Query helper para timeline/protocolo sin parseo frágil string. |

## Interfaces / Contracts

```ts
type VetProtocolStatus = 'STARTED' | 'FOLLOW_UP' | 'CLOSED';

interface VetChecklistItem { code: string; ok: boolean; note?: string }
interface VetClinicalNote { reason: string; findings: string; plan: string }
interface VetProtocol { kind: string; status: VetProtocolStatus; nextDueAt?: string }

type VetVisitMetadata = {
  checklist: VetChecklistItem[];
  clinicalNote: VetClinicalNote;
  protocol: VetProtocol;
};
```

```java
// Mapper-level contract (pseudo)
validateMetadata(type, metadata, notes):
  if type in VET_* => require checklist>=1, clinicalNote fields, protocol.status
  if protocol.nextDueAt != null => parse OffsetDateTime and ensure >= occurredAt
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | Mapeo metadata vet, validaciones de formulario, timeline projection | `*.spec.ts` (Vitest) para mapper/adapters y señales del contenedor. |
| Unit BE | Validación por tipo vet, transiciones protocolo, reglas temporales | JUnit5 sobre `AnimalHealthEventMapper` y `AnimalHealthEventService`. |
| Integración BE | Push sync `ANIMAL_HEALTH_EVENT` con payload vet e idempotencia por `operationId` | Tests Quarkus + rest-assured sobre flujo sync/create/list. |
| E2E | No aplica en V1 | E2E no configurado en repo. |

## Migration / Rollout

No migration required. Se agrega comportamiento compatible hacia adelante sobre `metadataJson`; eventos previos siguen válidos. Rollout por feature toggle UI (ruta vet visible solo para roles habilitados) y backend aceptando tipos nuevos desde deploy.

## Open Questions

- [ ] Definir naming final de nuevos `AnimalHealthEventType` vet (prefijo `VET_` vs semántica clínica directa).
- [ ] Confirmar si `nextDueAt` es opcional en `STARTED` o obligatorio para ciertos protocolos.
- [ ] Acordar si checklist usa catálogo cerrado (codes) o libre en V1.
