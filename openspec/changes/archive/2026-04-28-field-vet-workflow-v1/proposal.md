# Proposal: Field Vet Workflow V1

## Intent

Estandarizar visitas veterinarias de campo en flujo offline-first, aprovechando el vertical sanitario existente, para registrar checklist, nota clínica, protocolo aplicado y seguimiento básico sin crear un nuevo pipeline de sync.

## Scope

### In Scope
- Registro de visita de campo por `animalUuid` con timestamp clínico y `operationId` idempotente.
- Checklist estructurado (ítems booleanos + observación opcional por ítem).
- Nota clínica breve estructurada (motivo, hallazgos, plan/conducta).
- Protocolo básico (tipo, estado: iniciado/seguimiento/cierre, próximo control opcional).
- Seguimiento básico por timeline (estado activo/cerrado y próxima revisión).
- Desacople de UI veterinaria desde `animals-page` a feature específica.

### Out of Scope
- Facturación, costos, valorización de insumos.
- Analítica avanzada (scoring, predicción, cohortes, correlaciones).
- Prescripción compleja (motor de reglas, posología avanzada).
- Adjuntos multimedia (imágenes, audio, video, documentos clínicos).

## Capabilities

### New Capabilities
- `field-vet-visit-workflow-v1`: Flujo funcional de visita veterinaria de campo (captura estructurada + seguimiento básico) sobre `ANIMAL_HEALTH_EVENT`.

### Modified Capabilities
- `animal-health-event-ledger-v1`: Extiende catálogo/event metadata para visita/checklist/nota/protocolo con validación tipada estricta.
- `animal-health-treatment-follow-up-v1`: Alinea continuidad/cierre con estado de protocolo y próximo control básico.

## Approach

Extender `ANIMAL_HEALTH_EVENT` con contratos de metadata tipada para visita veterinaria (approach recomendado), manteniendo queue-first + sync incremental existentes. Backend valida esquemas por tipo y frontend modela formularios específicos con proyección de seguimiento.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modified | Extraer responsabilidades de carga vet a feature dedicada. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` | Modified | Reusar envío offline para payload vet tipado. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` | Modified | Derivar estado básico de seguimiento/protocolo. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modified | Reglas de validación y consistencia temporal de visita/protocolo. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modified | Mapeo/validación metadata tipada de visita clínica. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Metadata sin contrato firme | Med | Esquemas tipados obligatorios y tests de contrato por subtipo. |
| Scope creep hacia módulos no V1 | High | Exclusiones explícitas en specs y criterios de aceptación. |
| Inconsistencia de seguimiento temporal | Med | Validaciones determinísticas (`occurredAt`, `nextDueAt`, transiciones). |

## Rollback Plan

Revertir cambios de contratos frontend/backend de visita vet y deshabilitar tipos nuevos en validadores; mantener operativo el ledger sanitario previo sin migraciones destructivas ni ruptura del sync.

## Dependencies

- `animal-health-event-ledger-v1` y `animal-health-treatment-follow-up-v1` como base funcional.
- Infraestructura offline/sync vigente (`ANIMAL_HEALTH_EVENT`, idempotencia por `operationId`).

## Success Criteria

- [ ] Un veterinario registra visita completa offline y se sincroniza sin duplicados al reconectar.
- [ ] Checklist, nota clínica y protocolo quedan persistidos con validación tipada estricta.
- [ ] El timeline refleja estado básico (activo/cerrado) y próximo control cuando corresponda.
- [ ] No se implementa ningún alcance excluido (facturación, analítica avanzada, prescripción compleja, multimedia).
