# admin-user-dashboard Specification

## Purpose
Establecer un dashboard administrativo mínimo de usuarios.

## Requirements

### Requirement: Métricas mínimas de usuarios
The system MUST exponer para ADMIN métricas mínimas: total de administradores, total de ganaderos, activos y de baja por tipo de usuario.

#### Scenario: Consulta de dashboard por ADMIN
- GIVEN un ADMIN autenticado
- WHEN solicita dashboard de usuarios
- THEN recibe métricas agregadas consistentes con el estado actual

#### Scenario: Usuario sin permisos
- GIVEN un usuario sin rol ADMIN
- WHEN solicita dashboard de usuarios
- THEN la solicitud es denegada
