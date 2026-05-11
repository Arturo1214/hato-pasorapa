# Proposal: Animal Breed Catalog V1

## Intent

Agregar características ganaderas clave (`color`, `description`, `raza`) sin degradar calidad de datos. La raza debe ser catálogo administrado, no texto libre, para que ADMIN mantenga opciones consistentes y GANADERO seleccione solo razas activas, empezando con `Criolla` por relevancia local en Pasorapa.

## Scope

### In Scope
- Catálogo `Raza`/breed con ABM ADMIN, activación/desactivación y seed inicial ordenado con `Criolla` primero.
- Animal con `color`, `description` y `breedUuid` en dominio, DTOs, formularios, detalle/listado y payloads offline.
- Selector GANADERO/operativo que consuma solo razas activas; escrituras de catálogo ADMIN online-only.

### Out of Scope
- Taxonomía genética avanzada, cruzamientos parametrizables o validación genealógica por raza.
- Eliminación física de razas usadas por animales; importaciones masivas.

## Capabilities

### New Capabilities
- `animal-breed-catalog-v1`: catálogo ADMIN de razas, seed inicial, consulta activa para selección.
- `animal-core-characteristics-v1`: captura y preservación de color, descripción y raza en animales.

### Modified Capabilities
- None; no existing animal-core catalog spec exists under `openspec/specs/`.

## Approach

Implementar en slices: (1) BE catálogo `Raza` con Resource → Service → Repository/Domain, DTOs, seguridad ADMIN para ABM y endpoint read-only de activas; (2) Liquibase con tabla/índices/seed; (3) extender `Animal` y contratos con `breedUuid`; (4) FE admin `/admin/razas` con `app-data-table`; (5) formularios animal admin/ganadero con selector activo y persistencia offline de nuevos campos; (6) tests enfocados BE/FE.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/java/bo/pasorapa/hato/domain` | New/Modified | `Raza` + relación Animal |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest` | New/Modified | endpoints catálogo y Animal DTOs |
| `hato-be/src/main/resources/db/changelog` | New | migración y seed |
| `hato-fe/src/app/features/admin/animals` | Modified | formularios/listado/detalle |
| `hato-fe/src/app/features/admin/razas` | New | ABM ADMIN |
| `hato-fe/src/app/core/offline` | Modified | payload local conserva campos |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cambio supera 400 líneas | High | Dividir en PRs BE catálogo, animal fields, FE catálogo/formularios |
| Datos existentes sin raza | Med | `breedUuid` nullable en V1 y UI tolerante |
| Raza desactivada usada | Med | No borrar; mostrar valor histórico y bloquear nueva selección |

## Rollback Plan

Revertir migración/feature PRs en orden inverso. Si ya hay datos, mantener columnas nullable y ocultar UI hasta migración correctiva.

## Dependencies

- Project standards injected; no external dependency.

## Success Criteria

- [ ] ADMIN gestiona razas y `Criolla` aparece primera en seed/listado inicial.
- [ ] GANADERO solo selecciona razas activas al crear/editar animales.
- [ ] `color`, `description`, `breedUuid` sobreviven create/edit/offline sync y se muestran en UI.
- [ ] Tests enfocados cubren seguridad, validación, seed y formularios.
