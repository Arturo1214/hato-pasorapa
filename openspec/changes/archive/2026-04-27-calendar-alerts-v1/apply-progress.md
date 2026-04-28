# Apply Progress: Calendar Alerts V1

## Status
- Mode: Strict TDD
- Progress: 19/19 tasks complete
- Corrective scope: evidencia TDD recuperada + escenario “Segundo dispositivo” cubierto
- Ready for verify rerun

## Merge Note
- Se leyó y mergeó el apply-progress previo antes de persistir este correctivo.
- Este artefacto conserva las 19 tareas completadas y agrega la evidencia faltante de TDD junto con la cobertura cross-device pedida por verify.

## Completed Tasks
- [x] 1.1 `offline-store.migrations.spec.ts`
- [x] 1.2 Schema v4 + `calendarAlerts` derived state types/migration
- [x] 1.3 `OfflineStoreService` helpers `get/set/invalidateCalendarAlertsState`
- [x] 2.1 Projection specs for multi-source derivation, exclusion, severity and stable ordering
- [x] 2.2 Pure projection with timeline filtering and deterministic priority
- [x] 2.3 Store specs for startup/post-sync/prefs/manual rebuild and stale guard
- [x] 2.4 Signals-based store with local cache persistence per device
- [x] 2.5 Shared date/priority utilities extracted
- [x] 3.1 Sync orchestrator spec for `calendar-alerts:refresh`
- [x] 3.2 Sync orchestrator trigger wiring after successful pull
- [x] 3.3 Browser notification gateway specs for permission/cooldown/snooze
- [x] 3.4 Browser notification gateway with in-app fallback always on
- [x] 4.1 Calendar page specs for ranges, stale/loading/empty, refresh and preferences
- [x] 4.2 Calendar page UI + feature wiring
- [x] 4.3 Sidebar and route specs for calendar entry + severity badge
- [x] 4.4 Final route/sidebar wiring for `admin/calendario`
- [x] 5.1 FE integration spec for rebuild post-sync + sidebar badge update
- [x] 5.2 Startup initialization wiring through app initializer
- [x] 5.3 V1 exclusions/default decisions documented in feature comments and UI copy
- [x] 5.4 Focused test suite re-executed and corrective evidence persisted

## Corrective Delta
- Se agregó el test `CalendarAlertsStore > should keep reminder preferences isolated on a second device` en `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts`.
- El escenario demuestra que `horizonDays`, `notificationsEnabled` y `snoozedUntil` permanecen locales por dispositivo aun cuando ambos dispositivos proyectan la misma agenda offline.

