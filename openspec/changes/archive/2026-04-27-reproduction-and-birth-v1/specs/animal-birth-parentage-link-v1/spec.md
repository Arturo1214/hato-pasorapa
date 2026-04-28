# animal-birth-parentage-link-v1 Specification

## Purpose

Contrato V1 de parto, crías y filiación con madre obligatoria y padre opcional.

## Requirements

### Requirement: Registro de parto con filiación mínima válida

The system MUST registrar partos con `motherAnimalUuid` obligatorio y `fatherAnimalUuid` opcional, validando referencias existentes.

#### Scenario: Validación de filiación en alta de parto

- GIVEN `motherAnimalUuid` y `fatherAnimalUuid` existentes
- WHEN se registra un parto con datos mínimos válidos
- THEN el sistema persiste el parto con vínculo madre/padre
- AND MUST rechazar solicitudes sin `motherAnimalUuid`

### Requirement: Alta de crías vinculadas al parto

The system MUST registrar cada cría con referencia obligatoria a madre y opcional a padre, consistente por `animalUuid`.

#### Scenario: Parto múltiple con dos crías

- GIVEN un parto válido con `offspringCount = 2`
- WHEN se registran las crías del parto
- THEN cada cría queda vinculada a la misma madre y al padre si fue informado

### Requirement: Consultas por animal y exclusiones explícitas V1

The system MUST permitir listados por `animalUuid` para partos y filiación, y MUST NOT incluir reproducción asistida, validaciones genéticas ni adjuntos.

#### Scenario: Consulta por animal y alcance V1

- GIVEN una madre con partos y crías registradas
- WHEN se consulta reproducción por `motherAnimalUuid`
- THEN se devuelve el historial de partos y crías vinculadas
- AND solicitudes de reproducción asistida SHALL rechazarse por fuera de alcance
