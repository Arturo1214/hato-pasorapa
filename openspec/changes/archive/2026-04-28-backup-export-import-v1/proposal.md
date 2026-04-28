# Proposal: Backup Export/Import V1 (Local Continuity)

## Intent

Habilitar continuidad operativa offline ante pérdida/corrupción local con un flujo manual y seguro de export/import/restore local. V1 prioriza recuperación rápida sin infraestructura remota, manteniendo boundary de sesión y reautenticación.

## Scope

### In Scope
- Export local manual a archivo JSON único con metadatos/versionado e inclusión opcional de binarios de imagen.
- Import local manual con validación fuerte (estructura, versionado, integridad y compatibilidad de esquema).
- Restore transaccional (all-or-nothing), seguido de migración/normalización y rehidratación ordenada.
- Flujo explícito de recuperación ante pérdida/corrupción local.
- Boundary de sesión: restore/import no reactiva sesión; puede terminar en `reauth_required`.

### Out of Scope
- Sync remota de backups entre dispositivos.
- Cloud backup (S3/Drive/terceros) y automatización remota.
- DR enterprise (RPO/RTO formal, multi-región, runbooks).

## Capabilities

### New Capabilities
- `offline-backup-local-continuity-v1`: export/import/restore local-first con contrato de payload, validación fuerte y recuperación operativa.

### Modified Capabilities
- `offline-session-security-v1`: extiende reglas para exigir boundary de sesión y reautenticación posterior a import/restore.

## Approach

Adoptar backup JSON unificado V1 (estado offline + binarios opcionales) para UX simple. Implementar pipeline: validar completo primero, restaurar en transacción local, luego ejecutar migraciones y refrescar derivados. Si falla validación o transacción, rollback total y sin estado parcial.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Export/import snapshot y restore atómico |
| `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` | Modified | Inclusión/exclusión opcional de binarios |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Compatibilidad/migración post-restore |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Modified | Boundary de sesión y `reauth_required` |
| `hato-fe/src/app/app.initializers.ts` | Modified | Rehidratación y recomputación tras restore |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backup grande por imágenes | Med | Opción sin binarios + límites de tamaño |
| Restore parcial/corrupto | Med | Validación previa completa + transacción + rollback |
| Bypass de sesión | Low/Med | Forzar `reauth_required` y bloquear sync hasta login |

## Rollback Plan

Feature flag para desactivar import/restore; mantener solo export diagnóstico. Revertir contrato de payload V1 y restaurar flujo previo sin mutaciones de estado por archivos externos.

## Dependencies

- IndexedDB stores actuales (`hato-offline`, `hato-offline-image-binaries`) y migraciones vigentes.
- Reglas existentes de sesión offline (`offline-session-security-v1`).

## Success Criteria

- [ ] Usuario ADMIN puede exportar e importar backup local válido sin soporte backend.
- [ ] Restore inválido/corrupto no deja estado parcial y reporta error accionable.
- [ ] Tras restore/import, sync queda bloqueada hasta reautenticación cuando aplique.
- [ ] Recuperación local reduce tiempo de vuelta a operación offline de forma repetible.
