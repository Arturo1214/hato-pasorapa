# Archive Report: ganadero-animal-core-redesign-v1

**Change**: `ganadero-animal-core-redesign-v1`
**Archived**: 2026-05-10
**Artifact store**: hybrid
**Topic key**: `sdd/ganadero-animal-core-redesign-v1/archive-report`

---

## Executive Summary

This change delivered a comprehensive redesign of the ganadero animal management core: full-page create/edit flows, animal detail with tabbed genealogy, recursive bounded pedigree tree, birth registration with multi-calf UI, reproductive service events (Monta natural / Inseminación artificial), pregnancy diagnosis linked to service, and expected birth date calendar alerts. Ownership hardening and `ganaderoId` session contract were applied across BE and FE. Commits: `5ee08f5`, `bc395c9`, `bf90ff2`.

---

## Implemented Scope

### Authentication & Routing
- Ganadero registration success redirect to `/ganadero/dashboard`
- Role-based routing: 403 for unauthorized ganadero access to admin routes
- Session contract with explicit `ganaderoId` on backend/frontend boundary

### Animal List
- Thumbnail column in DataTable (per-row image from `animalsImagesService`)
- CTA buttons on each row
- Sync-status badge overlay on thumbnails

### Animal Detail Page
- New routed `AnimalDetailPageComponent` with tabs: Ficha, Imágenes, Salud, Reproducción, Genealogía
- Dedicated genealogy endpoint (recursive ancestors + descendants, bounded depth)
- Ownership enforcement on genealogy endpoint (403 if ganaderoId mismatch)

### Animal Create/Edit — Full-Page Form
- Replaced `AnimalFormDialogComponent` (MatDialog) with routed full-page form
- Left panel: image gallery (main photo + thumbnail strip)
- Right panel: all form fields + mother/father selectors (lookup by arete/marca)
- Offline create/update support
- `AnimalRequest` extended with `motherAnimalUuid` and `fatherAnimalUuid`

### Birth Registration
- `POST /api/animals/birth-registration` — single TX: creates offspring + links parents + creates BIRTH event
- Multi-calf UI: register multiple offspring in one transaction
- Online-only birth UX (offline deferred)
- Conflic detection when offspring already has different parents

### Reproductive Service
- `POST /api/animals/{uuid}/reproduction-events` — create reproduction events (previously GET-only)
- Service types: Monta natural, Inseminación artificial
- Pregnancy diagnosis linked to service
- Expected birth date: visibility in UI + calendar alerts

### Genealogy
- Recursive bounded genealogy tree (expandable ancestors/descendants)
- Visual tree component with multi-generation drill-down

---

## Commits

| Commit | Description |
|--------|-------------|
| `5ee08f5` | feat: redesign ganadero animal workflows |
| `bc395c9` | feat: add recursive animal genealogy |
| `bf90ff2` | feat: refine animal birth and gestation UI |

---

## Verification Evidence

### Backend (Java 21)
| Suite | Tests | Result |
|-------|-------|--------|
| Core animal management tests | 88 | ✅ PASS |
| Recursive genealogy tests | 19 | ✅ PASS |

### Frontend (Vitest)
| Suite | Tests | Result |
|-------|-------|--------|
| Core + integration fixes | 105 | ✅ PASS |
| Recursive genealogy tests | 23 | ✅ PASS |
| Final follow-up suite | 51 | ✅ PASS |

**Total**: 286 targeted tests passed.

### Not Run
- Full project build — skipped per project rule (no build_command in verify config)

### Manual Review Recommended
- Birth registration multi-calf UI flow
- Genealogy visual tree interaction
- Calendar alert rendering for expected birth dates

---

## Deferred Items

| Item | Reason |
|------|--------|
| Offline birth queue | Birth UX marked online-only; offline queue deferred to future slice |
| Full gestation module | Gestation tracking beyond pregnancy diagnosis not included |
| Semen catalog | Inseminación artificial sire selection catalog deferred |
| Deeper optimized genealogy | Bounded recursion implemented; deep-n optimization deferred until needed |

---

## Archive Contents

```
openspec/changes/archive/2026-05-10-ganadero-animal-core-redesign-v1/
├── exploration.md          ← synthesized from sdd/ganadero-animal-core-redesign-v1/explore.md
└── archive-report.md      ← this file
```

**Note**: No `openspec/changes/ganadero-animal-core-redesign-v1/` active folder existed — change was developed directly in working tree (commits `5ee08f5`, `bc395c9`, `bf90ff2`). Artifacts were persisted to `sdd/` filesystem path and Engram. This archive synthesizes the record from available artifacts and implementation history.

---

## SDD Cycle Status

**COMPLETE** — All phases executed (explore → apply → verify → archive). No critical issues in verification. Working tree was clean after final commit (`bf90ff2`). Ready for next change.

---

## Next Recommended

- `sdd-propose` for offline birth queue slice
- Manual UI review of genealogy tree and birth registration multi-calf flow
- Consider `sdd-explore` for semen catalog / full gestation module if priority warrants
