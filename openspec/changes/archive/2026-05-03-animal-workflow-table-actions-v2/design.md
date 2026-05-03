# Design: `animal-workflow-table-actions-v2`

## Technical Approach

Reemplazar la vista card-grid de `animals-page` con un `DataTableComponent` + toolbar "Nuevo animal", expandir los enums `AnimalCategory` (6 valores) y `AnimalEventType` (agregar `CASTRATION`), implementar validación `category×sex` en `AnimalService`, y modelar la castración como evento operativo que causa transición instantánea a `BUEY`. FE expone `sex` en columna de tabla y remueve los filtros globales `ownerGanaderoId`/`active`. Se agrega `birthDate` en `AnimalRequest` (requerido para TERNERO/TERNERA) y la auto-transición TERNERO→TORO a los 24 meses leídos desde `birthDate`.

## Architecture Decisions

### Decision: 6-category sex-split model over 4-category unified model

**Choice**: `AnimalCategory` = `TERNERO` (MACHO), `TERNERA` (HEMBRA), `VAQUILLONA` (HEMBRA), `VACA` (HEMBRA), `TORO` (MACHO), `BUEY` (MACHO). `AnimalSex` pre-existe como `MACHO/HEMBRA`.

**Alternatives considered**: Mantener 4 valores (`COW/BULL/CALF/HEIFER`) y derivar dinámicamente — rejected: viola explicit product rule.

**Rationale**: La matriz sexo×categoría es una regla de negocio fija. 6 valores separados permite enforcement directo en BE sin lógica de derivación.

### Decision: Castración como `AnimalEventType.CASTRATION` operativo

**Choice**: `CASTRATION` va en `AnimalEventType` (mismo enum que `SOLD/DECEASED/LOST/TRANSFERRED/OBSERVATION`), no en `AnimalReproductionEventType`.

**Rationale**: La castración es un evento operativo que cambia el estado de la categoría del animal. El mismo request de evento actualiza `category=BUEY`.

### Decision: `CASTRATION` causa transición inmediata en el mismo request

**Choice**: Registrar evento `CASTRATION` + actualizar `animal.setCategory(BUEY)` dentro del mismo método `@Transactional applyCastration()` en `AnimalService`.

**Rationale**: Transacción única para simplificar consistencia. Offline sync del evento operativo funciona igual que otros eventos — se encola y se synca con retry.

### Decision: category×sex validation en `AnimalService` (application-level)

**Choice**: Validar combinaciones en `applyCoreState()` con switch/if; no agregar constraint en la DB.

**Rationale**: Application-level permite evolución de reglas sin migration. CHECK constraint en DB es para integridad referencial, no reglas de negocio.

### Decision: FE `DataTableComponent` + `MatDialog` (refactor pattern)

**Choice**: Reusar `DataTableComponent` existente y `UserFormDialogComponent` como reference pattern. Crear `AnimalFormDialogComponent`.

**Rationale**: Patrón probado en `admin-users-page`. `DataTableComponent` es genérico para columnas custom con `formatter`.

### Decision: `birthDate` requerido para TERNERO/TERNERA en create/update

**Choice**: Validación condicional en `AnimalService.applyCoreState()` — si category es TERNERO o TERNERA y birthDate es null, throw 400.

**Rationale**: Animales jóvenes necesitan fecha de nacimiento para calcular la auto-transición TERNERO→TORO a 24 meses.

### Decision: TERNERO→TORO auto-transition on read at 24 months

**Choice**: En `AnimalService.findByUuid()` y `AnimalService.listAnimals()` — antes de retornar el animal, verificar si `category==TERNERO && birthDate != null && age >= 24 months` → `animal.setCategory(TORO)` y persist.

**Rationale**: Transición sobre lectura (lazy) evita jobs batch y garantiza que el estado del animal siempre esté actualizado cuando se lee. El mismo patrón que la transición por CASTRACIÓN/BIRTH.

## Data Flow

