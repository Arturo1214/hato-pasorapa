# Change Archived

**Change**: calendar-alerts-v1
**Archived to**: `openspec/changes/archive/2026-04-27-calendar-alerts-v1/`

### Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| calendar-local-reminders-v1 | Created | 4 requirements added |
| calendar-offline-schedule-v1 | Created | 4 requirements added |

### Scope and Behavior Captured
- Local-only agenda derivation from offline snapshots (`ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`, `ANIMAL_EVENT`, `ANIMAL`) was documented and implemented as V1 baseline.
- Derived, versioned storage (`syncState.meta.calendarAlerts`) and derived agenda recalculation/timeline windows (`today`, `next_7_days`, `next_30_days`) were explicitly captured.
- Badge and severity buckets (`upcoming`, `due_today`, `overdue`) are included along with fallback in-app notifications when browser notifications are unavailable.
- Out-of-scope in V1 was made explicit: **no push notifications/remota, no cross-device shared alert state, no advanced clinical inference rules**.
- `verify-report` outcome remains `PASS WITH WARNINGS` (no critical blockers).

### Archive Contents
- proposal.md ✅
- exploration.md ✅
- specs/ ✅
- design.md ✅
- tasks.md ✅ (19/19 tasks complete)
- apply-progress.md ✅
- verify-report.md ✅ (`PASS WITH WARNINGS`, no criticals)

### Source of Truth Updated
- `openspec/specs/calendar-local-reminders-v1/spec.md`
- `openspec/specs/calendar-offline-schedule-v1/spec.md`

### Source-of-record Notes
- No engram artifacts were recoverable at archive time for `sdd/calendar-alerts-v1/*`.

### SDD Cycle Complete
The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
