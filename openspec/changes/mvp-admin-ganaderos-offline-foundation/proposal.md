# Proposal: MVP Admin + Ganaderos Offline Foundation

## Intent
Hoy el sistema no tiene base de administración (admins/ganaderos) y el auth permite emitir JWT sin credenciales fuertes. Este cambio crea el foundation mínimo para operar el MVP administrativo y fijar contratos offline-first tempranos, evitando retrabajo alto.

## Scope
### In Scope
- Bootstrap de administrador inicial.
- Gestión de administradores (alta/listado/edición básica/estado).
- Registro y gestión de ganaderos por admin.
- Dashboard mínimo de usuarios (conteos y estado).
- Hardening básico de auth/authz (sin roles auto-declarados).
- Contratos offline base: IDs, `version/updatedAt`, `lastSyncedAt`, idempotencia con `operationId`.

### Out of Scope
- Sincronización offline completa (cola, retries, reconciliación multi-dispositivo).
- Resolución avanzada de conflictos.
- Módulos pecuarios avanzados.
- Multimedia offline.

## Capabilities
### New Capabilities
- `admin-bootstrap-seed`: alta controlada del primer admin.
- `administrator-management`: CRUD de administradores.
- `ganadero-management`: CRUD de ganaderos por admin.
- `admin-user-dashboard`: reporte operativo mínimo de usuarios.
- `authn-authz-hardening`: validación real de credenciales y permisos.
- `offline-foundation-contracts`: metadatos mínimos para evolución offline-first.

### Modified Capabilities
- None.

## Approach
Vertical slice FE+BE: primero seguridad y bootstrap admin, luego gestión de administradores/ganaderos y dashboard mínimo. Mantener arquitectura por capas, DTOs y validaciones explícitas, con tests FE/BE en flujos críticos.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/app.routes.ts` | Modified | Rutas protegidas admin/ganaderos/dashboard |
| `hato-fe/src/app/core/auth/**` | Modified | Sesión, guardas y control de permisos |
| `hato-fe/src/app/features/**` | New | Features de seed/admin/ganaderos/dashboard |
| `hato-be/src/main/resources/db/changelog/**` | New/Modified | Tablas admin/ganaderos + metadatos sync |
| `hato-be/src/main/java/**` | New/Modified | REST, servicios, repositorios, DTOs, mappers |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hardening de auth insuficiente | Med | Gate de release con tests de credenciales/autorización |
| Contrato offline débil | Med | Especificar campos/versionado/idempotencia en specs |
| Scope creep | High | Aprobación explícita para todo ítem fuera de alcance |

## Rollback Plan
Rollback de changelogs y endpoints admin/ganaderos; deshabilitar rutas/features nuevas en FE; conservar operación actual sin dependencias del foundation.

## Dependencies
- Liquibase/PostgreSQL.
- Config JWT/seguridad Quarkus.
- Convenciones Angular/Quarkus del proyecto.

## Success Criteria
- [ ] Existe bootstrap auditable del primer admin.
- [ ] Un admin puede administrar admins y ganaderos según permisos.
- [ ] Dashboard muestra métricas mínimas de usuarios.
- [ ] Token solo se emite con credenciales válidas y permisos verificados.
- [ ] API/modelo incluyen `version`, `updatedAt`, `lastSyncedAt`, `operationId`.
- [ ] Pruebas FE/BE críticas pasando para authz y CRUD base.
