# Delta Spec: Ganadero Dashboard — role-based-navigation-and-ownership-v1

## Purpose

Este delta especifica el contenido y comportamiento del widget de dashboard ganadero `/ganadero/dashboard`, complementando la requirement `Ganadero dedicated dashboard` del spec principal.

---

## ADDED Requirements

### Requirement: Dashboard widgets — animal summary

El dashboard ganadero MUST mostrar un resumen de animales propios clasificados por sexo y categoría. La información se obtiene del endpoint `GET /api/ganadero/dashboard/animals-summary`.

#### Scenario: Animal summary displays correct counts by sex and category

- GIVEN el ganadero tiene animales propios registrados
- WHEN ganadero navega a `/ganadero/dashboard`
- THEN se muestra tabla/cartas con columnas: Machos, Hembras
- AND filas por categoría: Vaquillas, Vacas, Toros, Terneros, Terneras, Bueyes
- AND cada celda contiene el conteo numérico de animales

#### Scenario: Animal summary shows zeros when no animals in category

- GIVEN el ganadero no tiene animales en una categoría específica
- WHEN dashboard carga
- THEN esa celda muestra 0 (no se oculta la fila/columna)
- AND no causa error de render

### Requirement: Dashboard widgets — upcoming calendar events

El dashboard ganadero MUST mostrar los próximos 5 eventos del calendario propios del ganadero. La información se obtiene del endpoint `GET /api/ganadero/dashboard/upcoming-events`.

#### Scenario: Upcoming events display next 5 chronologically

- GIVEN el ganadero tiene eventos de calendario (salud, reproducción, generales)
- WHEN dashboard carga
- THEN se listan hasta 5 eventos ordenados por fecha ascendente
- AND cada evento muestra: tipo de evento, fecha, descripción corta

#### Scenario: No upcoming events shows empty state

- GIVEN el ganadero no tiene eventos próximos
- WHEN dashboard carga
- THEN se muestra mensaje "No hay eventos próximos" (no error)

### Requirement: Dashboard widgets — unread notifications with mark-on-read

El dashboard ganadero MUST mostrar la cantidad de notificaciones sin leer propias del ganadero. Cuando el ganadero navega a `/ganadero/notificaciones`, todas las notificaciones del dashboard pasan a estado leído. El conteo se obtiene de `GET /api/ganadero/dashboard/unread-count`.

#### Scenario: Unread notification count reflects actual unread messages

- GIVEN el ganadero tiene N notificaciones no leídas propias
- WHEN dashboard carga
- THEN se muestra badge/contador con el valor N
- AND al navegar a Notificaciones, esas N pasan a estado leído

#### Scenario: Zero unread shows no badge

- GIVEN el ganadero no tiene notificaciones sin leer
- WHEN dashboard carga
- THEN no se muestra badge de no leídas (o muestra 0 sin énfasis visual)

### Requirement: Dashboard widgets — upcoming veterinary visits

El dashboard ganadero MUST mostrar los controles/visitas veterinarias próximos registrados. Se muestran las visitas cuya fecha plannedDate está en el futuro, ordenadas ascendente. Límite de 5. El endpoint es `GET /api/ganadero/dashboard/upcoming-visits`.

#### Scenario: Upcoming visits display next 5 pending

- GIVEN el ganadero tiene visitas veterinarias planificadas futuras
- WHEN dashboard carga
- THEN se listan hasta 5 visitas ordenadas por `plannedDate` ascendente
- AND cada visita muestra: tipo de control, fecha planificada, estado (Pendiente/Completada)

#### Scenario: No upcoming visits shows empty state

- GIVEN el ganadero no tiene visitas veterinarias próximas
- WHEN dashboard carga
- THEN se muestra mensaje "No hay controles próximos" (no error)

---

## BE Endpoint Contracts

### GET /api/ganadero/dashboard/animals-summary

**Response 200**:
```json
{
  "machos": { "vaquillas": 0, "vacas": 0, "toros": 0, "terneros": 0, "bueyes": 0 },
  "hembras": { "vaquillas": 0, "vacas": 0, "toros": 0, "terneros": 0, "bueyes": 0 }
}
```
- `ganaderoId` se deriva del JWT — no se acepta como query param
- Solo cuenta animales propios del ganadero autenticado
- Categorías fijas: Vaquillas, Vacas, Toros, Terneros, Terneras, Bueyes

### GET /api/ganadero/dashboard/upcoming-events?limit=5

**Response 200**:
```json
[
  { "id": "uuid", "eventType": "SALUD|REPRODUCCION|GENERAL", "eventDate": "2026-05-10", "description": "Vacunación anual" }
]
```
- Ordenado por `eventDate` ASC
- Límite por defecto 5, máximo 10
- Solo eventos propios del ganadero del JWT

### GET /api/ganadero/dashboard/unread-count

**Response 200**:
```json
{ "count": 3 }
```
- Cuenta notificaciones propias del ganadero donde `read = false`

### GET /api/ganadero/dashboard/upcoming-visits?limit=5

**Response 200**:
```json
[
  { "id": "uuid", "controlType": "SANIDAD|REPRODUCCION|NUTRICION", "plannedDate": "2026-05-15", "status": "PENDIENTE|COMPLETADA" }
]
```
- Filtra `plannedDate >= today`
- Ordenado por `plannedDate` ASC
- Solo visitas propias del ganadero del JWT