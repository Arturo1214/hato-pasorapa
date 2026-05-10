# Exploration: ganadero-animal-core-redesign-v1

## Status: COMPLETE

**Change name**: `ganadero-animal-core-redesign-v1`
**Topic key**: `sdd/ganadero-animal-core-redesign-v1/explore`
**Artifact store**: hybrid (Engram + filesystem)
**Date**: 2026-05-10

---

## Current State

### Architecture Overview

| Layer | State |
|-------|-------|
| **FE** | `hato-fe/src/app/features/admin/animals/` — standalone components, signals, RxJS, MatDialog for create/edit |
| **BE** | Quarkus 3.x, Resource → Service → Repository, Panache ORM, offline-first sync active |
| **Routes** | `ganadero/animales` (GANADERO) and admin share the same `AnimalsPageComponent` |
| **Image sync** | Full offline-first binary blob storage with checksum validation and thumbnail refs |

### Files Investigated

**Frontend:**
- `animals-page.component.ts` (769L) — List page, dialog-triggered create/edit, 5 inline dialog components, row actions
- `animal-form-dialog.component.ts` (311L) — 2-column grid form inside MatDialog, all validation in-component
- `animals.service.ts` — Offline-first snapshot/outbox; `listAnimals`, `createAnimal`, `updateAnimal`
- `animals-reproduction-events.service.ts` — Events, `buildBirthMetadata()`, service/pregnancy/birth workflows
- `animals-images-offline-flow.spec.ts` — Image sync reconciliation tests

**Backend:**
- `Animal.java` — Entity with `motherAnimalUuid`, `fatherAnimalUuid` (columns exist), full ownership mapping
- `AnimalRequest.java` — DTO for create/update; **MISSING** `motherAnimalUuid` / `fatherAnimalUuid`
- `AnimalResponse.java` — Returns all fields including parent uuids
- `AnimalService.java` — Ownership enforcement, category-sex validation, auto-transition (TERNERO→TORO at 24mo, castration→BUEY)
- `AnimalReproductionEventService.java` — `projectBirth()` sets parent uuids on offspring during BIRTH event processing
- `AnimalReproductionEventResource.java` — **GET-only** endpoint; no POST for creating events
- `AnimalEventResource.java` — Has POST for castration
- `AnimalImage.java` — Full image metadata with checksum, thumbnail ref, operation ID

### Current Animal Fields

**Writable via `AnimalRequest`:**
`ownerGanaderoId`, `arete`, `marca`, `tatuaje`, `category`, `sex`, `active`, `admissionDate`, `weightKg`, `birthDate`

**Readable via `AnimalResponse` but NOT writable:**
`motherAnimalUuid`, `fatherAnimalUuid`

**No current support:**
- Genealogical queries (ancestors, descendants)
- Insemination-specific sire selection
- Image metadata beyond what's stored

---

## Proposed Target Architecture

### Route Structure

```
/ganadero/animales                     → AnimalsListPage (ganaderoId scoped)
/ganadero/animales/nuevo               → AnimalCreatePage (owner auto-assigned from session)
/ganadero/animales/:uuid               → AnimalDetailPage (tabbed: ficha, imágenes, salud, reproducción, genealogía)
/ganadero/animales/:uuid/editar        → AnimalEditPage (full-page form, NOT dialog)

/admin/animales                        → AnimalsListPage (ADMIN sees all, owner selector available)
/admin/animales/nuevo                  → AnimalCreatePage (ADMIN picks owner)
/admin/animales/:uuid                  → AnimalDetailPage
/admin/animales/:uuid/editar           → AnimalEditPage
```

### Animal Detail Page — Tabs

1. **Ficha** (default) — Core animal data, read-only with Edit button → routes to `/editar`
2. **Imágenes** — Gallery with upload, thumbnail strip, full-screen preview, sync status badges
3. **Salud** — Health events timeline, add event inline
4. **Reproducción** — Reproduction events timeline (service → pregnancy → birth), add event
5. **Genealogía** — Tree: mother + father + offspring, expandable ancestors (maternal grandmother, etc.)

### Animal Create/Edit Page — Full-Page Form

**Layout (product-list style as user referenced):**
- Left panel (≈40%): Image gallery — main large photo + thumbnail strip on side/below, drag-drop upload area
- Right panel (≈60%): All form fields + parent selectors (mother/father lookup by arete/marca)
- Not a MatDialog

### Backend Changes Needed

