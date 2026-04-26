# ganadero-management Specification

## Purpose
Definir registro y gestión operativa básica de ganaderos por administradores.

## Requirements

### Requirement: Registro de ganaderos por administrador
The system MUST permitir a un ADMIN registrar ganaderos con datos obligatorios validados y SHALL evitar duplicados por identificador definido por negocio.

#### Scenario: Registro exitoso de ganadero
- GIVEN un ADMIN autenticado y datos válidos
- WHEN crea un ganadero
- THEN el ganadero queda activo y asociado al registro administrativo

#### Scenario: Rechazo por duplicado
- GIVEN un ganadero existente con mismo identificador de negocio
- WHEN se intenta crear otro igual
- THEN la operación se rechaza con error de validación

### Requirement: Listado y gestión de estado activo/baja
The system SHALL listar ganaderos filtrando por estado activo o baja y MUST permitir transición controlada entre ambos estados.

#### Scenario: Listado filtrado por activos
- GIVEN ganaderos activos y de baja
- WHEN un ADMIN solicita filtro activos
- THEN solo se devuelven ganaderos activos

#### Scenario: Cambio a baja y consulta
- GIVEN un ganadero activo
- WHEN un ADMIN lo marca como baja
- THEN el ganadero aparece en listados de baja y no en activos
