# authn-authz-hardening Specification

## Purpose
Endurecer autenticación y autorización para evitar emisión de tokens sin control real.

## Requirements

### Requirement: Autenticación con credenciales verificadas
The system MUST emitir token solo con credenciales válidas y SHOULD bloquear intentos inválidos repetidos de forma configurable.

#### Scenario: Login válido de administrador
- GIVEN un administrador activo con credenciales correctas
- WHEN solicita login
- THEN recibe token firmado con identidad y rol ADMIN

#### Scenario: Login inválido
- GIVEN credenciales incorrectas
- WHEN se solicita login
- THEN el sistema rechaza autenticación y no emite token

### Requirement: Autorización por rol ADMIN
The system SHALL permitir capacidades administrativas solo a usuarios con rol ADMIN y MUST responder acceso denegado para cualquier otro rol.

#### Scenario: Acceso autorizado
- GIVEN un token válido con rol ADMIN
- WHEN invoca endpoint administrativo
- THEN la operación continúa según reglas del recurso

#### Scenario: Acceso prohibido por rol
- GIVEN un token válido sin rol ADMIN
- WHEN invoca endpoint administrativo
- THEN el sistema responde acceso denegado
