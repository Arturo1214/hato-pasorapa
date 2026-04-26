# administrator-management Specification

## Purpose
Habilitar gestión mínima de administradores por administradores existentes.

## Requirements

### Requirement: Creación y gestión básica de administradores
The system MUST permitir a un ADMIN crear administradores, listarlos y cambiar su estado activo/baja, preservando trazabilidad de cambios.

#### Scenario: Alta de nuevo administrador
- GIVEN un ADMIN autenticado
- WHEN registra un nuevo administrador con datos válidos
- THEN el nuevo administrador queda activo y visible en listados

#### Scenario: Baja administrativa
- GIVEN un administrador existente activo
- WHEN un ADMIN cambia su estado a baja
- THEN ese usuario ya no puede autenticarse

### Requirement: Cambio de contraseñas por administrador
The system SHALL permitir a un ADMIN cambiar la contraseña de cualquier administrador y MUST invalidar autenticaciones con la contraseña anterior.

#### Scenario: Reseteo exitoso de contraseña
- GIVEN un ADMIN autenticado y un administrador objetivo
- WHEN ejecuta cambio de contraseña válido
- THEN la nueva contraseña aplica inmediatamente

#### Scenario: Contraseña antigua inválida
- GIVEN una contraseña antigua ya reemplazada
- WHEN se intenta login con esa contraseña
- THEN la autenticación es rechazada
