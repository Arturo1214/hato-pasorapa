# Verification Report

**Change**: admin-notifications-v1  
**Mode**: Strict TDD (resolved from `sdd-init/code`)  
**Date**: 2026-04-27 (rerun)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 29 |
| Tasks complete | 29 |
| Tasks incomplete | 0 |

Source of truth:
- Engram `sdd/admin-notifications-v1/tasks`
- `openspec/changes/admin-notifications-v1/tasks.md`

---

## Build & Tests Execution

### Backend (Quarkus)

**Java**: 21.0.5 (via `jenv prefix 21.0.5` + explicit `JAVA_HOME`)  
**Tests**:

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
export PATH="$JAVA_HOME/bin:$PATH"
./mvnw test -Dtest=SyncEntityTypeTest,AdminNotificationLiquibaseMigrationTest,AdminNotificationServiceTest,AdminNotificationsResourceTest,SyncServiceTest,SyncResourceTest
```

**Result**: ✅ Passed

- Tests run: **48**
- Failures: **0**
- Errors: **0**
- Skipped: **0**

**Compile**:

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
export PATH="$JAVA_HOME/bin:$PATH"
./mvnw -DskipTests compile
```

**Result**: ✅ Passed

### Frontend (Angular/Vitest)

**Node**: v20.19.6 (via `nvm use 20.19.6`)  
**Command** (focused suite):

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.6 >/dev/null
npm test -- --watch=false \
  --include src/app/core/offline/offline-types.spec.ts \
  --include src/app/core/offline/offline-store.migrations.spec.ts \
  --include src/app/core/offline/offline-store.service.spec.ts \
  --include src/app/core/offline/sync-orchestrator.service.spec.ts \
  --include src/app/app.initializers.spec.ts \
  --include src/app/app.routes.admin.spec.ts \
  --include src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts \
  --include src/app/features/admin/notifications/data-access/notification-inbox.store.spec.ts \
  --include src/app/features/admin/notifications/notification-inbox.page.spec.ts
```

**Result**: ✅ Passed

- Test files: **9**
- Tests: **30**
- Failed: **0**
- Skipped: **0**

**Build**:

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.6 >/dev/null
npm run build
```

**Result**: ✅ Passed (⚠️ budget warning: initial bundle 803.77 kB > 500 kB)

### Coverage

➖ Skipped — `ng test` runner rejects `--code-coverage` (Unknown argument), so coverage is not available via current test runner invocation.

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Present in apply-progress (TDD Cycle Evidence table + focused test commands). |
| All tasks have tests | ✅ | Evidence points to 15 test files covering 29 tasks (grouped). |
| RED confirmed (tests exist) | ✅ | 15/15 referenced test files exist in repo. |
| GREEN confirmed (tests pass) | ✅ | Focused BE suite (48 tests) and FE focused suite (30 tests) both GREEN. |
| Triangulation adequate | ✅ | Scenarios covered by dedicated tests or by the explicit contract pair (sync-orchestrator event dispatch + inbox rebuild on event). |
| Safety Net for modified files | ➖ | Apply-progress reports focused suites; safety net not independently verifiable from verify phase. |

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `hato-fe/src/app/core/offline/offline-types.spec.ts` | 20 | `expect(snapshot.title).toBe('Aviso')` | Asserts a local dummy object, not production code | WARNING |
| `hato-fe/src/app/core/offline/offline-types.spec.ts` | 21 | `expect(readState.readAtById[...]).toBe(...)` | Asserts a local dummy object, not production code | WARNING |

**Assertion quality**: ✅ 0 CRITICAL, 2 WARNING

---

## Test Layer Distribution (change-related tests)

| Layer | Files | Examples |
|-------|-------|----------|
| Unit | 4 | `SyncEntityTypeTest.java`, `AdminNotificationLiquibaseMigrationTest.java`, `offline-types.spec.ts`, `offline-store.migrations.spec.ts` |
| Integration/Service | 2 | `AdminNotificationServiceTest.java`, `SyncServiceTest.java` |
| REST | 2 | `AdminNotificationsResourceTest.java`, `SyncResourceTest.java` |
| Component/Angular | 2 | `sidebar.spec.ts`, `notification-inbox.page.spec.ts` |
| Store/Feature (Angular) | 1 | `notification-inbox.store.spec.ts` |

