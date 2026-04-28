# Proposal: Animal Core Management V1

## Intent
Definir el núcleo funcional de animal para operación de campo offline-first. Existe infraestructura de sync y CRUD básico, pero falta contrato de negocio estable para identidad, ownership y operación diaria.

## Scope

### In Scope
- Ficha animal actual V1 (estado vigente, no histórico).
- Identidad canónica por `uuid` + identificadores visibles (`arete`, `marca`, `tatuaje`).
- Ownership vigente con `Ganadero` (`ownerGanaderoId`).
- Alta y edición de animales en REST y `/sync` (CREATE/UPDATE).
- Listados y filtros esenciales: identificador visible, propietario, estado, categoría.
- Compatibilidad offline-first con outbox/inbox, versionado y conflicto existente.

### Out of Scope
- Historial sanitario.
- Historial reproductivo.
- Timeline/eventos de dominio.
- Gestión de imágenes/adjuntos.
- Transferencias históricas de ownership.

## Capabilities

### New Capabilities
- `animal-core-management`: ficha vigente con identidad canónica + ownership + edición/alta.
- `animal-offline-sync-create-update`: sincronización offline-first de altas/ediciones de `ANIMAL`.
- `animal-operational-listing`: listados y filtros mínimos para operación rural.

### Modified Capabilities
- None

## Approach
Adoptar modelo **core-state first**: una única representación vigente de animal en V1, canonizando `uuid` como identidad de negocio/API y dejando historial/eventos para changes separados. Reusar base offline actual y extender contratos REST/sync.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` | Modified | Campos core V1 e ownership actual |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalResource.java` | Modified | Alta/edición/listado con identidad canónica |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Habilitar `ANIMAL CREATE/UPDATE` |
| `hato-fe/src/app/features/animals/` | New | Feature standalone de listado/formulario |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Tipos/operaciones offline de `ANIMAL` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deriva `id` vs `uuid` | Med | Contrato API y FE basado en `uuid` |
| Duplicados de identificadores visibles | Med | Reglas explícitas de unicidad + validación |
| Scope creep a historial/eventos | High | Excluir por contrato en spec y backlog separado |
| Mayor complejidad de sync por CREATE offline | Med | Reusar versión/conflicto existente y pruebas dedicadas |

## Rollback Plan
Revertir migraciones/campos nuevos de animal, deshabilitar `ANIMAL CREATE` en `/sync`, y volver temporalmente a operación sólo UPDATE + endpoints previos.

## Dependencies
- Foundation offline-sync existente (`offline-sync-foundation-v1`).
- Entidad y snapshots de `Ganadero` operativos para selección de ownership.

## Success Criteria
- [ ] 100% de operaciones de alta/edición animal usan `uuid` como identidad externa.
- [ ] API de listado responde filtros por identificador visible, `ownerGanaderoId`, `active`, `category`.
- [ ] `/sync` procesa `ANIMAL CREATE/UPDATE` sin romper contrato de conflictos.
- [ ] Feature `animals` permite alta, edición y listado en modo offline con sincronización posterior.
- [ ] Ningún endpoint o schema de V1 introduce historial sanitario/reproductivo/eventos/imágenes.
