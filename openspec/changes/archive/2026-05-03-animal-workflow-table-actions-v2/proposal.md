# Proposal: `animal-workflow-table-actions-v2`

## Intent

Reemplazar la vista card-grid de animales por tabla DataTable + modales, expandir categorías a 6 valores con matriz sexo/categoría, agregar evento CASTRACIÓN, exponer acciones de fila para eventos operativos/reproductivos/imágenes, y limpiar filtros globales operativos. Mantener ownership ganadero y diferir reglas de auto-transición a configuración.

## Scope

### In Scope
- Reemplazar `animals-page.component.ts` card-grid → `DataTableComponent` + toolbar con botón "Nuevo animal"
- Modal `AnimalFormDialogComponent` para crear/editar animal (ref. `UserFormDialogComponent`)
- Acciones de fila: Registrar evento operativo, Registrar evento reproductivo, Agregar imágenes, Ver/Editar ficha
- Expandir `AnimalCategory` BE y FE a 6 valores: `TERNERO`, `TERNERA`, `VAQUILLONA`, `VACA`, `TORO`, `BUEY`
- Matriz sexo/categoría enforced en BE (create/update):
  - HEMBRA → `TERNERA`, `VAQUILLONA`, `VACA`
  - MACHO → `TERNERO`, `TORO`, `BUEY`
- Agregar `CASTRATION` a `AnimalEventType` — evento operativo que causa transición inmediata a `BUEY` si el animal es `TERNERO` o `TORO`
- Mostrar `sex` en columna de tabla y en `AnimalItem` FE
- Eliminar filtros operativos globales (ownerGanaderoId, active) — mantener solo búsqueda por texto libre
- Persistir ownership ganadero en creación de animal (del contexto, no input del usuario)

### Out of Scope
- Auto-transiciones TERNERO→TORO (12 meses), VAQUILLONA→VACA (primer parto o edad configurable) — diferido a V3
- Reglas de optimización/IA para transiciones
- Modificación de specs de ledger existentes (`animal-event-ledger-v1`, `animal-reproduction-event-ledger-v1`) — se agregan delta specs en change folder

## Capabilities

### New Capabilities
- `animal-category-sex-matrix`: Matriz sexo/categoría con enforced en create/update. Combinaciones inválidas (ej: `VACA` + `MACHO`) son rechazadas.
- `animal-castration-event`: Nuevo `AnimalEventType.CASTRATION` que triggers transición instantánea a `BUEY` si el sujeto es `TERNERO` o `TORO`.
- `animal-workflow-table-ui`: animals-page con DataTable, toolbar "Nuevo animal", modales de fila, y acciones de evento operativo/reproductivo/imagen.

### Modified Capabilities
- `animal-event-ledger-v1`: Delta para incluir `CASTRATION` como tipo V1 válido.
- `animal-reproduction-event-ledger-v1`: Delta para permitir registro de eventos reproductivos desde acción de fila (sin cambios de requisito, solo de UX flow).

## Approach

**Full Table + Modal Refactor** (Approach A de exploration).

FE: Convertir `animals-page` a patrón `admin-users-page` — `DataTableComponent` con columnas configurables, toolbar con "Nuevo animal" → `MatDialog`, acciones de fila disparando diálogos de evento.

BE: Expander `AnimalCategory` enum, agregar `CASTRATION`, implementar `category×sex` validation en `AnimalService.applyCoreState()`, usar `applyTransitions()` (nuevo método) para validar combinaciones sin auto-transiciones.

Transición a BUEY por CASTRACION: evento operativa que en el mismo request hace `category=BUEY`. Sin event-driven automático.

FE state: `sex` agregado a `AnimalItem` y mostrado en tabla. Filtros globales `ownerGanaderoId` y `active` removidos.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/animals/animals-page.component.ts` | Modified | Card-grid → DataTable + toolbar |
| `hato-fe/src/app/features/animals/animal-form-dialog.component.ts` | New | Modal crear/editar animal |
| `hato-fe/src/app/features/animals/animals.service.ts` | Modified | `AnimalCategory` 6 valores, `sex` en `AnimalItem` |
| `hato-be/src/main/java/.../domain/AnimalCategory.java` | Modified | Agregar `TERNERO`, `TERNERA`, `BUEY` |
| `hato-be/src/main/java/.../domain/AnimalEventType.java` | Modified | Agregar `CASTRATION` |
| `hato-be/src/main/java/.../service/AnimalService.java` | Modified | category×sex validation, applyTransitions() |
| `hato-be/src/main/java/.../dto/AnimalRequest.java` | No change | Sex ya @NotNull |
| `hato-be/src/main/java/.../mapper/AnimalMapper.java` | TBD | Mapear 6 categorías (verificar mapping existente) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Category×sex validation rompe animales existentes mal configurados | Medium | Solo se aplica en create/update; no retroactivo |
| Falta de umbral de edad para TERNERO→TORO genera confusión | Medium | Proponer config default 24 meses en proposal; no bloquear |
| Scope grande causa Stall en SDD | Medium | Mantener V2 contenido: UI + categorías + CASTRATION; auto-transitions a V3 |
| DataTable + offline sync con nuevo campo `sex` | Low | `sex` es @NotNull solo en BE; offline puede tolerar null en lecturas antiguas |

## Rollback Plan

1. Revertir `AnimalCategory.java` a 4 valores, remover `CASTRATION` de enum
2. Hacer rollback de `AnimalService.applyTransitions()` — remover validación sex×category
3. FE: hacer revert de `animals-page.component.ts` a card-grid (git revert o restore)
4. Remover `AnimalFormDialogComponent` si no tiene otros consumidores
5. Liquibase: no necesita migration si la columna `sex` ya existe y es @NotNull (no的长)
6. Publicar versión anterior del Angular bundle

## Dependencies

- `sdd/animal-workflow-table-actions-v2/explore` (exploration completa, sin open questions bloqueantes)
- `admin-users-page` reference pattern disponible en `hato-fe`

## Success Criteria

- [ ] Tabla DataTable con columna `sex` visible, filtros solo por texto libre
- [ ] Toolbar con botón "Nuevo animal" abre `AnimalFormDialogComponent`
- [ ] Fila con acciones: Registrar evento operativo, Registrar evento reproductivo, Agregar imágenes, Ver/Editar
- [ ] Crear animal con `VACA` + `HEMBRA` succeed; `VACA` + `MACHO` fails con 400
- [ ] Registrar `CASTRATION` en `TERNERO` → animal queda `BUEY` post-commit
- [ ] Registro de eventos reproductivos funcional desde acción de fila
- [ ] Imágenes de animal accesibles desde acción de fila
- [ ] Ownership persists sin input explícito del usuario (del contexto de sesión)
- [ ] Tests passing: `animals-page.component.spec.ts`, `AnimalService` tests