---

## Spec Compliance Matrix (behavioral)

Legend: ✅ COMPLIANT (test exists + passed)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Canonical record | Admin creates a publishable notification | `hato-be/.../AdminNotificationsResourceTest.java > shouldCreateAdminNotificationsIdempotentlyAndListNewestFirst` | ✅ |
| Canonical record | Invalid notification payload is rejected | `hato-be/.../AdminNotificationsResourceTest.java > shouldRejectInvalidNotificationPayload` | ✅ |
| Targeting V1 | Broadcast all active except excluded IDs | `hato-be/.../AdminNotificationServiceTest.java > shouldCreateCanonicalNotificationForAllActiveGanaderosAndAuditIt` | ✅ |
| Targeting V1 | Explicit list with overlapping include/exclude | `hato-be/.../AdminNotificationServiceTest.java > shouldResolveExplicitRecipientsWithExclusionPrecedence` | ✅ |
| Listing contract | Admin lists recently issued notifications newest-first | `hato-be/.../AdminNotificationsResourceTest.java > shouldCreateAdminNotificationsIdempotentlyAndListNewestFirst` | ✅ |
| Incremental pull | Pull returns only new notification changes | `hato-be/.../SyncServiceTest.java > shouldPullNotificationItemsIncrementallyForTheCurrentRecipientOnly` | ✅ |
| Incremental pull | Pull with no changes is stable | `hato-be/.../SyncServiceTest.java > shouldReturnStableEmptyNotificationDeltaWhenThereAreNoChanges` | ✅ |
| Startup visibility | New notification appears after startup sync | `hato-fe/.../notification-inbox.store.spec.ts > should rebuild on startup...` + `hato-fe/.../sync-orchestrator.service.spec.ts > should dispatch refresh events after a successful manual sync` | ✅ |
| Refresh visibility | New notification appears after manual refresh | `hato-fe/.../sync-orchestrator.service.spec.ts > should dispatch refresh events after a successful manual sync` + `hato-fe/.../notification-inbox.store.spec.ts > should rebuild ... after ... refresh event` | ✅ |
| Offline-first | Refresh while offline preserves cached inbox | `hato-fe/.../sync-orchestrator.service.spec.ts > should preserve the cached notification inbox when a manual refresh is requested offline` | ✅ |
| Local read-state | Mark notification as read offline + persists restart | `hato-fe/.../offline-store.service.spec.ts` (notification read state persistence) | ✅ |
| Local read-state | Read-state does not replicate to another device | `hato-fe/.../notification-inbox.store.spec.ts` (second-device isolation) | ✅ |
| Badge consistency | Badge decreases when item is marked read | `hato-fe/.../notification-inbox.store.spec.ts` (unreadCount decreases after markAsRead) | ✅ |
| Merge behavior | Refresh merges without losing local read-state | `hato-fe/.../offline-store.service.spec.ts` (A stays read, B unread) | ✅ |

**Compliance summary**: 14/14 scenarios compliant.

---

## Coherence (FE/BE + Design)

- Targeting contract is coherent and matches spec/design: `ALL_ACTIVE_GANADEROS` + `EXPLICIT_LIST`.
- Pull channel contract is coherent: `SyncEntityType.NOTIFICATION` present and wired end-to-end (BE incremental pull + FE offline store + inbox rebuild on refresh event).
- Read-state remains local-only per device (no backend ACK) and is preserved across merges.

---

## Issues Found

### CRITICAL (must fix before archive)

- None.

### WARNING (should fix)

- FE build budget warning: initial bundle exceeds 500 kB.
- Minor test quality: `offline-types.spec.ts` has 2 dummy-object assertions (noise); only the `OFFLINE_ENTITY_TYPES` assertion validates production behavior.

### SUGGESTION (nice to have)

- If/when coverage is enabled for the Vitest runner, add per-changed-file coverage reporting (Strict TDD module Step 5d).

---

## Verdict

**PASS WITH WARNINGS** — spec scenarios are behaviorally compliant (tests exist + passed). Remaining warnings are non-blocking (FE build budget + minor assertion noise).
