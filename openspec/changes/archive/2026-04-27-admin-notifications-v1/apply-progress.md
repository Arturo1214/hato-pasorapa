# Implementation Progress

**Change**: admin-notifications-v1  
**Mode**: Strict TDD  
**Date**: 2026-04-27

## Completed Tasks

- [x] 1.1–1.6 Foundation backend/frontend for `NOTIFICATION`, schema v5 and shared offline meta helpers.
- [x] 2.1–2.4 Canonical backend ledger with immutable admin notifications, DTOs and mapper-driven payload normalization.
- [x] 3.1–3.4 V1 targeting resolver with `ALL_ACTIVE_GANADEROS`, `EXPLICIT_LIST`, exclusion precedence and 200-recipient cap.
- [x] 4.1–4.5 Incremental pull wiring for `NOTIFICATION`, recipient-filtered sync query and post-sync refresh event.
- [x] 5.1–5.5 Admin resource + Angular inbox feature + route + sidebar badge wiring.
- [x] 6.1–6.5 Local read-state persistence, per-device unread projection, retention hardening and focused suites green.

## Corrective Scope (verify follow-up)

- [x] Se alineó el contrato documentado de targeting V1 a `ALL_ACTIVE_GANADEROS` en spec/design del change para reflejar el contrato ya implementado en FE/BE.
- [x] Se agregó cobertura explícita para rechazo de payload inválido en `AdminNotificationsResourceTest`.
- [x] Se agregó cobertura explícita para pull `NOTIFICATION` sin cambios con cursor estable en `SyncServiceTest`.
- [x] Se agregó cobertura explícita para refresh offline-first preservando inbox cacheado en `sync-orchestrator.service.spec.ts`.

## Decisions Locked During Apply