## TDD Evidence Recovery Note
- Strict TDD estaba habilitado para este change desde `sdd/code/testing-capabilities`.
- La implementación original ya tenía los tests y el código productivo, pero el artefacto previo no había dejado la tabla obligatoria. Esta versión recupera el mapeo tarea -> test -> capa y lo valida con una nueva corrida enfocada.
- La corrección actual siguió un ciclo de aprobación/coverage sobre comportamiento existente para cerrar el escenario faltante sin alterar producción.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `offline-store.migrations.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing migration-first spec retained | ✅ Focused suite green | ✅ Empty state + v3 compatibility | ➖ None needed |
| 1.2 | `offline-store.migrations.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing migration contract retained | ✅ Focused suite green | ✅ Schema + normalized meta coverage | ✅ Migration helpers kept minimal |
| 1.3 | `offline-store.service.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing helper contract retained | ✅ Focused suite green | ✅ Set/get + invalidate paths | ✅ Persistence API stayed cohesive |
| 2.1 | `calendar-alerts-projection.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing projection spec retained | ✅ Focused suite green | ✅ Multi-source + invalid due date + stable order | ➖ None needed |
| 2.2 | `calendar-alerts-projection.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing projection contract retained | ✅ Focused suite green | ✅ Range filtering + severity logic | ✅ Pure projection kept isolated |
| 2.3 | `calendar-alerts.store.spec.ts` | Integration/Component | ✅ Baseline 2/2 before corrective edit | ✅ Existing rebuild spec retained | ✅ Updated spec green (3/3) | ✅ Startup/manual/post-sync + stale + second-device isolation | ✅ No production refactor required |
| 2.4 | `calendar-alerts.store.spec.ts` | Integration/Component | ✅ Baseline 2/2 before corrective edit | ✅ Existing per-device persistence contract retained | ✅ Updated spec green (3/3) | ✅ Preferences persisted + cross-device isolation | ✅ Signals/store API unchanged |
| 2.5 | `calendar-alerts-projection.spec.ts`, `calendar-alerts.store.spec.ts` | Unit + Integration | ✅ Focused suite green | ✅ Existing utility-driven tests retained | ✅ Focused suite green | ✅ Shared date/priority behavior exercised from both layers | ✅ Utility extraction preserved |
| 3.1 | `sync-orchestrator.service.spec.ts` | Integration | ✅ Focused suite green | ✅ Existing refresh-event spec retained | ✅ Focused suite green | ✅ Success-only dispatch path covered | ➖ None needed |
| 3.2 | `sync-orchestrator.service.spec.ts` | Integration | ✅ Focused suite green | ✅ Existing post-pull contract retained | ✅ Focused suite green | ✅ Pull success vs non-refresh paths | ✅ Event wiring stayed minimal |
| 3.3 | `browser-notification.gateway.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing permission/cooldown tests retained | ✅ Focused suite green | ✅ Default/denied/granted + snooze | ➖ None needed |
| 3.4 | `browser-notification.gateway.spec.ts` | Unit | ✅ Focused suite green | ✅ Existing fallback contract retained | ✅ Focused suite green | ✅ Browser delivery vs in-app fallback | ✅ Gateway remains best-effort/local |
| 4.1 | `calendar-page.component.spec.ts` | Component | ✅ Focused suite green | ✅ Existing UI behavior spec retained | ✅ Focused suite green | ✅ Range switch + empty/loading/stale + prefs actions | ➖ None needed |
| 4.2 | `calendar-page.component.spec.ts` | Component | ✅ Focused suite green | ✅ Existing page contract retained | ✅ Focused suite green | ✅ UI delegates logic to store across multiple actions | ✅ UI stayed thin |
| 4.3 | `sidebar.spec.ts`, `app.routes.admin.spec.ts` | Component + Integration | ✅ Focused suite green | ✅ Existing sidebar/route specs retained | ✅ Focused suite green | ✅ Entry visibility + badge severity | ➖ None needed |
| 4.4 | `sidebar.spec.ts`, `app.routes.admin.spec.ts` | Component + Integration | ✅ Focused suite green | ✅ Existing wiring contract retained | ✅ Focused suite green | ✅ Route + menu integration coverage | ✅ Final wiring stayed explicit |
| 5.1 | `calendar-alerts.integration.spec.ts` | Integration | ✅ Focused suite green | ✅ Existing post-sync integration spec retained | ✅ Focused suite green | ✅ Sync rebuild + sidebar update | ➖ None needed |
| 5.2 | `app.initializers.spec.ts`, `calendar-alerts.integration.spec.ts` | Unit + Integration | ✅ Focused suite green | ✅ Existing startup bootstrap contract retained | ✅ Focused suite green | ✅ Initializer + runtime rebuild paths | ✅ Startup hook kept minimal |
| 5.3 | `calendar-alerts.store.spec.ts`, `browser-notification.gateway.spec.ts`, `calendar-page.component.spec.ts` | Integration + Unit + Component | ✅ Baseline 2/2 before corrective edit | ✅ Existing local-only behavior retained | ✅ Updated spec green (3/3) | ✅ Explicit cross-device exclusion now covered by second-device test | ✅ No production refactor required |
| 5.4 | Focused suite below | Mixed | ✅ Executed with `nvm` + `jenv` | ✅ Evidence artifact completed before rerun | ✅ 11 files / 36 tests passing | ✅ Includes cross-device corrective scenario | ✅ Artifact merged and persisted |

## Test Summary
- **Total test files executed (focused suite)**: 11
- **Total tests passing (focused suite)**: 36/36
- **Focused baseline before corrective edit**: `calendar-alerts.store.spec.ts` -> 1 file / 2 tests passing
- **Focused post-correction proof**: `calendar-alerts.store.spec.ts` -> 1 file / 3 tests passing
- **Layers used**: Unit, Component, Integration
- **Approval tests (corrective pass sobre comportamiento existente)**: 1 scenario added late (`Segundo dispositivo`)
- **Pure functions created in original implementation**: projection + shared calendar utils (retained)

## Test Evidence
### Type check
```bash
npx tsc --noEmit -p tsconfig.app.json
```

Result: ✅ Passed

### Focused baseline (before editing the missing scenario)
```bash
npm test -- --watch=false --include src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts
```

Result: ✅ 1 file / 2 tests passing

### Focused store spec after adding “Segundo dispositivo”
```bash
npm test -- --watch=false --include src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts
```

Result: ✅ 1 file / 3 tests passing

### Focused calendar-alerts suite
```bash
npm test -- --watch=false \
  --include src/app/core/offline/offline-store.migrations.spec.ts \
  --include src/app/core/offline/offline-store.service.spec.ts \
  --include src/app/core/offline/sync-orchestrator.service.spec.ts \
  --include src/app/features/admin/calendar/data-access/calendar-alerts-projection.spec.ts \
  --include src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts \
  --include src/app/features/admin/calendar/data-access/browser-notification.gateway.spec.ts \
  --include src/app/features/admin/calendar/calendar-page.component.spec.ts \
  --include src/app/features/admin/calendar/calendar-alerts.integration.spec.ts \
  --include src/app/app.routes.admin.spec.ts \
  --include src/app/app.initializers.spec.ts \
  --include src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts
```

Result: ✅ 11 files / 36 tests passing

## Explicit V1 Decisions Applied
- Missing next-date metadata => the item is excluded from the derived V1 schedule.
- Operational badge visibility => enabled for `ADMIN` and `GANADERO`.
- Browser notifications => opt-in and best-effort only; in-app fallback remains always available.
- Reminder state (`horizonDays`, `notificationsEnabled`, `snoozedUntil`) remains local-only and is not shared cross-device in V1.

## Files Changed
- `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts.store.spec.ts`
- `openspec/changes/calendar-alerts-v1/apply-progress.md`

## Remaining Task
- [x] Ninguna tarea funcional pendiente en apply; listo para rerun de `sdd-verify`.
