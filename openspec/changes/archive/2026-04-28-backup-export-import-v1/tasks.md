# Tasks: Backup Export/Import V1 (Local Continuity)

## Phase 1: Foundation & Contracts (TDD RED)

- [x] 1.1 Crear `hato-fe/src/app/core/offline/backup/offline-backup.types.ts` con `BackupEnvelopeV1` (digest SHA-256 **obligatorio**), manifest, errores tipados y contrato `imagesExcluded`.
- [x] 1.2 RED: crear `hato-fe/src/app/core/offline/backup/offline-backup.types.spec.ts` para fallar en casos sin `digest`, `backupVersion` inválido y combinación inválida `imagesExcluded/images`.
- [x] 1.3 Crear `hato-fe/src/app/core/offline/backup/offline-backup.validator.ts` con validación estructural + compatibilidad de schema + integridad imagen↔operation + verificación SHA-256.
- [x] 1.4 RED: crear `hato-fe/src/app/core/offline/backup/offline-backup.validator.spec.ts` cubriendo aceptación payload válido y rechazo sin digest/ digest inválido/refs imagen corruptas.

## Phase 2: Export Pipeline (GREEN + REFACTOR)

- [x] 2.1 Modificar `hato-fe/src/app/core/offline/offline-store.service.ts` para exponer snapshot exportable estable (sin metadata sensible de sesión).
- [x] 2.2 Modificar `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` con `listForBackup()` y modo exclusión explícito de binarios.
- [x] 2.3 Crear `hato-fe/src/app/core/offline/backup/offline-backup.service.ts` (export): construir envelope V1, calcular digest SHA-256 del payload normalizado y adjuntar integrity.
- [x] 2.4 GREEN/REFACTOR tests de export en `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts` para include/exclude imágenes + digest presente y verificable.

## Phase 3: Import/Restore Transaccional (RED → GREEN → REFACTOR)

- [x] 3.1 RED: extender `hato-fe/src/app/core/offline/offline-store.service.spec.ts` con escenario de restore parcial fallido que exige rollback total.
- [x] 3.2 Implementar `restoreFromBackupTx(...)` en `hato-fe/src/app/core/offline/offline-store.service.ts` para reemplazo all-or-nothing de estado offline.
- [x] 3.3 Implementar `restoreBinarySetTx(...)` en `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` dentro del mismo flujo transaccional coordinado.
- [x] 3.4 Modificar `hato-fe/src/app/core/offline/offline-store.migrations.ts` para aceptar `sourceSchemaVersion <= CURRENT_OFFLINE_SCHEMA_VERSION` y normalizar post-restore.
- [x] 3.5 Implementar import en `offline-backup.service.ts`: validar 100% antes de mutar; rechazar paquetes sin digest válido; ejecutar restore + migraciones sólo si pasa validación.

## Phase 4: Rehidratación Runtime & Boundary de Sesión

- [x] 4.1 Modificar `hato-fe/src/app/app.initializers.ts` para registrar rehidratación ordenada post-restore (calendar, notifications, reporting, conflicts).
- [x] 4.2 Modificar `hato-fe/src/app/core/auth/data-access/auth.service.ts` con `forceReauthAfterRestore()` y persistencia explícita de `reauth_required`.
- [x] 4.3 Integrar en `offline-backup.service.ts` el flujo final: restore conserva sólo datos y luego fuerza `reauth_required` antes de cualquier sync.
- [x] 4.4 GREEN tests de integración FE (`offline-backup.service.spec.ts` y/o spec dedicado) validando orden de rehidratación + bloqueo por sesión no activa tras import/restore.

## Phase 5: Hardening, UX Errors y Verificación Final

- [x] 5.1 Añadir casos de error accionables en specs de validator/service para archivo corrupto, incompatibilidad de versión y digest mismatch.
- [x] 5.2 Añadir prueba de no-mutación: import rechazado deja stores intactos (`offline-store.service.spec.ts`).
- [x] 5.3 Verificar regresión de `offline-session-security-v1` en FE: sync gate bloquea `reauth_required`/`expired` tras restore.
- [x] 5.4 Actualizar checklist de feature flag `offlineBackupV1Enabled` y criterios de done en `openspec/changes/backup-export-import-v1/tasks.md` (estado listo para `sdd-apply`).

## Done Checklist

- [x] `offlineBackupV1Enabled` agregado al runtime config FE y consumido por la UI ADMIN.
- [x] Ruta/página ADMIN para export/import local cableada (`/admin/backups`).
- [x] Export con imágenes y export sin imágenes generan digest SHA-256 verificable.
- [x] Import rechaza archivos corruptos, digest inválido, schema incompatible y referencias de imagen inconsistentes.
- [x] Restore revierte stores locales ante falla de rehidratación o restore coordinado.
- [x] Restore exitoso dispara rehidratación ordenada y fuerza `reauth_required` antes del próximo sync.
- [x] Change listo para `sdd-verify`.
