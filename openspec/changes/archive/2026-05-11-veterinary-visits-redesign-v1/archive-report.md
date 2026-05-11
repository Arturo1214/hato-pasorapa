# Archive Report: veterinary-visits-redesign-v1

**Status**: success
**Archived**: 2026-05-11
**Artifact store**: hybrid
**Verification**: PASS (35/35 tasks, 83/83 tests, 21/21 specs)

---

## Specs Synced to Main (`openspec/specs/`)

| Domain | Action | Summary |
|--------|--------|---------|
| `admin-veterinary-visits-v1` | **Created** | New spec — central vet visits list, lifecycle, GLOBAL/ESPECIFICA modes, per-visit veterinarian, campaign fan-out, calendar integration |
| `field-vet-visit-workflow-v1` | **Updated** | MODIFIED: offline-first now supports GLOBAL/ESPECIFICA modes; protocol→lifecycle PROGRAMADA→ATENDIDA→REPROGRAMADA|FINALIZADA|CANCELADA; per-visit veterinarian; global listing with filters; REMOVED: exclusions V1 (moved to V2 scope) |
| `animal-health-event-ledger-v1` | **Updated** | MODIFIED: FIELD_VET_VISIT metadata extended with visit block (modo, veterinarianId, estado, parentVisitId, nextControlAt); GLOBAL (animalUuid=NULL) supported; per-animal timeline shows CAMPAIGN for global, SPECIFIC for específica |
| `animal-health-treatment-follow-up-v1` | **Updated** | MODIFIED: visit chain lifecycle replaces protocol lifecycle; chain ACTIVE/CLOSED derived from visit estado; per-visit veterinarianId; timeline shows both SPECIFIC and CAMPAIGN entries |
| `calendar-offline-schedule-v1` | **Updated** | ADDED: GLOBAL/ESPECIFICA mode classification; agenda items for global visits labeled "Control Veterinario - Campanha"; MODIFIED: derived from FIELD_VET_VISIT with nextControlAt; items without nextControlAt excluded |
| `calendar-local-reminders-v1` | **Updated** | ADDED: vet visit reminder labels in Spanish ("Control Veterinario Pendiente", "Control Veterinario Hoy"); closed-chain exclusion (no reminders for FINALIZADA/CANCELADA chains); MODIFIED: vet visits included in classification and badge counts |

---

## Archive Contents

- `proposal.md` ✅
- `exploration.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (35/35 complete)
- `specs/` ✅ (6 domains)
- `verify-report-final.md` ✅ (PASS: 35 tasks, 83 tests, 21/21 specs compliant)
- `verify-report-pr4.md` ✅
- `verify-report-pr5.md` ✅
- `verify-report.md` ✅

---

## Source of Truth Updated

- `openspec/specs/admin-veterinary-visits-v1/spec.md` (NEW)
- `openspec/specs/field-vet-visit-workflow-v1/spec.md`
- `openspec/specs/animal-health-event-ledger-v1/spec.md`
- `openspec/specs/animal-health-treatment-follow-up-v1/spec.md`
- `openspec/specs/calendar-offline-schedule-v1/spec.md`
- `openspec/specs/calendar-local-reminders-v1/spec.md`

---

## Engram Artifact Observation IDs

- Proposal: #2089 | Design: #2091 | Spec: #2093 | Tasks: #2094
- Verify-report (full): #2100 | PR4: #2116 | PR5: #2120
- Archive report: #2122

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.