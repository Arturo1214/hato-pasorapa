# Change Archived

**Change**: admin-reporting-v1
**Archived to**: `openspec/changes/archive/2026-04-28-admin-reporting-v1/`

### Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| admin-reporting-aggregates-v1 | Created | Added local-first aggregated requirements for users/ganaderos/animales and V1 presets/windows (`7d`, `30d`). |
| admin-reporting-operational-events-v1 | Created | Added requirements for operational event counts by bounded window and recent activity ordering from local snapshots. |
| admin-reporting-offline-freshness-v1 | Created | Added requirements for visible freshness (`lastSyncAt` / `lastComputedAt`) and offline continuity with manual refresh. |

### Scope and Behavior Captured
- In scope: local-first projection from existing offline snapshots, aggregated admin metrics, operational reports for `7d/30d` windows, closed/preset filters (`all`, `active_only`, `inactive_only`), visible freshness metadata, sidebar entry + route restricted to ADMIN (`admin/reportes`).
- Out of scope (explicit): BI avanzada, exportaciones complejas (PDF/Excel), filtros arbitrarios/ad-hoc, analítica predictiva.

### Archive Contents
- exploration.md ✅
- proposal.md ✅
- specs/ ✅ (`admin-reporting-aggregates-v1`, `admin-reporting-operational-events-v1`, `admin-reporting-offline-freshness-v1`)
- design.md ✅
- tasks.md ✅ (26/26 tasks complete)
- apply-progress.md ✅
- verify-report.md ✅ (`PASS WITH WARNINGS`, no critical)
- archive-report.md ✅

### Source of Truth Updated
- `openspec/specs/admin-reporting-aggregates-v1/spec.md`
- `openspec/specs/admin-reporting-operational-events-v1/spec.md`
- `openspec/specs/admin-reporting-offline-freshness-v1/spec.md`

### Engram Traceability
- `sdd/admin-reporting-v1/explore` → **#1244**
- `sdd/admin-reporting-v1/proposal` → **#1245**
- `sdd/admin-reporting-v1/spec` → **#1246**
- `sdd/admin-reporting-v1/design` → **#1247**
- `sdd/admin-reporting-v1/tasks` → **#1248**
- `sdd/admin-reporting-v1/apply-progress` → **#1250**
- `sdd/admin-reporting-v1/verify-report` → **#1253**

### Verification Status
- **Result**: `PASS WITH WARNINGS` (no critical issues)
- Warnings are tooling-related (`ng test --coverage` compatibility and one `toBeDefined()` assertion shape check), not behavioral regressions.

### SDD Cycle Complete
The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
