# Verification Report

**Change**: backup-export-import-v1  
**Mode**: Strict TDD (resolved from `sdd/code/testing-capabilities`)  
**Date**: 2026-04-28

---

## Completeness

Source of truth:
- Engram: `sdd/backup-export-import-v1/tasks`
- OpenSpec: `openspec/changes/backup-export-import-v1/tasks.md`

| Metric | Value |
|--------|-------|
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution

### Frontend (hato-fe)

**Node**: `v20.19.6` (via `nvm use` from repo `.nvmrc`)  
**Tests**: ✅ 202 passed / ❌ 0 failed / ⚠️ 0 skipped

Command executed:
```bash
npm test -- --watch=false
```

Result (summary):
- Test Files: 55 passed (55)
- Tests: 202 passed (202)

**Type check**: ✅ Passed

Command executed:
```bash
npx tsc --noEmit -p tsconfig.app.json
```

### Backend (hato-be)

**Java**: `21.0.5` (via `.java-version` + `jenv`)  
**Tests**: ➖ Not executed (change scope is FE-only for this iteration)

---

## Coverage

➖ Not available.

Attempted command:
```bash
npm test -- --watch=false --coverage
```

Observed error:
- Missing package: `@vitest/coverage-v8`

---

## TDD Compliance

Source of truth:
- Engram: `sdd/backup-export-import-v1/apply-progress`
- OpenSpec: `openspec/changes/backup-export-import-v1/apply-progress.md`

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | “TDD Cycle Evidence” table present in apply-progress |
| All tasks have tests | ✅ | 19/19 tasks mapped to at least one `*.spec.ts` |
| RED confirmed (tests exist) | ✅ | All referenced test files exist in repo |
| GREEN confirmed (tests pass) | ✅ | Full `hato-fe` suite passes (202/202) |
| Triangulation adequate | ✅ | Multi-case where needed (digest tamper, imagesExcluded rules, rollback) |
| Safety Net for modified files | ✅ | Existing suites listed in apply-progress are present and included in full run |

**TDD Compliance**: 6/6 checks passed

---

## Test Layer Distribution

All tests referenced by this change are **Unit** tests executed via Angular builder + Vitest (`ng test`).

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 202 | 55 | `ng test` (Vitest) |
| Integration | 0 | 0 | not used |
| E2E | 0 | 0 | not installed |
| **Total** | **202** | **55** | |

---

## Assertion Quality

**Assertion quality**: ✅ All assertions verify real behavior

Manual audit performed over the change-related specs (backup types/validator/service, store rollback, image binary store, app initializers ordering, auth reauth enforcement, sync gate, UI wiring). No tautologies, ghost loops, or smoke-test-only patterns were found.

---

## Spec Compliance Matrix

Source of truth:
- Engram: `sdd/backup-export-import-v1/spec`
- OpenSpec: `openspec/changes/backup-export-import-v1/specs/*/spec.md`

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Export Payload Contract and Explicit Exclusions | Export with images included | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should export a local backup with digest and optional image binaries` | ✅ COMPLIANT |
| Export Payload Contract and Explicit Exclusions | Export with images excluded | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should export a local backup with digest and optional image binaries` | ✅ COMPLIANT |
| Strong Import Validation Before Mutation | Valid payload accepted | `hato-fe/src/app/core/offline/backup/offline-backup.validator.spec.ts > should accept a valid payload with matching digest and image references` | ✅ COMPLIANT |
| Strong Import Validation Before Mutation | Corrupt or incompatible payload rejected | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should reject corrupt files before mutating local state` + `offline-backup.validator.spec.ts > should reject packages without a valid digest or with tampered content` | ✅ COMPLIANT |
| Transactional Restore and Ordered Rehydration | Full restore success | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should validate, restore, rehydrate and force reauth after a valid local import` | ✅ COMPLIANT |
| Transactional Restore and Ordered Rehydration | Restore failure rolls back all changes | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should rollback both stores when restore fails after validation` | ✅ COMPLIANT |
| Image Integrity Handling | Image integrity passes | `hato-fe/src/app/core/offline/backup/offline-backup.validator.spec.ts > should accept a valid payload with matching digest and image references` | ✅ COMPLIANT |
| Image Integrity Handling | Image integrity fails | `hato-fe/src/app/core/offline/backup/offline-backup.validator.spec.ts > should reject corrupt image references before restore starts` | ⚠️ PARTIAL |
| Sync Gate Requires Active Session | Sync allowed with active session | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` (suite already covers active path for manual sync / token gate) | ✅ COMPLIANT |
| Sync Gate Requires Active Session | Sync blocked pending reauthentication | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts > should block push and pull when the offline session expired or requires reauthentication` | ✅ COMPLIANT |
| Sync Gate Requires Active Session | Import/restore enforces session boundary | `hato-fe/src/app/core/offline/backup/offline-backup.service.spec.ts > should validate, restore, rehydrate and force reauth after a valid local import` + `hato-fe/src/app/core/auth/data-access/auth.service.spec.ts > should force reauth_required after a successful local restore so sync stays blocked until login` | ✅ COMPLIANT |

**Compliance summary**: 10/11 scenarios compliant

Notes:
- “Image integrity fails” is covered via checksum mismatch (inconsistency). A dedicated “missing image binary” or “orphan integrity reference” regression is not explicitly asserted; current coverage is **partial** for the full set of failure modes described.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Export Payload Contract and Explicit Exclusions | ✅ Implemented | Envelope V1 + `manifest.imagesExcluded` + optional `images` serialization; explicit removal of `ANIMAL_IMAGE` artifacts when excluded. |
| Strong Import Validation Before Mutation | ✅ Implemented | `validateBackupEnvelope(...)` enforces structure/version/schema/digest and image linkage before restore. |
| Transactional Restore and Ordered Rehydration | ✅ Implemented | Compensating rollback across both stores + rehydration order enforced via `runOfflineRestoreRehydration()`; failure rolls back to previous snapshots/binaries. |
| Image Integrity Handling | ⚠️ Partial | Validator covers missing/malformed/inconsistent conditions; runtime tests cover checksum mismatch + excluded refs, but not every failure shape is proven by tests. |
| Sync Gate Requires Active Session | ✅ Implemented | `forceReauthAfterRestore()` persists `reauth_required`; sync orchestrator blocks `reauth_required/expired`. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|----------|-------|
| JSON único versionado (V1) | ✅ Yes | Single JSON export/import path with pinned `backupVersion`. |
| Validación previa total + restore | ✅ Yes | Import validates before any writes. |
| Restore coordinado all-or-nothing | ✅ Yes | Coordinated restore with compensating rollback on any downstream failure (rehydration/auth). |
| Forzar `reauth_required` tras restore | ✅ Yes | Enforced in backup service + auth service tests. |

Doc drift:
- `openspec/changes/backup-export-import-v1/design.md` dejó como “Open Question” si `digest` era opcional; la spec y la implementación lo hicieron **obligatorio**.

---

## Issues Found

**CRITICAL** (must fix before archive):
- None

**WARNING** (should fix):
- Spec scenario “Image integrity fails” is only partially proven by tests (missing explicit tests for missing image binaries / orphan integrity links).
- Coverage tooling not installed (`@vitest/coverage-v8`), so changed-file coverage could not be validated.

**SUGGESTION** (nice to have):
- Update `design.md` Open Questions section to reflect that `digest` is now required by spec and enforced by validator.

---

## Verdict

**PASS WITH WARNINGS** — Behavior is compliant and tests are green; remaining gaps are non-blocking verification coverage/tooling, not functional defects.
