# admin-bootstrap-seed Specification

## Purpose
Definir el alta controlada del primer administrador del sistema.

## Requirements

### Requirement: Bootstrap único y auditable del primer admin
The system MUST permitir bootstrap solo cuando no exista ningún administrador activo y SHALL registrar auditoría del evento.

#### Scenario: Bootstrap inicial exitoso
- GIVEN no existen administradores activos
- WHEN se envía bootstrap con datos válidos y contraseña válida
- THEN se crea un administrador activo con rol ADMIN y se registra evento auditable

#### Scenario: Rechazo de segundo bootstrap
- GIVEN ya existe al menos un administrador activo
- WHEN se intenta ejecutar bootstrap inicial nuevamente
- THEN la operación es rechazada sin crear usuarios nuevos
