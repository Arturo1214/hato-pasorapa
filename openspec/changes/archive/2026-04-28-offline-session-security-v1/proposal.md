# Proposal: Offline Session Security V1

## Intent

Definir una política formal de sesión offline para reducir riesgo de sincronización con sesión inválida y residuos locales en dispositivo compartido, sin romper el flujo offline-first ni introducir dependencias externas.

## Scope

### In Scope
- Modelo de sesión offline en FE con estados `active | reauth_required | expired`, timestamps y TTL coherente con login actual.
- Reautenticación obligatoria antes de push/pull cuando la sesión no esté `active`.
- Limpieza local explícita en logout y transiciones críticas (sesión, outbox/inbox, snapshots/meta sensibles) con retención mínima segura para continuidad offline.
- Reglas V1 para dispositivo compartido: no reutilizar sesión previa para sync y contrato UX explícito.
- Documentación de límites de seguridad V1 (qué cubre y qué no).

### Out of Scope
- Biometría del sistema operativo.
- Integración MDM o attestation de dispositivo.
- Cifrado fuerte por hardware/keystore seguro remoto.
- Recuperación o revocación remota de sesión.

## Capabilities

### New Capabilities
- `offline-session-security-v1`: Política de vigencia de sesión offline, compuertas de sync y reautenticación previa a sincronizar.
- `shared-device-session-hygiene-v1`: Reglas de limpieza local y no reutilización de sesión en dispositivos compartidos.

### Modified Capabilities
- None.

## Approach

Implementar “session envelope local + sync gate estricto”: persistir metadatos de sesión offline en FE, centralizar decisión de vigencia para guard/initializer/sync, forzar reauth con login existente antes de sync y ejecutar limpieza local por política V1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modified | Estado y persistencia de sesión offline; logout endurecido |
| `hato-fe/src/app/core/auth/guards/auth.guard.ts` | Modified | Validación de estado de sesión |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Gate de sync con reauth obligatoria |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | API de limpieza/retención local |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Migración de metadatos para política V1 |
| `hato-fe/src/app/app.initializers.ts` | Modified | Alineación de inicialización de estado de sesión |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Limpieza insuficiente en shared device | Med | Matriz explícita de datos a purgar y tests de regresión |
| Limpieza excesiva que afecte offline UX | Med | Política de retención mínima + pruebas de continuidad offline |
| Bypass por reglas inconsistentes | Med | Fuente única de estado de sesión + tests guard/sync/init |

## Rollback Plan

Revertir a gate por token actual y desactivar enforcement de estados offline mediante rollback de cambios FE; mantener migraciones backward-compatible para lectura de datos existentes.

## Dependencies

- Sin dependencias externas nuevas; usa backend/login JWT actual.

## Success Criteria

- [ ] El sistema bloquea push/pull cuando sesión esté `reauth_required` o `expired`.
- [ ] Luego de logout o cambio de usuario en dispositivo compartido, no quedan datos sensibles reutilizables para sync.
- [ ] Guard, initializer y sync usan una misma regla de vigencia sin bypass.