```
FE: AnimalsPageComponent (DataTable)
  row actions → MatDialog → AnimalFormDialogComponent / EventOperativoDialog / EventReproductivoDialog
                           │
                           │ POST /animals/:uuid/events (CASTRATION)
                           ▼
BE: AnimalEventResource / AnimalService
  applyCastration() — @Transactional
    1. persist AnimalEvent(CASTRATION)
    2. animal.setCategory(BUEY)

FE: AnimalsPage → loadAnimals() → GET /animals
BE: AnimalService.listAnimals() / findByUuid()
  applyAutoTransition(TERNERO → TORO at 24 months)
    1. if category==TERNERO && birthDate != null && monthsSince(birthDate) >= 24
    2. animal.setCategory(TORO) and persist
    3. return updated animal
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `hato-be/.../domain/enumeration/AnimalCategory.java` | Modify | `TERNERO, TERNERA, VAQUILLONA, VACA, TORO, BUEY` (reemplaza COW/BULL/CALF/HEIFER) |
| `hato-be/.../domain/enumeration/AnimalEventType.java` | Modify | Agregar `CASTRATION` |
| `hato-be/.../service/dto/AnimalRequest.java` | Modify | Agregar `LocalDate birthDate` (optional, required for TERNERO/TERNERA validation) |
| `hato-be/.../service/AnimalService.java` | Modify | `applyCategorySexValidation()`, `applyCastration()`, `applyAutoTransitionOnRead()`, `validateBirthDateForYoungAnimals()` |
| `hato-be/.../web/rest/AnimalResource.java` | Modify | No changes to endpoints — BE layer handles transitions transparently |
| `hato-be/.../web/rest/AnimalEventResource.java` | Modify | Endpoint `POST /animals-events/castration` — handles CASTRATION event |
| `hato-be/.../service/AnimalServiceTest.java` | Create | Tests unitarios para 3 nuevos métodos |
| `hato-fe/.../animals-page.component.ts` | Modify | Card-grid → DataTable, toolbar, remover filtros `ownerGanaderoId`/`active`, agregar `sex` column |
| `hato-fe/.../animal-form-dialog.component.ts` | Create | Modal crear/editar animal con `birthDate` field |
| `hato-fe/.../data-access/animals.service.ts` | Modify | `AnimalCategory` 6 valores, `sex` en `AnimalItem`, `birthDate` en payload |
| `hato-fe/.../data-access/animals-events.service.ts` | Modify | Agregar `createCastrationEvent()` — mismo patrón que `createEvent()` |
| `hato-fe/.../animals-page.component.spec.ts` | Modify | Tests DataTable, row actions, offline castration queue |
| Liquibase migration | Create | Cambiar enum `category` de 4 a 6 valores (con backward-compat) |

## Interfaces / Contracts

### BE `AnimalRequest` con birthDate

```java
public record AnimalRequest(
        @NotNull UUID ownerGanaderoId,
        String arete,
        String marca,
        String tatuaje,
        @NotNull AnimalCategory category,
        @NotNull AnimalSex sex,
        @NotNull Boolean active,
        @NotNull LocalDate admissionDate,
        @DecimalMin("0.00") BigDecimal weightKg,
        LocalDate birthDate  // NUEVO — opcional, requerido si category=TERNERO/TERNERA
) {}
```

### BE birthDate validation (conditional required)

```java
private void validateBirthDateForYoungAnimals(AnimalRequest request) {
    if ((request.category() == TERNERO || request.category() == TERNERA)
            && request.birthDate() == null) {
        throw new BusinessException("BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL",
            "birthDate es requerido para TERNERO/TERNERA",
            Response.Status.BAD_REQUEST);
    }
}
```

### BE category×sex validation

```java
private void applyCategorySexValidation(AnimalCategory category, AnimalSex sex) {
    boolean valid = switch (sex) {
        case HEMBRA -> category == TERNERA || category == VAQUILLONA || category == VACA;
        case MACHO  -> category == TERNERO || category == TORO || category == BUEY;
    };
    if (!valid) {
        throw new BusinessException("INVALID_SEX_CATEGORY_COMBINATION",
            "Categoría " + category + " no es compatible con sexo " + sex,
            Response.Status.BAD_REQUEST);
    }
}
```

### BE TERNERO→TORO auto-transition (on read)

```java
public Animal findByUuid(UUID uuid) {
    Animal animal = animalRepository.findByUuid(uuid)
            .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", ...));
    applyAutoTransitionOnRead(animal);
    return animal;
}