- V1 targeting soporta `ALL_ACTIVE_GANADEROS` y `EXPLICIT_LIST`.
- `EXPLICIT_LIST` queda limitado a **200 recipients**.
- Retención local V1: **últimos 200 registros por dispositivo**.
- Copy UX explícito: **“leído solo en este dispositivo”**.
- El contrato documentado del change queda consolidado en plural `ALL_ACTIVE_GANADEROS` para coincidir con el API efectivo ya integrado entre backend y frontend.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AdminNotification*.java` | Created | Ledger canónico + destinatarios materializados. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminNotification*.java` | Created | Emisión ADMIN, targeting resolver y DTO mapping. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Pull incremental `NOTIFICATION` filtrado por usuario autenticado. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AdminNotificationsResource.java` | Created | `POST/GET /api/admin/notifications` solo ADMIN. |
| `hato-be/src/main/resources/db/changelog/009-admin-notifications-v1.yaml` | Created | Tablas/índices/constraints del ledger. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Tipos `NOTIFICATION` + `NotificationReadState`. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Schema local v5 + `meta.notifications`. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Read-state local, retención 200 y helpers meta compartidos. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Evento `notifications:refresh` post-pull exitoso. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modified | Caso offline-first que preserva inbox cacheado cuando el refresh se pide sin conectividad. |
| `hato-fe/src/app/features/admin/notifications/**` | Created | Service HTTP admin, store signals e inbox page. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modified | Menú + badge unread de notificaciones. |
| `hato-fe/src/app/app.routes.ts` | Modified | Ruta `/admin/notificaciones`. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminNotificationsResourceTest.java` | Modified | Caso de payload inválido rechazado por Bean Validation. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | Caso de delta vacío estable para `NOTIFICATION` sin cambios nuevos. |
| `openspec/changes/admin-notifications-v1/specs/admin-notification-ledger-v1/spec.md` | Modified | Contrato V1 alineado a `ALL_ACTIVE_GANADEROS`. |
| `openspec/changes/admin-notifications-v1/design.md` | Modified | Documentación técnica alineada al naming final del targeting. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `SyncEntityTypeTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ➖ Single enum contract | ➖ None needed |
| 1.2 | `SyncEntityTypeTest.java` | Unit | ✅ Focused suite green | ✅ Existing contract expanded | ✅ Passed | ✅ enum lookup + containment | ➖ None needed |
| 1.3 | `AdminNotificationLiquibaseMigrationTest.java` | Unit/Liquibase | N/A (new) | ✅ Written | ✅ Passed | ✅ tables + indexes + unique constraint | ✅ Added changelog include cleanup |
| 1.4 | `offline-types.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ snapshot + read-state contract | ➖ None needed |
| 1.5 | `offline-store.migrations.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing migration expectations updated first | ✅ Passed | ✅ default schema + v4→v5 migration | ✅ normalization helper extracted |
| 1.6 | `offline-store.service.spec.ts` | Unit | ✅ Focused suite green | ✅ Meta persistence assertions added first | ✅ Passed | ✅ restart + merge behavior | ✅ shared meta helper consolidated |
| 2.1 | `AdminNotificationServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ valid create + invalid limit | ✅ helper builder cleanup |
| 2.2 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ entity persistence assertions first | ✅ Passed | ✅ recipient rows + audit log | ✅ domain/repository split kept clean |
| 2.3 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ DTO/response expectations first | ✅ Passed | ✅ response payload + replay semantics | ✅ mapper separated from service |
| 2.4 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ normalization behavior asserted first | ✅ Passed | ✅ include/exclude JSON + response mapping | ✅ explicit mapper extraction |
| 3.1 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ targeting cases added first | ✅ Passed | ✅ all-active + explicit + overlap exclusion | ✅ table-driven style helpers |
| 3.2 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ recipient materialization asserted first | ✅ Passed | ✅ row count + final recipients | ➖ None needed |
| 3.3 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ active GANADERO resolution asserted first | ✅ Passed | ✅ active/inactive filtering + cap validation | ✅ targeting collaborator extracted |
| 3.4 | `AdminNotificationServiceTest.java` | Integration | ✅ Focused suite green | ✅ collaborator contract asserted first | ✅ Passed | ✅ include/exclude permutations | ✅ resolver isolated from service |
| 4.1 | `SyncServiceTest.java`, `SyncResourceTest.java` | Integration/REST | ✅ Focused suites green | ✅ notification pull expectations first | ✅ Passed | ✅ direct service + authenticated resource pull | ✅ current-user overload kept explicit |
| 4.2 | `SyncServiceTest.java` | Integration | ✅ Focused suite green | ✅ recipient-filtered cursor asserted first | ✅ Passed | ✅ title/body + recipient isolation | ✅ mapper/repo cursor responsibilities split |
| 4.3 | `sync-orchestrator.service.spec.ts` | Integration | ✅ Focused suite green | ✅ refresh event assertion added first | ✅ Passed | ✅ calendar + notifications refresh events | ➖ None needed |
| 4.4 | `sync-orchestrator.service.spec.ts` | Integration | ✅ Focused suite green | ✅ dispatch contract retained | ✅ Passed | ✅ successful pull emits both events | ✅ helper trigger extracted |
| 4.5 | `offline-store.service.spec.ts` | Unit | ✅ Focused suite green | ✅ checkpoint/merge assertions first | ✅ Passed | ✅ retention + local read merge | ✅ shared retention/meta logic centralized |
| 5.1 | `AdminNotificationsResourceTest.java` | REST | N/A (new) | ✅ Written | ✅ Passed | ✅ admin success + ganadero forbidden | ✅ operation-id flow reused |
| 5.2 | `AdminNotificationsResourceTest.java` | REST | ✅ Focused suite green | ✅ POST/GET contract asserted first | ✅ Passed | ✅ idempotent create + newest-first list | ➖ None needed |
| 5.3 | `notification-inbox.store.spec.ts`, `notification-inbox.page.spec.ts` | Unit/Component | N/A (new) | ✅ Written | ✅ Passed | ✅ startup + refresh + page actions | ✅ store/page concerns separated |
| 5.4 | `notification-inbox.page.spec.ts`, `app.routes.admin.spec.ts` | Component/Unit | ✅ Focused suites green | ✅ route/page contract written first | ✅ Passed | ✅ admin create UI + route exposure | ✅ standalone page kept cohesive |
| 5.5 | `sidebar.spec.ts` | Component | ✅ Focused suite green | ✅ navigation/badge assertions added first | ✅ Passed | ✅ calendar + notification badges | ✅ unread duplication removed from sidebar |
| 6.1 | `offline-store.service.spec.ts`, `offline-store.migrations.spec.ts` | Unit | ✅ Focused suites green | ✅ mark-read persistence cases first | ✅ Passed | ✅ restart + A(read)/B(unread) merge | ✅ schema/meta sync cleaned |
| 6.2 | `offline-store.service.spec.ts` | Unit | ✅ Focused suite green | ✅ read-state API expectations first | ✅ Passed | ✅ get/set/mark flows | ➖ None needed |
| 6.3 | `notification-inbox.store.spec.ts` | Unit | ✅ Focused suite green | ✅ unread projection assertions first | ✅ Passed | ✅ same-device vs second-device isolation | ✅ store keeps projection local-only |
| 6.4 | `notification-inbox.page.spec.ts`, `sidebar.spec.ts` | Component | ✅ Focused suites green | ✅ copy + badge consistency asserted first | ✅ Passed | ✅ explicit UX copy + immediate unread update | ✅ shared unread source stays in store |
| 6.5 | Focused BE + FE suites | Integration | ✅ Baseline compile/tests green | ✅ Target suites chosen before final run | ✅ Passed | ✅ backend + frontend notification flows | ➖ Verify phase will run broader audit |
| corrective-1 | `AdminNotificationsResourceTest.java` | REST | ✅ Safety net green (`AdminNotificationsResourceTest`, `SyncServiceTest`) | ✅ invalid payload contract added first | ✅ Passed | ✅ blank title + blank body + null targeting | ➖ Existing validation layer already clean |
| corrective-2 | `SyncServiceTest.java` | Integration | ✅ Safety net green (`AdminNotificationsResourceTest`, `SyncServiceTest`) | ✅ stable empty delta assertion added first | ✅ Passed | ✅ empty items + same cursorUpdatedAt + same cursorId | ➖ Existing pull cursor logic preserved |
| corrective-3 | `sync-orchestrator.service.spec.ts` | Integration | ✅ Safety net green (`sync-orchestrator.service.spec.ts`) | ✅ offline refresh preservation case added first | ✅ Passed | ✅ no API calls + cached snapshot + inbox still visible | ➖ Existing offline guard already clean |

## Test Summary

- **Total tests written/updated**: 15 targeted files
- **Total tests passing**: backend focused suite green + frontend focused suite green, incluyendo corrective scope
- **Layers used**: Unit, Integration, REST/Component
- **Approval tests**: None — no legacy behavior preserved via snapshot harness
- **Pure functions created**: 0 dedicated pure functions; behavior concentrated in repository/store/service projections

## Test Commands

### Backend

```bash
./mvnw test -Dtest=SyncEntityTypeTest,AdminNotificationLiquibaseMigrationTest,AdminNotificationServiceTest,AdminNotificationsResourceTest,SyncServiceTest,SyncResourceTest
```

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
export PATH="$JAVA_HOME/bin:$PATH"
./mvnw test -Dtest=AdminNotificationsResourceTest,SyncServiceTest
```

### Frontend

```bash
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

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.6 >/dev/null
npm test -- --watch=false --include src/app/core/offline/sync-orchestrator.service.spec.ts
```

## Deviations from Design

- Ninguna después del correctivo: design/spec del change quedaron alineados al contrato efectivo `ALL_ACTIVE_GANADEROS`.

## Issues Found

- Hubo que extender `IntegrationDatabaseCleaner` para borrar `AdminNotificationRecipient` antes de `users`, porque el nuevo FK hacía fallar la limpieza de tests de integración.
- El payload de Bean Validation en Quarkus expone `violations[]` (no `parameterViolations`); el test correctivo se ajustó al contrato HTTP real.

## Remaining Tasks

- [ ] Ninguna tarea funcional pendiente del change.
- [ ] Queda listo para rerun de `sdd-verify`.

## Status

29/29 tasks complete. Corrective verify gaps covered; ready for verify rerun.