1. **`PUT /api/animals/{uuid}`** — Extend to accept `motherAnimalUuid`, `fatherAnimalUuid` updates
2. **`POST /api/animals/{uuid}/reproduction-events`** — Create reproduction event (currently GET-only)
3. **`POST /api/animals/birth-registration`** — Unified: creates offspring + links parents + creates BIRTH event in one TX
4. **`GET /api/animals/{uuid}/genealogy`** — Returns ancestors (up to N gens) and descendants

---

## SDD Phases / Review Slices

### Phase 1: List Page Thumbnail Upgrade
**Scope**: FE only, no BE changes
**Lines est.**: ~250-300
**What**: Add thumbnail column to DataTable using `animalsImagesService.listImages` per row; sync-status badge on thumbnail; keep existing `app-data-table` pattern
**Tests**: DataTable thumbnail rendering, offline image reconciliation, empty state

**Risk**: Low — no BE coupling, uses existing image service, thumbnail lazy-load

### Phase 2: Animal Detail Page (View)
**Scope**: FE + BE new genealogy endpoint
**Lines est.**: ~350-400
**What**: New routed `AnimalDetailPageComponent` with 5 tabs, loads animal + events + images + genealogy
**Tests**: Route guards, tab rendering, BE genealogy endpoint, offline detail access

**Risk**: Medium — new route, BE endpoint, ownership enforcement in genealogy

### Phase 3: Full-Page Create/Edit
**Scope**: FE + BE extend `AnimalRequest` with parent uuids
**Lines est.**: ~500-600
**What**: Replace `AnimalFormDialogComponent` with routed `AnimalFormPageComponent`; left image gallery + right form; parent selector; offline create/update
**Tests**: Form validation, image gallery upload, offline create, BE parent field acceptance, version conflict handling

**Risk**: Medium — BE DTO change (additive), form page vs dialog migration

### Phase 4: Birth Registration Workflow
**Scope**: FE + BE new transactional endpoint
**Lines est.**: ~400
**What**: New `POST /api/animals/birth-registration`; creates multiple offspring + links mother/father + creates BIRTH event; FE page/modal for unified registration
**Tests**: Birth registration TX, offspring creation, conflict detection (offspring already has different parents)

**Risk**: Medium — complex TX, isolated to new endpoint, but very valuable UX

### Phase 5: Genealogical Tree UI
**Scope**: FE only (uses Phase 2 genealogy endpoint)
**Lines est.**: ~300
**What**: Expandable tree component, multi-generation ancestor drill-down
**Tests**: Tree rendering, empty state, multi-generation, offline tree access

**Risk**: Low — uses existing endpoint, self-contained component

---

## Data Model Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| `AnimalRequest` missing parent fields | `hato-be/.../dto/AnimalRequest.java` | Can't create calf with mother/father linkage from animal form |
| `AnimalReproductionEventResource` is GET-only | `hato-be/.../web/rest/AnimalReproductionEventResource.java` | No REST endpoint to create reproduction events for online workflow |
| No genealogical query API | — | Can't query ancestors/descendants |
| `AnimalReproductionEventRequest` missing `fatherAnimalUuid` in metadata for SERVICE | BE service | SERVICE event has `serviceMethod` but no sire selection |
| No dedicated birth registration endpoint | — | Must pre-create offspring separately, then link via BIRTH event metadata |

---

## Risks

1. **Offline-first image sync on detail page** — Detail page image gallery must work offline; image binary store exists but needs verification on detail page route
2. **Ownership enforcement in genealogy endpoint** — `ganaderoId` scope must be enforced on genealogy returns or return 403
3. **Parent conflict in birth registration** — `projectBirth()` already has conflict logic: offspring with different mother/father throws CONFLICT, can't overwrite
4. **Category auto-transition stale data** — `AnimalService.applyAutoTransitionOnRead()` mutates TERNERO→TORO silently; FE filters by category may show wrong value until re-fetch
5. **Version conflicts in offline edit** — If user edits offline while detail page is open with stale snapshot, optimistic UI may conflict
6. **Inline dialogs in animals-page** — 5 inline `@Component` classes in a 769-line file; migration to routed pages needs refactoring path

---

## Recommendations

### First SDD: Phase 1 (List + Thumbnail)
Smallest scope, no BE changes, validates approach, improves visual UX immediately.

### MVP Scope for Phase 1:
- Add thumbnail column to animals DataTable
- Show first image or placeholder photo per row
- Sync-status badge overlay on thumbnail
- Works offline (shows pending/synced/conflict from snapshot)
- No new BE endpoints

### Phase 2 can follow immediately after — detail page unlocks the full redesign.

---

*Exploration artifact persisted to Engram (topic_key: `sdd/ganadero-animal-core-redesign-v1/explore`) and memory (topic_key: `sdd/ganadero-animal-core-redesign-v1/discoveries`).*