private void applyAutoTransitionOnRead(Animal animal) {
    if (animal.getCategory() != TERNERO || animal.getBirthDate() == null) {
        return;
    }
    long monthsSinceBirth = ChronoUnit.MONTHS.between(animal.getBirthDate(), LocalDate.now());
    if (monthsSinceBirth >= 24) {
        animal.setCategory(TORO);
        animalRepository.persist(animal);
    }
}
```

### BE CASTRATION transition

```java
@Transactional
public AnimalEvent createCastrationEvent(UUID animalUuid, AnimalEventRequest request) {
    Animal animal = animalRepository.findByUuid(animalUuid)
            .orElseThrow(...);
    if (animal.getCategory() != TERNERO && animal.getCategory() != TORO) {
        throw new BusinessException("ANIMAL_CASTRATION_ONLY_FOR_MALE_YOUNG",
            "Solo Ternero o Toro puede ser castrado", Response.Status.BAD_REQUEST);
    }
    AnimalEvent event = eventRepository.persist(new AnimalEvent(animal, CASTRATION, request.occurredAt(), request.notes()));
    animal.setCategory(BUEY);
    return event;
}
```

### FE AnimalItem con sex y birthDate

```typescript
export type AnimalCategory = 'TERNERO' | 'TERNERA' | 'VAQUILLONA' | 'VACA' | 'TORO' | 'BUEY';
export interface AnimalItem {
  uuid: string;
  category: AnimalCategory;
  sex: 'MACHO' | 'HEMBRA';
  birthDate?: string; // ISO date string, present if known
  // ...existing fields...
}
```

### FE DataTable columns y actions

```typescript
readonly columns: DataTableColumn[] = [
  { key: 'arete', label: 'Arete', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
  { key: 'category', label: 'Categoría', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.SELECT,
    filterOptions: [{value:'TERNERO',label:'Ternero'},{value:'TERNERA',label:'Ternera'},...] },
  { key: 'sex', label: 'Sexo', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.SELECT,
    filterOptions: [{label:'Hembra',value:'HEMBRA'},{label:'Macho',value:'MACHO'}] },
  { key: 'birthDate', label: 'F. Nacimiento', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
  { key: 'admissionDate', label: 'F. Ingreso', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
  { key: 'active', label: 'Estado', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.SELECT,
    filterOptions: [{label:'Activo',value:'true'},{label:'Inactivo',value:'false'}] },
];
readonly actions: DataTableAction[] = [
  { id: 'event-operative', label: 'Evento operativo', icon: 'event' },
  { id: 'event-reproductive', label: 'Evento reproductivo', icon: 'childfriendly' },
  { id: 'images', label: 'Imágenes', icon: 'photo' },
  { id: 'view-edit', label: 'Ver/Editar', icon: 'visibility' },
];
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| BE Unit | `applyCategorySexValidation()` rejected combos | JUnit 5 parameterized |
| BE Unit | `validateBirthDateForYoungAnimals()` — TERNERO/TERNERA without birthDate → 400 | JUnit 5 |
| BE Unit | `createCastrationEvent()` transitions TERNERO/TORO→BUEY | JUnit 5 |
| BE Unit | `applyAutoTransitionOnRead()` — TERNERO at 24 months → TORO | JUnit 5 |
| BE Unit | `applyAutoTransitionOnRead()` — TERNERO at <24 months → stays TERNERO | JUnit 5 |
| BE Integration | `POST /animals` rejects invalid category×sex | `rest-assured` |
| BE Integration | `POST /animals` without birthDate for TERNERO → 400 | `rest-assured` |
| BE Integration | `POST /animals-events/castration` on valid animal → 201 + BUEY | `rest-assured` |
| FE Unit | DataTable renders, row actions fire | Angular TestBed |
| FE Unit | `AnimalFormDialogComponent` create/edit/view with birthDate | Angular TestBed |
| FE Unit | `createCastrationEvent()` offline — enqueued same as other events | Vitest + mock offline store |
| FE Unit | offline snapshot includes `sex` and `birthDate` fields | Vitest |

## Migration / Rollback

**Liquibase migration required**: ALTER enum `category` — agregar TERNERO, TERNERA, VAQUILLONA, VACA, TORO, BUEY al enum PostgreSQL. El enum BE cambia de 4 a 6 valores. La columna DB ya existe con valores antiguo (COW/BULL/CALF/HEIFER) — mapping de transición en `AnimalMapper`.

**Backfill script**: Para animales existentes sin `birthDate` y category=TERNERO, setear birthDate = admissionDate - 6 meses (estimado). No se puede calcular con precisión la auto-transición para animales sin fecha real.

**Offline behavior**: CASTRATION evento se encola igual que CREATE/UPDATE/DELETE. El sync service hace retry con backoff. No hay diferencia en el handling de eventos operativos vs. mutaciones CRUD — todos van al mismo queue.

**Rollback**:
1. Revertir `AnimalCategory.java` a 4 valores, remover `CASTRATION` del enum
2. Remover `validateBirthDateForYoungAnimals()` y `applyAutoTransitionOnRead()` de `AnimalService`
3. FE: git revert `animals-page.component.ts` a card-grid
4. Remover `AnimalFormDialogComponent`

## Open Questions

- None — all resolved:
  - TERNERO→TORO 24 months: in V2, triggered on read
  - birthDate en AnimalRequest: V2, requerido para TERNERO/TERNERA
  - Castration offline queue: same as other events, no special handling