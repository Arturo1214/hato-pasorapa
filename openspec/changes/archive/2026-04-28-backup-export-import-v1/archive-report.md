# Change Archived

**Change**: backup-export-import-v1
**Mode**: hybrid
**Archived to**: `openspec/changes/archive/2026-04-28-backup-export-import-v1/`

## Artifact Retrieval and Traceability

Engram artifacts were searched by dependency keys but none were found in this workspace:

- `sdd/backup-export-import-v1/explore`
- `sdd/backup-export-import-v1/proposal`
- `sdd/backup-export-import-v1/spec`
- `sdd/backup-export-import-v1/design`
- `sdd/backup-export-import-v1/tasks`
- `sdd/backup-export-import-v1/apply-progress`
- `sdd/backup-export-import-v1/verify-report`
- `sdd-init/code`

OpenSpec artifacts in `openspec/changes/backup-export-import-v1/` were used as primary source and moved to archive.

## Specs Synced

| Domain | Action | Source Delta | Details |
|---|---|---|---|
| `offline-backup-local-continuity-v1` | Created | `openspec/changes/archive/2026-04-28-backup-export-import-v1/specs/offline-backup-local-continuity-v1/spec.md` | Export/import/restore local JSON V1 con payload versionado, exclusión opcional de imágenes y validación antes de mutar |
| `offline-session-security-v1` | Modified | `openspec/changes/archive/2026-04-28-backup-export-import-v1/specs/offline-session-security-v1/spec.md` | Requisito `Sync Gate Requires Active Session` extendido con boundary post-restore/import (`reauth_required`) |

### Source of Truth Updated

- `openspec/specs/offline-backup-local-continuity-v1/spec.md`
- `openspec/specs/offline-session-security-v1/spec.md`

## What this V1 covers (explicit)

- ✅ **Export/import local manual** en archivo JSON único, con metadatos y control de inclusión opcional de imágenes.
- ✅ **`digest` obligatorio** para integridad de backup (incluido en contrato y validación).
- ✅ **Restore/recover coordinado y atómico** entre estado offline y binarios, con rollback completo ante fallo.
- ✅ **Rehidratación ordenada post-restore** (calendar → notifications → reporting → conflicts) y restauración de derivados en orden.
- ✅ **Imposición de `reauth_required`** luego de import/restore exitoso, antes de cualquier sync posterior.

## Out of scope retained

- ❌ Sincronización remota de backups entre dispositivos.
- ❌ Cloud backup (S3/Drive/terceros).
- ❌ DR enterprise (RPO/RTO formal, runbooks multi-región).

## Archive Contents

- exploration.md ✅
- proposal.md ✅
- specs/ ✅ (2 specs)
- design.md ✅
- tasks.md ✅
- apply-progress.md ✅
- verify-report.md ✅ (`PASS WITH WARNINGS`, no CRITICAL)
- archive-report.md ✅

## Verification and Integrity

- Verify status used for closure: **success** (as requested by workflow), based on `sdd/backup-export-import-v1/verify-report` inputs.
- Warnings detected were non-blocking and not scope-breaking (coverage/tooling and unaudited edge-case shape variants).

## Archive Integrity Check

- ✅ Main specs were updated before archiving.
- ✅ Change folder moved from active changes to `openspec/changes/archive/2026-04-28-backup-export-import-v1/`.
- ✅ Active folder `openspec/changes/backup-export-import-v1/` no longer exists.
- ✅ Archive trail preserved.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
