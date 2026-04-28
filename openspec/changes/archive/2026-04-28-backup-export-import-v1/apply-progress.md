# Apply Progress

**Change**: backup-export-import-v1  
**Mode**: Strict TDD  
**Date**: 2026-04-28

## Completed Tasks

- [x] Phase 1 — contratos V1 de backup local con `digest` SHA-256 obligatorio, serialización canónica y errores tipados.
- [x] Phase 2 — export local con snapshot sin metadata sensible, exclusión explícita de `ANIMAL_IMAGE` y binarios serializados por `operationId`.
- [x] Phase 3 — import/restore validado al 100% antes de mutar, rollback de stores ante falla y restore coordinado de binarios.
- [x] Phase 4 — rehidratación runtime ordenada (`calendar → notifications → reporting → conflicts`) y `forceReauthAfterRestore()` antes de cualquier sync nuevo.
- [x] Phase 5 — hardening UX/UI ADMIN con feature flag `offlineBackupV1Enabled`, página `/admin/backups` y regresiones FE dedicadas.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-fe/src/app/core/offline/backup/offline-backup.types.ts` | Created | Contrato V1, digest helpers, errores de validación/import y serialización canónica. |
| `hato-fe/src/app/core/offline/backup/offline-backup.validator.ts` | Created | Validación estructural, compatibilidad de schema, digest SHA-256 e integridad imagen↔operation/checksum. |
| `hato-fe/src/app/core/offline/backup/offline-backup.service.ts` | Created | Orquestación export/import, rollback coordinado, download JSON y forcing de reauth. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Updated | Snapshot exportable sin `sessionSecurity` y `restoreFromBackupTx(...)` para restore all-or-nothing. |
| `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` | Updated | `listForBackup()` y `restoreBinarySetTx(...)` para round-trip de binarios locales. |
| `hato-fe/src/app/app.initializers.ts` | Updated | Registro de rehidratación ordenada post-restore reutilizable por el servicio de backup. |
| `hato-fe/src/app/core/auth/data-access/auth.service.ts` | Updated | `forceReauthAfterRestore()` persistiendo `reauth_required` con reason `manual_lock`. |
| `hato-fe/src/app/features/admin/backup/backup-page.component.ts` | Created | UI ADMIN para export/import local bajo feature flag. |
| `openspec/changes/backup-export-import-v1/tasks.md` | Updated | 19/19 tasks y checklist final marcados como completos. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `offline-backup.types.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 1.2 | `offline-backup.types.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.3 | `offline-backup.validator.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ Valid + corrupt refs | ✅ Clean |
| 1.4 | `offline-backup.validator.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ Digest + exclusion cases | ✅ Clean |
| 2.1 | `offline-store.service.spec.ts` | Unit | ✅ 11/11 | ✅ Written | ✅ Passed | ✅ Export snapshot + rollback paths | ✅ Clean |
| 2.2 | `offline-image-binary-store.service.spec.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ Export + restore binary set | ✅ Clean |
| 2.3 | `offline-backup.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ include/exclude export | ✅ Helpers extracted |
| 2.4 | `offline-backup.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ digest + no-image branch | ✅ Clean |
| 3.1 | `offline-store.service.spec.ts` | Unit | ✅ 11/11 | ✅ Written | ✅ Passed | ✅ restore + rollback scenarios | ✅ Clean |
| 3.2 | `offline-store.service.spec.ts` | Unit | ✅ 11/11 | ✅ Written | ✅ Passed | ✅ replace + revert flows | ✅ Clean |
| 3.3 | `offline-image-binary-store.service.spec.ts` | Unit | ✅ 2/2 | ✅ Written | ✅ Passed | ✅ round-trip blob set | ✅ Clean |
| 3.4 | `offline-backup.validator.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ incompatible/corrupt combinations | ✅ Clean |
| 3.5 | `offline-backup.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ validate-before-mutate + rollback | ✅ Clean |
| 4.1 | `app.initializers.spec.ts` | Unit | ✅ 1/1 | ✅ Written | ✅ Passed | ✅ restore ordering asserted | ✅ Clean |
| 4.2 | `auth.service.spec.ts` | Unit | ✅ 8/8 | ✅ Written | ✅ Passed | ✅ active→reauth flow | ✅ Clean |
| 4.3 | `offline-backup.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ rehydrate before reauth | ✅ Clean |
| 4.4 | `offline-backup.service.spec.ts`, `sync-orchestrator.service.spec.ts` | Unit | ✅ targeted suites green | ✅ Written | ✅ Passed | ✅ restore + sync gate regression | ✅ Clean |
| 5.1 | `offline-backup.validator.spec.ts`, `offline-backup.service.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ corrupt JSON + digest mismatch | ✅ Error copy normalized |
| 5.2 | `offline-store.service.spec.ts`, `offline-backup.service.spec.ts` | Unit | ✅ targeted suites green | ✅ Written | ✅ Passed | ✅ no-mutation + rollback assertions | ✅ Clean |
| 5.3 | `auth.service.spec.ts`, `sync-orchestrator.service.spec.ts` | Unit | ✅ targeted suites green | ✅ Written | ✅ Passed | ✅ blocked `reauth_required/expired` | ✅ Existing guard preserved |
| 5.4 | `backup-page.component.spec.ts`, `app.routes.admin.spec.ts`, `sidebar.spec.ts` | Unit | ✅ targeted suites green | ✅ Written | ✅ Passed | ✅ route + menu + feature flag wiring | ✅ Clean |

## Test Summary

- **Total tasks complete**: 19/19
- **Targeted test suites passing in this batch**: 59/59 (`ng test --watch=false --include ...` sobre 11 specs relacionadas)
- **Layers used**: Unit (contracts, validator, backup orchestration, auth/session, UI wiring, route/menu, store rollback)
- **Approval tests**: None — behavior changes were specified and implemented via new regression coverage
- **Pure functions created/refined**: `serializeBackupEnvelopeCanonical`, `cloneBackupEnvelopeForDigest`, `computeSha256Hex`, `validateBackupEnvelope`

## Deviations from Design

- None — implementation matches the approved FE-only V1 scope and keeps backend como no-op funcional.

## Issues Found

- OpenSpec root `config.yaml` no existe en este repo; se resolvió strict TDD desde `sdd-init/code` + test runners detectados.

## Remaining Tasks

- [x] None — change ready for `sdd-verify`.

## Status

19/19 tasks complete. Ready for verify.
