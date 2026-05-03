# Delta Spec: Animal Sex — role-based-navigation-and-ownership-v1

## Purpose

Agregar campo `sex` a la entidad `Animal` requerido para el dashboard ganadero completo (animales por sexo y categoría). Este campo también habilitará categorización Machos/Hembras sin derivar de `AnimalCategory`, y sentará la base para transiciones/categorías futuras.

---

## ADDED Requirements

### Requirement: Animal.sex field — mandatory for new animals

El campo `sex` en `Animal` MUST ser obligatorio para todos los animales nuevos creados. El sistema SHOLD validar que `sex` no sea null en requests de creación.

#### Scenario: Create animal with valid sex — MACHO

- GIVEN payload válido de creación de animal con `sex: "MACHO"`
- WHEN POST /api/animals
- THEN animal se crea con `sex = MACHO` y se devuelve 201

#### Scenario: Create animal with valid sex — HEMBRA

- GIVEN payload válido de creación de animal con `sex: "HEMBRA"`
- WHEN POST /api/animals
- THEN animal se crea con `sex = HEMBRA` y se devuelve 201

#### Scenario: Create animal without sex — rejected

- GIVEN payload de creación sin campo `sex`
- WHEN POST /api/animals
- THEN se devuelve 400 con mensaje "sex is required"

#### Scenario: Create animal with invalid sex value — rejected

- GIVEN payload con `sex: "OTRO"`
- WHEN POST /api/animals
- THEN se devuelve 400 con mensaje "sex must be MACHO or HEMBRA"

### Requirement: Animal.sex field — backfill for existing animals

Los animales existentes SIN `sex` deben recibir un valor por defecto basado en su `category`. La migración SHOLD asignar: COW/HEIFER/CALF (hembra) → HEMBRA; BULL (macho) → MACHO.

#### Scenario: Backfill existing COW/HEIFER/CALF → HEMBRA

- GIVEN animales existentes con category COW, HEIFER o CALF y sex null
- WHEN migración VNNN__add_animal_sex se ejecuta
- THEN esos animales reciben sex = HEMBRA

#### Scenario: Backfill existing BULL → MACHO

- GIVEN animales existentes con category BULL y sex null
- WHEN migración VNNN__add_animal_sex se ejecuta
- THEN esos animales reciben sex = MACHO

### Requirement: Dashboard animal summary aggregates by sex and category

El endpoint `GET /api/ganadero/dashboard/animals-summary` MUST usar `Animal.sex` para clasificar animales en grupos Machos/Hembras, y desglosar por categoría dentro de cada grupo.

#### Scenario: Summary includes animals with sex = MACHO grouped correctly

- GIVEN animales propios con sex = MACHO (alguno BULL, algún con categoría derivada macho)
- WHEN GET /api/ganadero/dashboard/animals-summary
- THEN se countan en `machos.{categoria}` correspondiente

#### Scenario: Summary includes animals with sex = HEMBRA grouped correctly

- GIVEN animales propios con sex = HEMBRA (alguno COW, HEIFER, o CALF hembra)
- WHEN GET /api/ganadero/dashboard/animals-summary
- THEN se countan en `hembras.{categoria}` correspondiente

#### Scenario: Animals with null sex are excluded from summary

- GIVEN animales propios con sex null (caso improbable post-backfill)
- WHEN GET /api/ganadero/dashboard/animals-summary
- THEN esos animales no aparecen en ninguna celda (ni conteo, ni filas)

#### Scenario: Full summary shows all fixed category cells

- GIVEN ganadero con diversos animales propios
- WHEN GET /api/ganadero/dashboard/animals-summary
- THEN siempre se devuelven las 6 categorías fijas: vaquillas, vacas, toros, terneros, terneras, bueyes (al menos en 0)

---

## BE Endpoint Contracts (updated)

### GET /api/ganadero/dashboard/animals-summary

**Response 200**:
```json
{
  "machos": { "vaquillas": 0, "vacas": 0, "toros": 0, "terneros": 0, "bueyes": 0 },
  "hembras": { "vaquillas": 0, "vacas": 0, "toros": 0, "terneros": 0, "bueyes": 0 }
}
```
- `ganaderoId` se deriva del JWT — no se acepta como query param
- Solo cuenta animales propios del ganadero autenticado donde `sex` no es null
- Clasificación Machos: `sex = MACHO` → se mapea a categoría por `category` (BULL→toros, CALF→terneros, BOY→bueyes si existe)
- Clasificación Hembras: `sex = HEMBRA` → se mapea a categoría por `category` (COW→vacas, HEIFER→vaquillas, CALF→terneras)
- Categorías fijas: Vaquillas (HEIFER+HEMBRA), Vacas (COW+HEMBRA), Toros (BULL+MACHO), Terneros (CALF+MACHO), Terneras (CALF+HEMBRA), Bueyes (future/BOY+MACHO)
- Animales con `sex = null` se excluyen

### POST /api/animals

**Request body** (nuevo campo obligatorio):
```json
{ "code": "...", "tag": "...", "category": "COW", "sex": "HEMBRA", ... }
```

**Validación**: `sex` MUST ser `"MACHO"` o `"HEMBRA"`. Null o vacío → 400.

---

## Migration

- **Archivo**: `hato-be/src/main/resources/db/migration/VNNN__add_animal_sex.sql`
- Agregar columna `sex` nullable, default null
- Backfill UPDATE: COW/HEIFER/CALF → `sex = 'HEMBRA'`; BULL → `sex = 'MACHO'`
- Agregar constraint NOT NULL después del backfill si la BD lo soporta (o dejar nullable para permitir sync offline temporal)